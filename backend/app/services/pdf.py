"""PDF-Erzeugung der Inventarliste (WeasyPrint)."""

from __future__ import annotations

import html as _html
from datetime import datetime

from weasyprint import HTML

from app.models.item import Item


def fmt_money(val: float, currency: str) -> str:
    # Deutsche Schreibweise: 1.234,56 <CUR>
    s = f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} {currency}"


def _fmt_date(dt: datetime | None) -> str:
    return dt.strftime("%d.%m.%Y") if dt else ""


def inventory_html(
    *,
    house_name: str,
    currency: str,
    groups: list[dict],
    total: float,
    total_count: int,
    filter_note: str | None,
    generated_at: datetime,
) -> str:
    """groups: [{name, items: list[Item], sum: float, count: int}]"""
    esc = _html.escape

    rows_html = []
    for g in groups:
        rows_html.append(
            f'<tr class="area"><td colspan="2">{esc(g["name"])} '
            f'<span class="count">({g["count"]})</span></td>'
            f'<td class="num">{fmt_money(g["sum"], currency)}</td></tr>'
        )
        for it in g["items"]:
            name = esc(it.name or "(unbenannt)")
            price = fmt_money(float(it.price_new), currency) if it.price_new is not None else "—"
            date = _fmt_date(it.price_determined_at) if it.price_new is not None else ""
            rows_html.append(
                f'<tr><td class="name">{name}</td>'
                f'<td class="date">{date}</td>'
                f'<td class="num">{price}</td></tr>'
            )

    note_html = f'<p class="note">{esc(filter_note)}</p>' if filter_note else ""

    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 1.8cm 1.6cm; }}
  body {{ font-family: 'DejaVu Sans', sans-serif; color: #1e293b; font-size: 11px; }}
  h1 {{ font-size: 20px; margin: 0 0 2px; }}
  .sub {{ color: #64748b; font-size: 11px; margin: 0 0 14px; }}
  .note {{ color: #6366f1; font-size: 10px; margin: 0 0 10px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; border-bottom: 1.5px solid #cbd5e1; padding: 4px 6px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }}
  th.num, td.num {{ text-align: right; }}
  td {{ padding: 4px 6px; border-bottom: 1px solid #eef2f7; }}
  tr.area td {{ background: #f1f5f9; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-top: 8px; }}
  tr.area .count {{ font-weight: 400; color: #94a3b8; }}
  td.name {{ padding-left: 14px; }}
  td.date {{ color: #94a3b8; white-space: nowrap; }}
  td.num {{ white-space: nowrap; }}
  tfoot td {{ border-top: 2px solid #334155; font-weight: 700; font-size: 13px; padding-top: 8px; }}
</style></head><body>
  <h1>{esc(house_name)} — Inventar</h1>
  <p class="sub">Erstellt am {_fmt_date(generated_at)} · {total_count} Objekte</p>
  {note_html}
  <table>
    <thead><tr><th>Objekt</th><th>Preis&nbsp;ermittelt</th><th class="num">Neupreis</th></tr></thead>
    <tbody>{''.join(rows_html)}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">{fmt_money(total, currency)}</td></tr></tfoot>
  </table>
</body></html>"""


def render_pdf(html: str) -> bytes:
    return HTML(string=html).write_pdf()
