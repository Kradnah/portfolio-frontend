import json
from collections.abc import AsyncIterator
from typing import Protocol

import httpx

from .settings import Settings


class LlmError(Exception):
    pass


class Llm(Protocol):
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


class OpenRouterLlm:
    """Chat completions de OpenRouter en streaming (SSE). Devuelve los fragmentos de texto."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client

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
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key.get_secret_value()}",
            "HTTP-Referer": self.settings.public_url,
            "X-Title": "Portfolio Julian Lizcano",
        }
        try:
            async with self.client.stream(
                "POST", self.settings.openrouter_url, json=body, headers=headers
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
