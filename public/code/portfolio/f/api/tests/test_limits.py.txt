from app.limits import UsageLimiter


class FakeClock:
    def __init__(self, t: float = 1_800_000_000) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def make(clock: FakeClock, **kw) -> UsageLimiter:
    opts = {"burst": 3, "burst_window": 60, "ip_daily": 5, "global_daily": 8} | kw
    return UsageLimiter(clock=clock, **opts)


def test_burst_per_ip_and_recovery():
    clock = FakeClock()
    limiter = make(clock)
    assert all(limiter.check("1.1.1.1").allowed for _ in range(3))
    verdict = limiter.check("1.1.1.1")
    assert not verdict.allowed and verdict.reason == "ip_burst" and verdict.retry_after > 0
    assert limiter.check("2.2.2.2").allowed  # otra IP no se ve afectada
    clock.t += 61
    assert limiter.check("1.1.1.1").allowed


def test_daily_limit_per_ip():
    clock = FakeClock()
    limiter = make(clock, burst=100)
    for _ in range(5):
        assert limiter.check("1.1.1.1").allowed
    assert limiter.check("1.1.1.1").reason == "ip_daily"


def test_global_daily_limit_and_reset_next_day():
    clock = FakeClock()
    limiter = make(clock, burst=100, ip_daily=100)
    for i in range(8):
        assert limiter.check(f"10.0.0.{i}").allowed
    assert limiter.check("10.0.0.99").reason == "global_daily"
    clock.t += 86400
    assert limiter.check("10.0.0.99").allowed


def test_rejected_messages_do_not_count():
    clock = FakeClock()
    limiter = make(clock, burst=1, ip_daily=2)
    assert limiter.check("1.1.1.1").allowed
    for _ in range(5):
        assert limiter.check("1.1.1.1").reason == "ip_burst"
    clock.t += 61
    assert limiter.check("1.1.1.1").allowed  # los rechazos no gastaron el cupo diario
