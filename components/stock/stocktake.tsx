"use client"

/* جرد — what is actually on the shelf. Blank = not counted, left alone. */
import { useState } from "react"
import { AlertTriangle, ClipboardCheck, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { formatQty, recordStocktake, toBase, unitsFor, UNIT_LABEL, type BuyUnit, type InventoryItem } from "@/api/inventory"
import { FormModal } from "@/components/form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uuid } from "@/lib/offline/queue"
import { formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/* ── جرد ────────────────────────────────────────────────────────────── */
export function Stocktake({
  open,
  onClose,
  items,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  items: InventoryItem[]
  onSaved: () => void
}) {
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [units, setUnits] = useState<Record<number, BuyUnit>>({})
  const [saving, setSaving] = useState(false)
  const [key] = useState(() => uuid())

  const unitOf = (i: InventoryItem): BuyUnit => units[i.id] ?? unitsFor(i.unit)[unitsFor(i.unit).length - 1]
  const filled = items.filter((i) => counts[i.id] != null && counts[i.id] !== "")

  async function save() {
    if (!filled.length) return toast.error("أدخل عدداً واحداً على الأقل")
    setSaving(true)
    try {
      const r = await recordStocktake({
        counts: filled.map((i) => ({ item: i.id, counted: String(toBase(toNumber(counts[i.id]), unitOf(i))) })),
        client_uuid: `${key}-${filled.length}`,
      })
      toast.success(r.data.moves ? `حُدّث ${formatNumber(r.data.moves)} صنف` : "لا فروقات — كل شيء مطابق")
      setCounts({})
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="جرد المخزون"
      icon={<ClipboardCheck className="size-4.5" />}
      size="lg"
      footer={
        <>
          <Button type="button" className="bg-brand-gradient flex-1" disabled={saving || !filled.length} data-form-primary onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ الجرد ({formatNumber(filled.length)})
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <p className="flex items-start gap-1.5 rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        اكتب ما تجده فعلاً على الرف. اترك الخانة فارغة لصنف لم تعدّه — لن يتغير.
      </p>
      <ul className="divide-y divide-border/60">
        {items.map((i) => {
          const u = unitOf(i)
          const v = counts[i.id] ?? ""
          const diff = v !== "" ? toBase(toNumber(v), u) - toNumber(i.stock) : null
          return (
            <li key={i.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  النظام: {formatQty(i.stock, i.unit)}
                  {diff != null && diff !== 0 ? (
                    <span className={cn("ms-1.5 font-semibold", diff < 0 ? "text-rose-600" : "text-emerald-600")} dir="ltr">
                      {diff > 0 ? "+" : "−"}
                      {formatQty(Math.abs(diff), i.unit)}
                    </span>
                  ) : null}
                </p>
              </div>
              <Input
                inputMode="decimal"
                dir="ltr"
                className="h-9 w-24 text-end"
                value={v}
                onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))}
              />
              {unitsFor(i.unit).length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const list = unitsFor(i.unit)
                    setUnits((m) => ({ ...m, [i.id]: list[(list.indexOf(u) + 1) % list.length] }))
                  }}
                  className="border border-border bg-card h-9 w-14 rounded-lg text-xs font-semibold"
                >
                  {UNIT_LABEL[u]}
                </button>
              ) : (
                <span className="w-14 text-center text-xs text-muted-foreground">{UNIT_LABEL[u]}</span>
              )}
            </li>
          )
        })}
      </ul>
    </FormModal>
  )
}
