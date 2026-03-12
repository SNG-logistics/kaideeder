"""
receipt_generator.py
────────────────────
สร้างใบเสร็จ HTML จาก JSON ข้อมูลออเดอร์
รองรับ: ไทย / ลาว, QR Code, โลโก้, หัวบิล / ท้ายบิล

ติดตั้ง dependencies:
    pip install jinja2 qrcode[pil] pillow

ใช้งาน:
    python receipt_generator.py order.json
    python receipt_generator.py order.json --out my_receipt.html
    python receipt_generator.py order.json --open   (เปิด browser อัตโนมัติ)
"""

from __future__ import annotations
import argparse
import base64
import json
import os
import sys
import webbrowser
from io import BytesIO
from pathlib import Path
from datetime import datetime

try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
except ImportError:
    sys.exit("❌  กรุณาติดตั้ง: pip install jinja2")

try:
    import qrcode
    from PIL import Image
except ImportError:
    sys.exit("❌  กรุณาติดตั้ง: pip install qrcode[pil] pillow")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def img_to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    """แปลง PIL Image → base64 data URI"""
    buf = BytesIO()
    img.save(buf, format=fmt)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def file_to_b64(path: str) -> str | None:
    """อ่านไฟล์รูปจาก path → base64 data URI (คืน None ถ้าไม่พบ)"""
    p = Path(path)
    if not p.exists():
        return None
    mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
    data = base64.b64encode(p.read_bytes()).decode()
    return f"data:{mime};base64,{data}"


def make_qr(text: str, size: int = 200) -> str:
    """สร้าง QR จาก text → base64 data URI"""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size), Image.LANCZOS)
    return img_to_b64(img)


def fmt_currency(amount: float, currency: str = "₭") -> str:
    """จัดรูปแบบตัวเงิน"""
    formatted = f"{amount:,.0f}"
    return f"{formatted} {currency}"


# ─── Main Generator ───────────────────────────────────────────────────────────

def generate_receipt(data: dict, output_path: str | None = None, auto_open: bool = False) -> str:
    """
    สร้าง HTML ใบเสร็จจากข้อมูล dict
    คืน path ของไฟล์ที่สร้าง
    """
    store = data.get("store", {})
    order = data.get("order", {})

    # ── QR Code ──────────────────────────────────────────────
    qr_url = order.get("qr_url", order.get("number", "NO-ORDER"))
    qr_b64 = make_qr(qr_url)

    # ── Logo ─────────────────────────────────────────────────
    logo_path = store.get("logo_path", "")
    logo_b64 = file_to_b64(logo_path) if logo_path else None

    # ── Currency ─────────────────────────────────────────────
    currency = store.get("currency", "₭")

    # ── Items total ───────────────────────────────────────────
    items = order.get("items", [])
    for item in items:
        if "subtotal" not in item:
            item["subtotal"] = item.get("qty", 0) * item.get("price", 0)

    # ── Prepare context ───────────────────────────────────────
    ctx = {
        "store": store,
        "order": order,
        "items": items,
        "qr_b64": qr_b64,
        "logo_b64": logo_b64,
        "currency": currency,
        "fmt": lambda n: fmt_currency(float(n), currency),
        "now": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "LINE": "=" * 32,
        "DASH": "-" * 32,
    }

    # ── Render template ───────────────────────────────────────
    template_dir = Path(__file__).parent
    env = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(["html"]),
    )
    # Register fmt as global (Jinja2 won't accept lambda in autoescape easily)
    env.globals["fmt_currency"] = lambda n: fmt_currency(float(n), currency)

    template = env.get_template("receipt_template.html.j2")
    html = template.render(**ctx)

    # ── Write output ─────────────────────────────────────────
    out = output_path or f"receipt_{order.get('number', 'output').replace('/', '-')}.html"
    Path(out).write_text(html, encoding="utf-8")
    print(f"✅ สร้างใบเสร็จ: {out}")

    if auto_open:
        webbrowser.open("file://" + os.path.abspath(out))

    return out


# ─── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="สร้างใบเสร็จ HTML จากไฟล์ JSON"
    )
    parser.add_argument("json_file", help="ไฟล์ JSON ข้อมูลออเดอร์ (ดูตัวอย่าง order_sample.json)")
    parser.add_argument("--out", "-o", help="ชื่อไฟล์ output (.html)")
    parser.add_argument("--open", action="store_true", help="เปิด browser อัตโนมัติหลังสร้าง")
    args = parser.parse_args()

    json_path = Path(args.json_file)
    if not json_path.exists():
        sys.exit(f"❌ ไม่พบไฟล์: {args.json_file}")

    data = json.loads(json_path.read_text(encoding="utf-8"))
    generate_receipt(data, output_path=args.out, auto_open=args.open)


if __name__ == "__main__":
    main()
