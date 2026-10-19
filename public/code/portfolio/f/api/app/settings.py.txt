from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración por variables de entorno. Si falta algo obligatorio, la app no arranca."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: SecretStr
    openrouter_model: str = "google/gemini-2.5-flash-lite"
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    # Razonamiento de los modelos que lo soportan (DeepSeek, Gemini 3, GPT-5...). Apagado: para
    # responder sobre un CV no hace falta y gastaría parte de max_tokens y del presupuesto.
    openrouter_reasoning: bool = False
    # Atribución de la app en OpenRouter (cabeceras HTTP-Referer y X-Title).
    public_url: str = "https://julian-lizcano.com"

    # Firma de los tokens de sesión del chat (HMAC-SHA256). Mínimo 32 caracteres.
    session_secret: SecretStr = Field(min_length=32)
    session_ttl_seconds: int = 3600

    # Cloudflare Turnstile. Sin secreto, las sesiones se emiten sin desafío.
    turnstile_secret: SecretStr | None = None

    # true detrás de Traefik: la IP real es la última de X-Forwarded-For.
    trust_proxy: bool = False

    # Límites de uso. El tope real de gasto lo pone el límite de crédito de la key en OpenRouter.
    max_tokens: int = 400
    max_message_chars: int = 500
    max_turns: int = 10
    per_ip_burst: int = 8
    per_ip_burst_window_seconds: int = 600
    per_ip_daily: int = 40
    global_daily: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
