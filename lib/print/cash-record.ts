"use client"

/**
 * The cash drawer record on paper: who opened and closed, the count by notes
 * and coins, the breakdown the books computed, the difference, and every
 * operation in order. An A4/A5 page, not a roll — this is a document the
 * owner files, signed by whoever counted.
 */
import { toast } from "sonner"

import { cashDrawerDetail, DENOMINATIONS, type CashSession } from "@/api/cash-drawer"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { printDocument } from "@/lib/print/receipt"
import { loadPrintSettings } from "@/lib/print/settings"

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "—"
const when = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${time(iso)}` : "—")

const KIND: Record<string, string> = { sale: "بيع", return: "إرجاع", refund: "استرجاع", in: "إدخال نقد", out: "إخراج نقد" }
const PAY: Record<string, string> = { cash: "نقدي", card: "بطاقة", debt: "دين" }

function countsTable(c: Record<string, number | undefined> | undefined): string {
  const rows = DENOMINATIONS.filter((d) => Number(c?.[d]) > 0)
  if (!rows.length) return `<p class="muted">أُدخل المبلغ دون تفصيل الفئات.</p>`
  return `<table class="t"><thead><tr><th>الفئة</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>${rows
    .map((d) => `<tr><td>${d} ₪</td><td>${formatNumber(Number(c![d]))}</td><td>${esc(formatMoney(Number(d) * Number(c![d])))}</td></tr>`)
    .join("")}</tbody></table>`
}

export function cashRecordHtml(s: CashSession, storeName: string): string {
  const f = s.figures
  const diff = toNumber(s.difference ?? "0")
  const cardDiff = s.card_difference != null ? toNumber(s.card_difference) : null
  const line = (k: string, v: string | number | undefined, sign = "") =>
    v == null ? "" : `<tr><td>${esc(k)}</td><td class="n">${sign}${esc(formatMoney(v))}</td></tr>`
  const ops = (s.operations ?? [])
    .map(
      (o) => `<tr><td>${esc(time(o.at))}</td><td>${esc(KIND[o.kind] ?? o.kind)}</td><td>${esc(PAY[o.payment] ?? o.payment)}</td><td>${esc(o.ref)}</td><td>${esc(o.customer || o.note)}</td><td>${esc(o.who)}</td><td class="n ${toNumber(o.amount) < 0 ? "neg" : ""}">${esc(formatMoney(o.amount))}</td></tr>`,
    )
    .join("")
  return `
  <header><h1>${esc(storeName)}</h1><h2>سجل الصندوق رقم ${s.id}</h2></header>
  <section class="who">
    <div><b>فُتح</b> ${esc(when(s.opened_at))}<br><span class="muted">بواسطة</span> ${esc(s.opened_by || "—")}</div>
    <div><b>أُغلق</b> ${esc(when(s.closed_at))}<br><span class="muted">بواسطة</span> ${esc(s.closed_by || "—")}</div>
  </section>
  <section class="cols">
    <div><h3>الفكّة عند الفتح — ${esc(formatMoney(s.opening_amount))}</h3>${countsTable(s.opening_counts)}</div>
    <div><h3>المعدود عند الإغلاق — ${esc(formatMoney(s.counted_amount ?? "0"))}</h3>${countsTable(s.closing_counts)}</div>
  </section>
  ${f ? `<section class="cols">
    <div><h3>حساب الصندوق</h3><table class="t">
      ${line("بداية الصندوق", f.opening)}
      ${line(`مبيعات نقدية (${formatNumber(f.cash_tickets)} فاتورة)`, f.cash_sales, "+ ")}
      ${line("مرتجعات نقدية", f.refunds, "− ")}
      ${line("إدخال نقد", f.put_in, "+ ")}
      ${line("إخراج نقد", f.took_out, "− ")}
      <tr class="tot"><td>يجب أن يكون في الصندوق</td><td class="n">${esc(formatMoney(s.expected_amount ?? f.expected))}</td></tr>
      <tr><td>المعدود</td><td class="n">${esc(formatMoney(s.counted_amount ?? "0"))}</td></tr>
      <tr class="tot ${Math.abs(diff) < 0.005 ? "ok" : "bad"}"><td>الفرق</td><td class="n">${Math.abs(diff) < 0.005 ? "مطابق" : (diff < 0 ? "ينقص " : "يزيد ") + esc(formatMoney(Math.abs(diff)))}</td></tr>
    </table></div>
    <div><h3>البطاقة والمبيعات</h3><table class="t">
      ${line(`مبيعات البطاقة (${formatNumber(f.card_tickets)} فاتورة)`, f.card_sales)}
      ${f.card_refunds && toNumber(f.card_refunds) > 0 ? line("مرتجعات بالبطاقة", f.card_refunds, "− ") : ""}
      ${s.card_counted != null ? line("مجموع جهاز البطاقة", s.card_counted) : ""}
      ${cardDiff != null ? `<tr class="tot ${Math.abs(cardDiff) < 0.005 ? "ok" : "bad"}"><td>فرق البطاقة</td><td class="n">${Math.abs(cardDiff) < 0.005 ? "مطابق" : (cardDiff < 0 ? "ينقص " : "يزيد ") + esc(formatMoney(Math.abs(cardDiff)))}</td></tr>` : ""}
      ${f.debt_sales && toNumber(f.debt_sales) > 0 ? line(`على الحساب (${formatNumber(f.debt_tickets ?? 0)} فاتورة)`, f.debt_sales) : ""}
      ${f.total_sales != null ? `<tr class="tot"><td>إجمالي المبيعات (${formatNumber(f.tickets ?? 0)} فاتورة)</td><td class="n">${esc(formatMoney(f.total_sales))}</td></tr>` : ""}
    </table></div>
  </section>` : ""}
  ${s.note ? `<p class="note">ملاحظة: ${esc(s.note)}</p>` : ""}
  ${ops ? `<section><h3>العمليات (${formatNumber(s.operations!.length)})</h3>
    <table class="t ops"><thead><tr><th>الوقت</th><th>النوع</th><th>الدفع</th><th>الفاتورة</th><th>الزبون / السبب</th><th>الموظف</th><th>المبلغ</th></tr></thead><tbody>${ops}</tbody></table></section>` : ""}
  <footer><div>توقيع من فتح: ______________</div><div>توقيع من أغلق: ______________</div><div>توقيع المالك: ______________</div></footer>`
}

export const CASH_RECORD_STYLES = `
  @page { size: A4; margin: 14mm }
  body { font-family: "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif; color: #111; font-size: 12px; line-height: 1.5; margin: 0 }
  header { text-align: center; margin-bottom: 10px } h1 { font-size: 20px; margin: 0 } h2 { font-size: 14px; margin: 2px 0 0; font-weight: 600; color: #444 }
  h3 { font-size: 13px; margin: 0 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px }
  .who { display: flex; gap: 24px; justify-content: space-between; border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px }
  .t { width: 100%; border-collapse: collapse } .t th, .t td { padding: 3px 6px; border-bottom: 1px solid #e5e5e5; text-align: right; vertical-align: top }
  .t th { font-weight: 600; color: #555; font-size: 11px } .n { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap }
  .tot td { font-weight: 700; border-top: 1px solid #999 } .ok td { color: #0a6b3a } .bad td { color: #b3261e } .neg { color: #b3261e }
  .muted { color: #666 } .note { margin: 6px 0 12px; font-style: italic }
  .ops td { font-size: 11px }
  footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; font-size: 12px }
  section { page-break-inside: avoid }
`

/** Fetch the record and print it the way receipts print on this till. */
export async function printCashRecord(id: number, storeName = "الصندوق"): Promise<void> {
  try {
    const r = await cashDrawerDetail(id)
    const s = r.data
    const settings = loadPrintSettings()
    const name = settings.pharmacyName?.trim() || storeName
    const outcome = await printDocument(cashRecordHtml(s, name), CASH_RECORD_STYLES, `سجل الصندوق ${id}`, settings.deliver)
    if (outcome === "downloaded") toast.success("نُزّل سجل الصندوق كملف")
    else if (outcome === "unavailable") toast.error("تعذّرت الطباعة من هذا الجهاز — نُزّل السجل كملف")
  } catch (e) {
    toast.error(e instanceof Error && e.message ? e.message : "تعذّر تحميل السجل")
  }
}
