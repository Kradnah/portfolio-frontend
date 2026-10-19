import json

from fastapi.testclient import TestClient

from app.llm import LlmError
from app.main import create_app
from tests.test_chat import auth, settings

SEGMENTS = [
    {"start": 0, "end": 4, "text": "Buenas tardes, le habla Laura de RedMagi."},
    {"start": 4, "end": 7, "text": "Hola, con Andrés."},
    {"start": 7, "end": 12, "text": "¿Me confirma la cédula del titular?"},
]


def good_result(**over):
    base = {
        "isServiceCall": True,
        "callType": "support",
        "summary": "El cliente reporta una falla y la asesora la resuelve.",
        "customerSentiment": "positive",
        # el segmento 2 falta y el 7 no existe: quedan como "unknown" / se ignoran
        "roles": [
            {"segment": 0, "role": "agent"},
            {"segment": 1, "role": "customer"},
            {"segment": 7, "role": "agent"},
        ],
        "criteria": [
            {
                "key": "greeting",
                "score": 5,
                "comment": "Saluda bien.",
                "evidence": [{"segment": 0, "quote": "le habla Laura"}],
            },
            {
                "key": "verification",
                "score": 9,
                "comment": "Valida.",
                "evidence": [{"segment": 99, "quote": "inventada"}],
            },
            {"key": "greeting", "score": 0, "comment": "duplicado", "evidence": []},
            {"key": "inventado", "score": 3, "comment": "no existe", "evidence": []},
        ],
        "alerts": [{"severity": "medium", "text": "Nada grave.", "segment": 42}],
        "feedback": ["Mantener el tono.", "", "Ofrecer número de caso."],
    }
    return base | over


class FakeJsonLlm:
    def __init__(self, replies=None, fail=False):
        self.replies = list(replies or [json.dumps(good_result())])
        self.fail = fail
        self.calls = []

    async def stream(self, messages):  # pragma: no cover - no se usa aquí
        yield ""

    async def complete_json(self, messages, schema, *, max_tokens):
        self.calls.append(messages)
        if self.fail:
            raise LlmError("caído")
        return self.replies.pop(0), {"prompt_tokens": 100, "completion_tokens": 50}


def client_with(llm, **kw):
    return TestClient(create_app(settings(**kw), llm))


def analyze(c, segments=SEGMENTS, headers=None, lang="es"):
    return c.post(
        "/api/demos/call-qa",
        json={"segments": segments, "lang": lang},
        headers=headers if headers is not None else auth(c),
    )


def test_normalizes_model_output():
    llm = FakeJsonLlm()
    with client_with(llm) as c:
        res = analyze(c)
    assert res.status_code == 200
    a = res.json()["analysis"]
    assert [x["key"] for x in a["criteria"]] == ["greeting", "verification"]
    assert a["criteria"][1]["score"] == 5  # acotado a 0..5
    assert a["criteria"][1]["evidence"] == []  # el segmento 99 no existe
    assert a["overall"] == 100
    assert a["roles"] == ["agent", "customer", "unknown"]
    assert a["alerts"][0]["segment"] == -1
    assert a["feedback"] == ["Mantener el tono.", "Ofrecer número de caso."]


def test_transcript_is_marked_as_data_and_language_requested():
    llm = FakeJsonLlm()
    with client_with(llm) as c:
        analyze(c, lang="en")
    system, user = llm.calls[0]
    assert "inglés" in system["content"]
    assert user["content"].startswith("<transcripcion>") and "[2] (00:07)" in user["content"]


def test_requires_session():
    with client_with(FakeJsonLlm()) as c:
        assert analyze(c, headers={}).status_code == 401


def test_rejects_long_audio_and_long_text():
    with client_with(FakeJsonLlm(), call_qa_max_seconds=60, call_qa_max_chars=50) as c:
        long_audio = [{"start": 0, "end": 90, "text": "hola"}]
        assert analyze(c, long_audio).json()["detail"] == "audio_too_long"
        assert analyze(c).json()["detail"] == "transcript_too_long"


def test_daily_limit_per_ip_and_quota():
    replies = [json.dumps(good_result()) for _ in range(3)]
    with client_with(FakeJsonLlm(replies), call_qa_per_ip_daily=2, call_qa_burst=10) as c:
        assert c.get("/api/demos/call-qa/quota").json()["remainingToday"] == 2
        assert analyze(c).json()["remainingToday"] == 1
        assert analyze(c).json()["remainingToday"] == 0
        res = analyze(c)
        assert res.status_code == 429 and res.json()["detail"] == "ip_daily"


def test_retries_once_on_invalid_json_then_succeeds():
    llm = FakeJsonLlm(["no es json", json.dumps(good_result())])
    with client_with(llm) as c:
        assert analyze(c).status_code == 200
    assert len(llm.calls) == 2


def test_llm_failure_returns_502_and_refunds_quota():
    with client_with(FakeJsonLlm(fail=True), call_qa_per_ip_daily=1) as c:
        res = analyze(c)
        assert res.status_code == 502 and res.json()["detail"] == "analysis_unavailable"
        assert c.get("/api/demos/call-qa/quota").json()["remainingToday"] == 1


def test_not_a_service_call_has_no_overall():
    llm = FakeJsonLlm([json.dumps(good_result(isServiceCall=False, callType="other"))])
    with client_with(llm) as c:
        assert analyze(c).json()["analysis"]["overall"] is None
