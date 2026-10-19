"""Genera las facturas de ejemplo de la demo /demos/facturas (todas ficticias).

    uv run --no-project --with reportlab --with pymupdf --with pillow python scripts/generate-invoices.py

Salida en public/demos/facturas/: cinco PDF (uno "escaneado", es decir, solo imagen) y truth.json con
los errores que se metieron a propósito, para revisar que el validador los encuentre.
"""

import hashlib
import io
import json
import random
from datetime import date, timedelta
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageFilter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent.parent / "public" / "demos" / "facturas"
WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]


def nit_dv(nit: str) -> int:
    """Dígito de verificación de la DIAN (módulo 11)."""
    total = sum(int(d) * w for d, w in zip(reversed(nit), WEIGHTS))
    r = total % 11
    return 11 - r if r > 1 else r


def money(n: float) -> str:
    return "$ " + f"{n:,.0f}".replace(",", ".")


def dotted(nit: str) -> str:
    return f"{int(nit):,}".replace(",", ".")


INVOICES = [
    {
        "file": "factura-01-correcta.pdf",
        "issuer": ("Papelería El Cuaderno S.A.S.", "900123456", "Cra. 10 # 15-20, Girardot"),
        "customer": ("Marta Lucía Gómez", "CC", "52111222", "310 555 0101", "marta.gomez@correo-ejemplo.co", "Cl. 18 # 7-45, Girardot"),
        "number": "FEC-1042",
        "issued": date(2026, 9, 14),
        "days": 30,
        "rate": 19,
        "items": [("Cuaderno argollado 100 hojas", 10, 8500), ("Resma papel carta", 2, 21900), ("Caja de lápices x12", 3, 12400)],
        "errors": [],
    },
    {
        "file": "factura-02-suma-de-items.pdf",
        "issuer": ("Ferretería La Tuerca Ltda.", "800456789", "Av. Kennedy # 22-10, Flandes"),
        "customer": ("Construcciones Ricaurte S.A.S.", "NIT", "901234567", "601 555 0199", "compras@ricaurte-ejemplo.co", "Km 2 vía Ricaurte"),
        "number": "FT-77810",
        "issued": date(2026, 9, 20),
        "days": 15,
        "rate": 19,
        "items": [("Tornillo drywall 6x1 (caja)", 4, 18000), ("Taladro percutor 650 W", 1, 289000), ("Brocas para concreto x5", 2, 32500)],
        # El total de la segunda línea dice 298.000 en vez de 289.000: no cuadra cantidad × precio.
        "line_override": {1: 298000},
        "errors": ["line_total", "lines_sum"],
    },
    {
        "file": "factura-03-iva-mal-calculado.pdf",
        "issuer": ("Café Tokio-3 S.A.S.", "901777333", "Cl. 19 # 11-08, Girardot"),
        "customer": ("Andrés Felipe Mejía", "CC", "1070123456", "315 555 0144", "afmejia@correo-ejemplo.co", "Cra. 9 # 21-33, Girardot"),
        "number": "T3-00451",
        "issued": date(2026, 10, 2),
        "days": 0,
        "rate": 19,
        "items": [("Café de origen 500 g", 3, 32000), ("Molienda especial", 3, 4000), ("Taza cerámica", 2, 26000)],
        # El IVA se calculó con 16 % aunque la factura dice 19 %.
        "tax_rate_used": 16,
        "errors": ["tax"],
    },
    {
        "file": "factura-04-nit-y-fechas.pdf",
        "issuer": ("Soluciones NERV Tecnología S.A.S.", "901555222", "Cra. 15 # 93-60, Bogotá"),
        "customer": ("Laura Camila Rodríguez", "CC", "1013555888", "320 555 0177", "laura.rodriguez@correo-ejemplo.co", "Cl. 127 # 45-10, Bogotá"),
        "number": "NV-2026-118",
        "issued": date(2026, 10, 10),
        # Vence antes de emitirse.
        "due_override": date(2026, 9, 30),
        "rate": 19,
        "items": [("Licencia software de soporte (anual)", 1, 1200000), ("Horas de implementación", 6, 95000)],
        # Dígito de verificación equivocado.
        "dv_override": True,
        "errors": ["nit_dv", "dates"],
    },
    {
        "file": "factura-05-escaneada.pdf",
        "issuer": ("Panadería San Jorge", "79888111", "Cl. 12 # 4-55, Ricaurte"),
        "customer": ("Jorge Enrique Salazar", "CC", "11222333", "312 555 0123", "jorge.salazar@correo-ejemplo.co", "Cra. 3 # 10-20, Ricaurte"),
        "number": "PSJ-3310",
        "issued": date(2026, 10, 12),
        "days": 0,
        "rate": 5,
        "items": [("Pan tajado integral", 4, 7800), ("Torta de cumpleaños mediana", 1, 58000), ("Almojábanas x6", 2, 9500)],
        "scanned": True,
        "errors": [],
    },
]


def draw(inv: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    name, nit, address = inv["issuer"]
    dv = nit_dv(nit)
    if inv.get("dv_override"):
        dv = (dv + 3) % 10
    issued = inv["issued"]
    due = inv.get("due_override") or issued + timedelta(days=inv["days"])

    lines = []
    for i, (desc, qty, price) in enumerate(inv["items"]):
        total = inv.get("line_override", {}).get(i, qty * price)
        lines.append((desc, qty, price, total))
    subtotal = sum(q * p for _, q, p in inv["items"])  # el subtotal real, sin el error de la línea
    tax = round(subtotal * inv.get("tax_rate_used", inv["rate"]) / 100)
    total = subtotal + tax
    cufe = hashlib.sha384(f"{inv['number']}{nit}{total}".encode()).hexdigest()

    # Encabezado
    c.setFillColor(colors.HexColor("#1f2a44"))
    c.rect(0, h - 95, w, 95, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(40, h - 45, name)
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 62, f"NIT {dotted(nit)}-{dv}   ·   {address}")
    c.drawString(40, h - 77, "Responsable de IVA · Régimen común")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - 40, h - 45, "FACTURA ELECTRÓNICA DE VENTA")
    c.setFont("Helvetica", 11)
    c.drawRightString(w - 40, h - 62, f"No. {inv['number']}")

    # Datos
    c.setFillColor(colors.black)
    y = h - 125
    cname, ctype, cid, phone, email, caddr = inv["customer"]
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "CLIENTE")
    c.drawString(330, y, "DATOS DE LA FACTURA")
    c.setFont("Helvetica", 10)
    left = [cname, f"{ctype} {dotted(cid)}", f"Tel. {phone}", email, caddr]
    right = [
        f"Fecha de emisión: {issued:%d/%m/%Y}",
        f"Fecha de vencimiento: {due:%d/%m/%Y}",
        "Forma de pago: " + ("Contado" if inv.get("days", 1) == 0 else "Crédito"),
        "Medio de pago: Transferencia",
        "Moneda: COP",
    ]
    for i, (a, b) in enumerate(zip(left, right)):
        c.drawString(40, y - 16 - i * 14, a)
        c.drawString(330, y - 16 - i * 14, b)

    # Ítems
    y -= 110
    c.setFillColor(colors.HexColor("#e8ebf2"))
    c.rect(40, y - 4, w - 80, 18, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(46, y + 1, "DESCRIPCIÓN")
    c.drawRightString(360, y + 1, "CANT.")
    c.drawRightString(460, y + 1, "VALOR UNIT.")
    c.drawRightString(w - 46, y + 1, "TOTAL")
    c.setFont("Helvetica", 10)
    for desc, qty, price, ltotal in lines:
        y -= 20
        c.drawString(46, y, desc)
        c.drawRightString(360, y, str(qty))
        c.drawRightString(460, y, money(price))
        c.drawRightString(w - 46, y, money(ltotal))
    c.setStrokeColor(colors.HexColor("#c5cad6"))
    c.line(40, y - 10, w - 40, y - 10)

    # Totales
    y -= 34
    for label, value, bold in [
        ("Subtotal", money(subtotal), False),
        (f"IVA {inv['rate']}%", money(tax), False),
        ("TOTAL A PAGAR", money(total), True),
    ]:
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 11 if bold else 10)
        c.drawRightString(460, y, label)
        c.drawRightString(w - 46, y, value)
        y -= 17

    # CUFE y pie
    y -= 20
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(40, y, "CUFE:")
    c.setFont("Courier", 7.5)
    c.drawString(40, y - 11, cufe[:64])
    c.drawString(40, y - 21, cufe[64:])
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawString(40, 60, "Representación gráfica de la factura electrónica.")
    c.drawString(40, 48, "Documento ficticio generado para la demo de julian-lizcano.com. No tiene validez fiscal.")

    # Marca de agua
    c.saveState()
    c.setFillColor(colors.HexColor("#d0021b"), alpha=0.12)
    c.setFont("Helvetica-Bold", 54)
    c.translate(w / 2, h / 2 - 40)
    c.rotate(32)
    c.drawCentredString(0, 0, "EJEMPLO FICTICIO")
    c.restoreState()

    c.showPage()
    c.save()
    return buf.getvalue()


def scan(pdf: bytes) -> bytes:
    """Convierte el PDF en una imagen con algo de ruido y rotación, como si se hubiera escaneado."""
    page = fitz.open(stream=pdf, filetype="pdf")[0]
    pix = page.get_pixmap(dpi=150)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples).convert("L")
    rnd = random.Random(7)
    img = img.rotate(0.8, expand=False, fillcolor=255, resample=Image.BICUBIC)
    noise = Image.effect_noise(img.size, 18)
    img = Image.blend(img, noise, 0.06).filter(ImageFilter.GaussianBlur(0.5))
    img = img.point(lambda v: min(255, v + rnd.randint(0, 2)))
    jpg = io.BytesIO()
    img.save(jpg, "JPEG", quality=70)
    out = fitz.open()
    p = out.new_page(width=page.rect.width, height=page.rect.height)
    p.insert_image(p.rect, stream=jpg.getvalue())
    return out.tobytes(deflate=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    truth = {}
    for inv in INVOICES:
        pdf = draw(inv)
        if inv.get("scanned"):
            pdf = scan(pdf)
        (OUT / inv["file"]).write_bytes(pdf)
        truth[inv["file"]] = inv["errors"]
        print(f"{inv['file']}: {len(pdf) // 1024} KB, errores esperados: {inv['errors'] or 'ninguno'}")
    (OUT / "truth.json").write_text(json.dumps(truth, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
