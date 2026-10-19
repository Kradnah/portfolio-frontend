from app.session import SessionSigner

SECRET = "x" * 32


def test_issue_and_verify():
    signer = SessionSigner(SECRET, 60)
    assert signer.verify(signer.issue())


def test_rejects_tampered_or_foreign_tokens():
    signer = SessionSigner(SECRET, 60)
    payload, signature = signer.issue().split(".")
    assert signer.verify(f"{payload}x.{signature}") is None
    assert SessionSigner("y" * 32, 60).verify(signer.issue()) is None
    assert signer.verify("basura") is None


def test_rejects_expired_tokens():
    now = [1000.0]
    signer = SessionSigner(SECRET, 60, clock=lambda: now[0])
    token = signer.issue()
    now[0] += 61
    assert signer.verify(token) is None
