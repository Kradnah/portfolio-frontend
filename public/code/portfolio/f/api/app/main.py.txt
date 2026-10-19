import hashlib
import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import call_qa, invoice, vision
from .limits import UsageLimiter
from .llm import Llm, LlmError, OpenRouterLlm
from .prompt import language_reminder, system_prompt
from .session import SessionSigner
from .settings import Settings, get_settings

log = logging.getLogger("portfolio-api")

TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    # El límite fino de los mensajes del usuario se aplica abajo con la configuración.
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    lang: Literal["es", "en"] | None = None


class SessionRequest(BaseModel):
    turnstile_token: str | None = Field(default=None, alias="turnstileToken", max_length=4096)


def client_ip(request: Request, settings: Settings) -> str:
    """IP del visitante. Detrás de Traefik, la última entrada de X-Forwarded-For es la que añadió
    el proxy (las anteriores las puede inventar el cliente)."""
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def anon(ip: str) -> str:
    """Huella corta de la IP para los logs (no se guarda la IP en claro)."""
    return hashlib.sha256(ip.encode()).hexdigest()[:10]


def create_app(settings: Settings | None = None, llm: Llm | None = None) -> FastAPI:
    settings = settings or get_settings()
    signer = SessionSigner(settings.session_secret.get_secret_value(), settings.session_ttl_seconds)
    limiter = UsageLimiter(
        burst=settings.per_ip_burst,
        burst_window=settings.per_ip_burst_window_seconds,
        ip_daily=settings.per_ip_daily,
        global_daily=settings.global_daily,
    )
    qa_limiter = UsageLimiter(
        burst=settings.call_qa_burst,
        burst_window=settings.call_qa_burst_window_seconds,
        ip_daily=settings.call_qa_per_ip_daily,
        global_daily=settings.call_qa_global_daily,
    )
    invoice_limiter = UsageLimiter(
        burst=settings.invoice_burst,
        burst_window=settings.invoice_burst_window_seconds,
        ip_daily=settings.invoice_per_ip_daily,
        global_daily=settings.invoice_global_daily,
    )
    vision_limiter = UsageLimiter(
        burst=settings.vision_burst,
        burst_window=settings.vision_burst_window_seconds,
        ip_daily=settings.vision_per_ip_daily,
        global_daily=settings.vision_global_daily,
    )
    # Turnos usados por sesión: {sid: (turnos, caduca_en)}.
    turns: dict[str, tuple[int, float]] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=5)) as client:
            app.state.http = client
            app.state.llm = llm or OpenRouterLlm(settings, client)
            yield

    app = FastAPI(
        title="Portfolio API",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    def get_llm(request: Request) -> Llm:
        return request.app.state.llm

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/chat/session")
    async def create_session(body: SessionRequest, request: Request) -> dict[str, object]:
        if settings.turnstile_secret:
            ok = False
            if body.turnstile_token:
                res = await request.app.state.http.post(
                    TURNSTILE_URL,
                    data={
                        "secret": settings.turnstile_secret.get_secret_value(),
                        "response": body.turnstile_token,
                        "remoteip": client_ip(request, settings),
                    },
                )
                ok = res.status_code == 200 and res.json().get("success") is True
            if not ok:
                raise HTTPException(403, "turnstile_failed")
        return {"token": signer.issue(), "expiresIn": settings.session_ttl_seconds}

    @app.post("/api/chat")
    async def chat(
        body: ChatRequest,
        request: Request,
        llm: Annotated[Llm, Depends(get_llm)],
        authorization: Annotated[str | None, Header()] = None,
    ):
        sid = (
            signer.verify(authorization[7:])
            if authorization and authorization.startswith("Bearer ")
            else None
        )
        if not sid:
            raise HTTPException(401, "invalid_session")

        last = body.messages[-1]
        if last.role != "user":
            raise HTTPException(422, "last_message_must_be_user")
        if any(
            m.role == "user" and len(m.content) > settings.max_message_chars for m in body.messages
        ):
            raise HTTPException(422, "message_too_long")

        now = time.time()
        for key in [k for k, (_, exp) in turns.items() if exp < now]:
            del turns[key]
        used, _ = turns.get(sid, (0, 0))
        if used >= settings.max_turns:
            return JSONResponse({"detail": "max_turns"}, status_code=429)

        ip = client_ip(request, settings)
        verdict = limiter.check(ip)
        if not verdict.allowed:
            log.info("limite ip=%s motivo=%s", anon(ip), verdict.reason)
            return JSONResponse(
                {"detail": verdict.reason},
                status_code=429,
                headers={"Retry-After": str(verdict.retry_after)},
            )
        turns[sid] = (used + 1, now + settings.session_ttl_seconds)

        # Solo los últimos turnos: acota el costo aunque el cliente envíe un historial largo.
        history = body.messages[-(settings.max_turns * 2) :]
        messages = (
            [{"role": "system", "content": system_prompt()}]
            + [{"role": m.role, "content": m.content} for m in history]
            + [{"role": "system", "content": language_reminder(body.lang)}]
        )
        log.info("chat ip=%s turno=%d chars=%d", anon(ip), used + 1, len(last.content))

        async def events() -> AsyncIterator[str]:
            try:
                async for delta in llm.stream(messages):
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except LlmError as err:
                log.warning("llm_error %s", err)
                yield f"data: {json.dumps({'error': 'llm_unavailable'})}\n\n"

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/api/demos/call-qa/quota")
    async def call_qa_quota(request: Request) -> dict[str, int]:
        return {
            "remainingToday": qa_limiter.remaining(client_ip(request, settings)),
            "perDay": settings.call_qa_per_ip_daily,
            "maxSeconds": settings.call_qa_max_seconds,
        }

    @app.post("/api/demos/call-qa")
    async def call_qa_analyze(
        body: call_qa.CallQaRequest,
        request: Request,
        llm: Annotated[Llm, Depends(get_llm)],
        authorization: Annotated[str | None, Header()] = None,
    ):
        if not (
            authorization
            and authorization.startswith("Bearer ")
            and signer.verify(authorization[7:])
        ):
            raise HTTPException(401, "invalid_session")
        try:
            call_qa.check_size(
                body, max_seconds=settings.call_qa_max_seconds, max_chars=settings.call_qa_max_chars
            )
        except call_qa.TranscriptTooLong as err:
            raise HTTPException(422, err.reason) from err

        ip = client_ip(request, settings)
        verdict = qa_limiter.check(ip)
        if not verdict.allowed:
            log.info("call_qa limite ip=%s motivo=%s", anon(ip), verdict.reason)
            return JSONResponse(
                {"detail": verdict.reason},
                status_code=429,
                headers={"Retry-After": str(verdict.retry_after)},
            )
        try:
            analysis = await call_qa.analyze(llm, body, max_tokens=settings.call_qa_max_tokens)
        except (LlmError, call_qa.AnalysisFailed) as err:
            log.warning("call_qa error %s", type(err).__name__)
            qa_limiter.refund(ip)
            raise HTTPException(502, "analysis_unavailable") from err
        return {"analysis": analysis, "remainingToday": qa_limiter.remaining(ip)}

    @app.get("/api/demos/invoice/quota")
    async def invoice_quota(request: Request) -> dict[str, int]:
        return {
            "remainingToday": invoice_limiter.remaining(client_ip(request, settings)),
            "perDay": settings.invoice_per_ip_daily,
            "maxChars": settings.invoice_max_chars,
        }

    @app.post("/api/demos/invoice")
    async def invoice_extract(
        body: invoice.InvoiceRequest,
        request: Request,
        llm: Annotated[Llm, Depends(get_llm)],
        authorization: Annotated[str | None, Header()] = None,
    ):
        if not (
            authorization
            and authorization.startswith("Bearer ")
            and signer.verify(authorization[7:])
        ):
            raise HTTPException(401, "invalid_session")
        try:
            invoice.check_size(body, max_chars=settings.invoice_max_chars)
        except invoice.InvoiceTooLong as err:
            raise HTTPException(422, "text_too_long") from err

        ip = client_ip(request, settings)
        verdict = invoice_limiter.check(ip)
        if not verdict.allowed:
            log.info("invoice limite ip=%s motivo=%s", anon(ip), verdict.reason)
            return JSONResponse(
                {"detail": verdict.reason},
                status_code=429,
                headers={"Retry-After": str(verdict.retry_after)},
            )
        try:
            result = await invoice.extract(llm, body, max_tokens=settings.invoice_max_tokens)
        except (LlmError, invoice.ExtractionFailed) as err:
            log.warning("invoice error %s", type(err).__name__)
            invoice_limiter.refund(ip)
            raise HTTPException(502, "extraction_unavailable") from err
        return {"extraction": result, "remainingToday": invoice_limiter.remaining(ip)}

    @app.get("/api/demos/vision/quota")
    async def vision_quota(request: Request) -> dict[str, int]:
        return {
            "remainingToday": vision_limiter.remaining(client_ip(request, settings)),
            "perDay": settings.vision_per_ip_daily,
        }

    @app.post("/api/demos/vision")
    async def vision_describe(
        body: vision.VisionRequest,
        request: Request,
        llm: Annotated[Llm, Depends(get_llm)],
        authorization: Annotated[str | None, Header()] = None,
    ):
        if not (
            authorization
            and authorization.startswith("Bearer ")
            and signer.verify(authorization[7:])
        ):
            raise HTTPException(401, "invalid_session")
        try:
            vision.decode_image(body.image)
        except vision.InvalidImage as err:
            raise HTTPException(422, f"image_{err}") from err

        ip = client_ip(request, settings)
        verdict = vision_limiter.check(ip)
        if not verdict.allowed:
            log.info("vision limite ip=%s motivo=%s", anon(ip), verdict.reason)
            return JSONResponse(
                {"detail": verdict.reason},
                status_code=429,
                headers={"Retry-After": str(verdict.retry_after)},
            )
        try:
            result = await vision.describe(llm, body, max_tokens=settings.vision_max_tokens)
        except (LlmError, vision.DescribeFailed) as err:
            log.warning("vision error %s", type(err).__name__)
            vision_limiter.refund(ip)
            raise HTTPException(502, "vision_unavailable") from err
        return {"result": result, "remainingToday": vision_limiter.remaining(ip)}

    return app


def app_factory() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    return create_app()
