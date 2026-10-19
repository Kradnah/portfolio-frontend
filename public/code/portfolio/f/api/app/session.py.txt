"""Tokens de sesión del chat: `<payload base64url>.<firma HMAC-SHA256>`.

La sesión se obtiene una vez (tras pasar Turnstile, si está configurado) y acompaña cada mensaje.
Además limita el número de turnos por conversación.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class SessionSigner:
    def __init__(self, secret: str, ttl_seconds: int, clock=time.time) -> None:
        self._key = secret.encode()
        self.ttl = ttl_seconds
        self.clock = clock

    def issue(self) -> str:
        payload = _b64(
            json.dumps(
                {"sid": secrets.token_urlsafe(12), "exp": int(self.clock()) + self.ttl}
            ).encode()
        )
        return f"{payload}.{self._sign(payload)}"

    def verify(self, token: str) -> str | None:
        """Devuelve el id de sesión si el token es válido y no ha caducado."""
        try:
            payload, signature = token.split(".", 1)
            if not hmac.compare_digest(signature, self._sign(payload)):
                return None
            data = json.loads(_unb64(payload))
            if int(data["exp"]) < self.clock():
                return None
            return str(data["sid"])
        except (ValueError, KeyError, TypeError):
            return None

    def _sign(self, payload: str) -> str:
        return _b64(hmac.new(self._key, payload.encode(), hashlib.sha256).digest())
