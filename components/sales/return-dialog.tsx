"use client"

/* إرجاع — one line handed back over the counter.
 *
 * A decision, so a dialog (objects open in drawers; decisions stay dialogs).
 * The drink was made, so its cost stays booked as waste whatever is chosen
 * here; the choice is only about the customer's money:
 *   استرداد المبلغ — they get this line's share of what they paid back, and
 *                    the points it earned are taken back in proportion;
 *   إعادة تحضير   — they get a fresh one; no money moves.
 * Works offline: the return waits on this device and syncs after the sale. */
import { useState } from "react"
import { Loader2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { RETURN_REASONS, saleItemName, type ReturnReason, type Sale, type SaleItem } from "@/api/sales"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { formatMoney, toNumber } from "@/lib/format"
import { sendOrQueue } from "@/lib/offline/outbox"
import { uuid } from "@/lib/offline/queue"
import { cn } from "@/lib/utils"

/** This line's share of what was actually paid, for `qty` units. Mirrors the
 *  server (cafe_api.record_return) so the number shown is the number booked. */
export function refundFor(sale: Sale, line: SaleItem, qty: number): number {
  const total = toNumber(sale.total)
  if (!(total > 0) || !(toNumber(line.quantity) > 0)) return 0
  const share = (toNumber(line.line_total) / total) * (qty / toNumber(line.quantity))
  return Math.round(toNumber(sale.discounted_total) * share * 100) / 100
}

export function remainingQty(line: SaleItem): number {
  return Math.max(0, toNumber(line.quantity) - toNumber(line.returned_quantity))
}

export function ReturnDialog({
  sale,
  line,
  onClose,
  onDone,
}: {
  sale: Sale
  line: SaleItem | null
  onClose: () => void
  onDone: (updated: Sale | null) => void
}) {
  const [qty, setQty] = useState(1)
  const [refund, setRefund] = useState<"full" | "none">("full")
  const [reason, setReason] = useState<ReturnReason | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState(() => uuid())
  const [seen, setSeen] = useState<number | null>(null)

  if (line && seen !== line.id) {
    setSeen(line.id ?? null)
    setQty(1)
    setRefund("full")
    setReason(null)
    setNote("")
    setKey(uuid())
  }
  if (!line && seen !== null) setSeen(null)

  const max = line ? remainingQty(line) : 0
  const amount = line && refund === "full" ? refundFor(sale, line, qty) : 0

  async function confirm() {
    if (!line?.id) return
    if (!reason) return toast.error("اختر سبب الإرجاع")
    setBusy(true)
    try {
      const res = await sendOrQueue<Sale>(
        "return",
        `/api/v1/sales/${sale.id}/returns/`,
        {
          sale_item: line.id,
          quantity: String(qty),
          refund,
          reason,
          note: note.trim(),
          client_uuid: key,
        },
        `إرجاع: ${saleItemName(line)}`,
      )
      if (res.status === "sent") {
        toast.success(refund === "full" ? `سُجّل الإرجاع — أعد للزبون ${formatMoney(amount)}` : "سُجّلت إعادة التحضير")
        onDone(res.data)
      } else {
        toast.success("سُجّل الإرجاع على الجهاز — يُرفع عند عودة الاتصال")
        onDone(null)
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تسجيل الإرجاع")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={line != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2 font-heading">
          <Undo2 className="size-5 text-primary" />
          إرجاع: {line ? saleItemName(line) : ""}
        </DialogTitle>

        {line ? (
          <div className="space-y-4">
            {max > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">الكمية</span>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
                  <span className="w-8 text-center font-heading text-lg font-bold tabular-nums">{qty}</span>
                  <Button size="icon-sm" variant="outline" onClick={() => setQty((q) => Math.min(max, q + 1))}>+</Button>
                  <span className="ms-1 text-xs text-muted-foreground">من {max}</span>
                </div>
              </div>
            ) : null}

            <SegmentedControl
              className="w-full"
              options={[
                { value: "full", label: "استرداد المبلغ" },
                { value: "none", label: "إعادة تحضير" },
              ]}
              value={refund}
              onChange={setRefund}
            />

            <div>
              <p className="mb-1.5 text-sm">السبب</p>
              <div className="flex flex-wrap gap-1.5">
                {RETURN_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      reason === r.value ? "bg-primary text-primary-foreground" : "clay-chip text-muted-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {reason === "other" || note ? (
                <Input className="mt-2" placeholder="ملاحظة…" value={note} onChange={(e) => setNote(e.target.value)} />
              ) : null}
            </div>

            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              {refund === "full" ? (
                <p>
                  يُعاد للزبون <b className="font-heading text-base tabular-nums">{formatMoney(amount)}</b>
                  {sale.customer ? <span className="text-xs text-muted-foreground"> · وتُخصم نقاط هذا الصنف من رصيده</span> : null}
                </p>
              ) : (
                <p>لا يُعاد مبلغ — يحضَّر المشروب من جديد.</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">تكلفة المشروب تبقى محسوبة كهدر، لأنه حُضّر.</p>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy || !reason} onClick={confirm}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                تأكيد الإرجاع
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
