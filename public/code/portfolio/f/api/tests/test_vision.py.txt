import base64
import json

from fastapi.testclient import TestClient

from app.main import create_app
from tests.test_call_qa import FakeJsonLlm
from tests.test_chat import auth, settings

JPEG = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 100).decode()


def result(**over):
    base = {
        "inHand": "Una taza morada con el logo de NERV",
        "description": "Una persona sostiene una taza frente a la cámara.",
        "objects": ["taza", "monitor", "", "silla"],
        "funFact": "La primera taza con asa data de hace más de 5.000 años.",
        "safe": True,
    }
    return base | over


def client_with(llm, **kw):
    return TestClient(create_app(settings(**kw), llm))


def ask(c, image=JPEG, headers=None, detected=None):
    return c.post(
        "/api/demos/vision",
        json={"image": image, "lang": "es", "detected": detected or ["cup"]},
        headers=headers if headers is not None else auth(c),
    )


def test_describes_and_normalizes():
    llm = FakeJsonLlm([json.dumps(result())])
    with client_with(llm) as c:
        res = ask(c)
    assert res.status_code == 200
    body = res.json()["result"]
    assert body["inHand"].startswith("Una taza")
    assert body["objects"] == ["taza", "monitor", "silla"]
    system, user = llm.calls[0]
    assert "cup" in system["content"] and "no intentes identificarla" in system["content"]
    assert user["content"][1]["image_url"]["url"] == JPEG


def test_unsafe_image_returns_empty_fields():
    llm = FakeJsonLlm([json.dumps(result(safe=False))])
    with client_with(llm) as c:
        body = ask(c).json()["result"]
    assert body == {"safe": False, "inHand": "", "description": "", "objects": [], "funFact": ""}


def test_rejects_non_images_and_large_images():
    with client_with(FakeJsonLlm()) as c:
        assert ask(c, image="data:text/plain;base64,aG9sYQ==").json()["detail"] == "image_format"
        fake = "data:image/jpeg;base64," + base64.b64encode(b"no es un jpeg").decode()
        assert ask(c, image=fake).json()["detail"] == "image_format"
        big = (
            "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"0" * 210_000).decode()
        )
        assert ask(c, image=big).status_code == 422


def test_requires_session_and_limits_per_day():
    replies = [json.dumps(result()) for _ in range(2)]
    with client_with(FakeJsonLlm(replies), vision_per_ip_daily=1, vision_burst=10) as c:
        assert ask(c, headers={}).status_code == 401
        assert ask(c).json()["remainingToday"] == 0
        assert ask(c).status_code == 429
