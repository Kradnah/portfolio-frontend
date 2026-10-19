import json
from collections.abc import AsyncIterator
from typing import Any, Protocol

import httpx

from .settings import Settings


class LlmError(Exception):
    pass


class Llm(Protocol):
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...

    async def complete_json(
        self, messages: list[dict[str, str]], schema: dict[str, Any], *, max_tokens: int
    ) -> tuple[str, dict[str, Any]]: ...


class OpenRouterLlm:
    """Chat completions de OpenRouter en streaming (SSE). Devuelve los fragmentos de texto."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.openrouter_api_key.get_secret_value()}",
            "HTTP-Referer": self.settings.public_url,
            "X-Title": "Portfolio Julian Lizcano",
        }

    async def complete_json(
        self, messages: list[dict[str, str]], schema: dict[str, Any], *, max_tokens: int
    ) -> tuple[str, dict[str, Any]]:
        """Respuesta completa (sin streaming) con salida estructurada: (texto JSON, usage)."""
        body = {
            "model": self.settings.openrouter_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.2,
            "reasoning": {"enabled": self.settings.openrouter_reasoning},
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "result", "strict": True, "schema": schema},
            },
        }
        try:
            res = await self.client.post(
                self.settings.openrouter_url, json=body, headers=self._headers(), timeout=60
            )
        except httpx.HTTPError as err:
            raise LlmError(type(err).__name__) from err
        if res.status_code != 200:
            raise LlmError(f"OpenRouter respondió {res.status_code}")
        data = res.json()
        if "error" in data:
            raise LlmError(str(data["error"].get("message", "error")))
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as err:
            raise LlmError("respuesta sin contenido") from err
        return content or "", data.get("usage") or {}

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        body = {
            "model": self.settings.openrouter_model,
            "messages": messages,
            "max_tokens": self.settings.max_tokens,
            "temperature": 0.3,
            "stream": True,
            # Los modelos sin razonamiento ignoran este parámetro.
            "reasoning": {"enabled": self.settings.openrouter_reasoning},
        }
        try:
            async with self.client.stream(
                "POST", self.settings.openrouter_url, json=body, headers=self._headers()
            ) as res:
                if res.status_code != 200:
                    await res.aread()
                    raise LlmError(f"OpenRouter respondió {res.status_code}")
                async for line in res.aiter_lines():
                    if not line.startswith("data: "):
                        continue  # comentarios de keep-alive (": OPENROUTER PROCESSING")
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    if "error" in chunk:
                        raise LlmError(str(chunk["error"].get("message", "error")))
                    delta = chunk["choices"][0]["delta"].get("content")
                    if delta:
                        yield delta
        except httpx.HTTPError as err:
            raise LlmError(type(err).__name__) from err
