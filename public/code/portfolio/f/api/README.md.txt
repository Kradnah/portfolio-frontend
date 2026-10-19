# Portfolio API

Asistente de IA de [julian-lizcano.com](https://julian-lizcano.com): responde preguntas sobre el
perfil de Julian usando `knowledge/profile.md` como única fuente, con modelos vía OpenRouter.

FastAPI + httpx, respuestas en streaming (SSE). Se publica en `julian-lizcano.com/api` (mismo
origen que la web, sin CORS).

## Protección contra abuso

| Capa | Dónde |
|---|---|
| Key exclusiva con **límite de crédito** en OpenRouter (tope real de gasto) | OpenRouter |
| La key solo vive en el servidor | `app/llm.py` |
| Sesión firmada (HMAC) y, si se configura, Cloudflare Turnstile | `app/session.py`, `POST /api/chat/session` |
| Límite por IP (ráfaga y diario), tope global diario y turnos por sesión | `app/limits.py`, `app/main.py` |
| Mensajes ≤ 500 caracteres, historial recortado, `max_tokens` bajo | `app/main.py`, `app/settings.py` |
| Prompt restringido al perfil, solo español/inglés | `app/prompt.py` |

## Desarrollo

```sh
uv sync
cp .env.example .env   # rellena OPENROUTER_API_KEY y SESSION_SECRET
uv run uvicorn app.main:app_factory --factory --reload
uv run pytest && uv run ruff check .
```
