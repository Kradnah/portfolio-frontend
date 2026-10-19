import json

import pytest
from fastapi.testclient import TestClient

from app.llm import LlmError
from app.main import create_app
from app.prompt import system_prompt
from app.settings import Settings


class FakeLlm:
    def __init__(self, chunks=("Hola", ", soy el asistente."), fail=False):
        self.chunks = chunks
        self.fail = fail
        self.calls: list[list[dict[str, str]]] = []

    async def stream(self, messages):
        self.calls.append(messages)
        if self.fail:
            raise LlmError("caído")
        for c in self.chunks:
            yield c


def settings(**kw) -> Settings:
    base = {
        "openrouter_api_key": "test",
        "session_secret": "s" * 32,
        "per_ip_burst": 100,
        "per_ip_daily": 100,
        "global_daily": 100,
    }
    return Settings(**(base | kw))


@pytest.fixture
def llm():
    return FakeLlm()


@pytest.fixture
def client(llm):
    with TestClient(create_app(settings(), llm)) as c:
        yield c


def auth(client: TestClient) -> dict[str, str]:
    token = client.post("/api/chat/session", json={}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def events(res) -> list[dict]:
    return [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")]


def ask(client, headers, text="¿Qué stack usa?"):
    return client.post(
        "/api/chat", json={"messages": [{"role": "user", "content": text}]}, headers=headers
    )


def test_streams_answer_with_system_prompt(client, llm):
    res = ask(client, auth(client))
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    evs = events(res)
    assert "".join(e.get("delta", "") for e in evs) == "Hola, soy el asistente."
    assert evs[-1] == {"done": True}
    sent = llm.calls[0]
    assert sent[0]["role"] == "system" and "Julian" in sent[0]["content"]
    assert sent[-2] == {"role": "user", "content": "¿Qué stack usa?"}
    assert sent[-1]["role"] == "system" and "LANGUAGE" in sent[-1]["content"]


def test_page_language_hint_reaches_the_model(client, llm):
    headers = auth(client)
    client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "What is his stack?"}], "lang": "en"},
        headers=headers,
    )
    assert "inglés" in llm.calls[0][-1]["content"]


def test_requires_valid_session(client):
    assert ask(client, {}).status_code == 401
    assert ask(client, {"Authorization": "Bearer falso.token"}).status_code == 401


def test_rejects_long_messages_and_assistant_last(client):
    headers = auth(client)
    assert ask(client, headers, "x" * 501).status_code == 422
    res = client.post(
        "/api/chat",
        json={"messages": [{"role": "assistant", "content": "hola"}]},
        headers=headers,
    )
    assert res.status_code == 422


def test_rate_limit_per_ip_returns_429(llm):
    with TestClient(create_app(settings(per_ip_burst=2), llm)) as c:
        headers = auth(c)
        assert ask(c, headers).status_code == 200
        assert ask(c, headers).status_code == 200
        res = ask(c, headers)
        assert res.status_code == 429
        assert res.json()["detail"] == "ip_burst"
        assert int(res.headers["Retry-After"]) > 0


def test_max_turns_per_session(llm):
    with TestClient(create_app(settings(max_turns=2), llm)) as c:
        headers = auth(c)
        assert ask(c, headers).status_code == 200
        assert ask(c, headers).status_code == 200
        assert ask(c, headers).json()["detail"] == "max_turns"
        assert ask(c, auth(c)).status_code == 200  # una sesión nueva vuelve a empezar


def test_history_is_trimmed(llm):
    with TestClient(create_app(settings(max_turns=2), llm)) as c:
        history = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(9)
        ]
        c.post("/api/chat", json={"messages": history}, headers=auth(c))
        assert len(llm.calls[0]) == 1 + 4 + 1  # system + últimos 2 turnos + recordatorio de idioma


def test_llm_failure_is_reported_as_event():
    with TestClient(create_app(settings(), FakeLlm(fail=True))) as c:
        assert events(ask(c, auth(c)))[-1] == {"error": "llm_unavailable"}


def test_turnstile_required_when_configured(llm):
    with TestClient(create_app(settings(turnstile_secret="secreto"), llm)) as c:
        assert c.post("/api/chat/session", json={}).status_code == 403


def test_forwarded_ip_uses_last_hop(llm):
    with TestClient(create_app(settings(trust_proxy=True, per_ip_burst=1), llm)) as c:
        headers = auth(c)
        spoof = {**headers, "X-Forwarded-For": "1.2.3.4, 9.9.9.9"}
        assert ask(c, spoof).status_code == 200
        # Cambiar la primera IP (falsificable) no evade el límite: cuenta la del proxy.
        spoof2 = {**headers, "X-Forwarded-For": "5.6.7.8, 9.9.9.9"}
        assert ask(c, spoof2).status_code == 429


def test_prompt_never_contains_phone():
    assert "320" not in system_prompt()


def test_openrouter_request_disables_reasoning_by_default():
    import asyncio

    import httpx

    from app.llm import OpenRouterLlm

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        seen["auth"] = request.headers["authorization"]
        sse = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
        return httpx.Response(200, text=sse, headers={"content-type": "text/event-stream"})

    async def run() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            llm = OpenRouterLlm(settings(openrouter_model="deepseek/deepseek-v4.1-flash"), client)
            return "".join([d async for d in llm.stream([{"role": "user", "content": "hola"}])])

    assert asyncio.run(run()) == "ok"
    assert seen["body"]["model"] == "deepseek/deepseek-v4.1-flash"
    assert seen["body"]["reasoning"] == {"enabled": False}
    assert seen["body"]["max_tokens"] == 400
    assert seen["auth"] == "Bearer test"
