import json

from fastapi.testclient import TestClient

from app.main import create_app
from tests.test_call_qa import FakeJsonLlm
from tests.test_chat import auth, settings

TEXT = """FACTURA ELECTRÓNICA DE VENTA No. FE-1042
Papelería El Cuaderno S.A.S. NIT 900.123.456-7
Cliente: Marta Gómez CC 52.111.222
Subtotal $ 100.000
IVA 19% $ 19.000
TOTAL $ 119.000"""


def field(value, raw):
    return {"value": value, "raw": raw}


def good_result(**over):
    empty_s = field("", "")
    base = {
        "isInvoice": True,
        "currency": "cop",
        "fields": {
            "issuerName": field("Papelería El Cuaderno S.A.S.", "Papelería El Cuaderno S.A.S."),
            "issuerNit": field("900123456-7", "NIT 900.123.456-7"),
            "customerName": field("Marta Gómez", "Marta Gómez"),
            "customerId": field("52111222", "CC 52.111.222"),
            "invoiceNumber": field("FE-1042", "No. FE-1042"),
            "issueDate": empty_s,
            "dueDate": empty_s,
            "cufe": empty_s,
            "subtotal": field(100000, "$ 100.000"),
            "taxRate": field(19, "19%"),
            "tax": field(19000, "$ 19.000"),
            "total": field(119000, "$ 119.000"),
        },
        "lines": [
            {
                "description": "Cuadernos",
                "quantity": 10,
                "unitPrice": 10000,
                "total": 100000,
                "raw": "Cuadernos 10 x 10.000",
            },
        ],
        "notes": "",
    }
    return base | over


def client_with(llm, **kw):
    return TestClient(create_app(settings(**kw), llm))


def extract(c, text=TEXT, headers=None):
    return c.post(
        "/api/demos/invoice",
        json={"text": text, "lang": "es"},
        headers=headers if headers is not None else auth(c),
    )


def test_normalizes_fields_and_marks_missing_as_null():
    llm = FakeJsonLlm([json.dumps(good_result())])
    with client_with(llm) as c:
        res = extract(c)
    assert res.status_code == 200
    ex = res.json()["extraction"]
    assert ex["currency"] == "COP"
    assert ex["fields"]["total"] == {"value": 119000, "raw": "$ 119.000"}
    assert ex["fields"]["cufe"] == {"value": None, "raw": ""}
    assert ex["fields"]["issueDate"]["value"] is None
    assert ex["lines"][0]["quantity"] == 10


def test_invoice_text_is_marked_as_data():
    llm = FakeJsonLlm([json.dumps(good_result())])
    with client_with(llm) as c:
        extract(c, text="Hola    mundo\n\n\n\nFACTURA")
    system, user = llm.calls[0]
    assert "NO corrijas" in system["content"]
    assert user["content"] == "<factura>\nHola mundo\n\nFACTURA\n</factura>"


def test_requires_session_and_limits_size():
    with client_with(FakeJsonLlm(), invoice_max_chars=20) as c:
        assert extract(c, headers={}).status_code == 401
        res = extract(c)
        assert res.status_code == 422 and res.json()["detail"] == "text_too_long"


def test_daily_limit_and_refund_on_failure():
    replies = [json.dumps(good_result()) for _ in range(2)]
    with client_with(FakeJsonLlm(replies), invoice_per_ip_daily=1, invoice_burst=10) as c:
        assert extract(c).json()["remainingToday"] == 0
        assert extract(c).status_code == 429
    with client_with(FakeJsonLlm(fail=True), invoice_per_ip_daily=1) as c:
        assert extract(c).status_code == 502
        assert c.get("/api/demos/invoice/quota").json()["remainingToday"] == 1
