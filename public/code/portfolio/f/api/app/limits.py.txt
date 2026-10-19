"""Límites de uso en memoria.

La API corre con un solo proceso, así que basta con estructuras en memoria; si se reinicia, los
contadores vuelven a cero (aceptable: el tope de gasto real es el límite de crédito de la key).
"""

import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Bogotá: UTC-5 todo el año (sin horario de verano). El día de uso se reinicia a medianoche local.
TZ = timezone(timedelta(hours=-5))


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    reason: str | None = None
    retry_after: int = 0


class UsageLimiter:
    def __init__(
        self,
        *,
        burst: int,
        burst_window: int,
        ip_daily: int,
        global_daily: int,
        clock=time.time,
    ) -> None:
        self.burst = burst
        self.burst_window = burst_window
        self.ip_daily = ip_daily
        self.global_daily = global_daily
        self.clock = clock
        self._recent: dict[str, deque[float]] = {}
        self._daily: dict[str, int] = {}
        self._global = 0
        self._day = self._today()

    def check(self, ip: str) -> Verdict:
        """Comprueba y, si se permite, registra un mensaje de `ip`."""
        now = self.clock()
        self._roll_day()

        if self._global >= self.global_daily:
            return Verdict(False, "global_daily", self._seconds_to_midnight())
        if self._daily.get(ip, 0) >= self.ip_daily:
            return Verdict(False, "ip_daily", self._seconds_to_midnight())

        window = self._recent.setdefault(ip, deque())
        while window and window[0] <= now - self.burst_window:
            window.popleft()
        if len(window) >= self.burst:
            return Verdict(False, "ip_burst", int(window[0] + self.burst_window - now) + 1)

        window.append(now)
        self._daily[ip] = self._daily.get(ip, 0) + 1
        self._global += 1
        return Verdict(True)

    def _today(self) -> str:
        return datetime.fromtimestamp(self.clock(), TZ).date().isoformat()

    def _roll_day(self) -> None:
        today = self._today()
        if today != self._day:
            self._day = today
            self._daily.clear()
            self._recent.clear()
            self._global = 0

    def _seconds_to_midnight(self) -> int:
        now = datetime.fromtimestamp(self.clock(), TZ)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() + 86400
        return int(midnight - now.timestamp()) + 1
