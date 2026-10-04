"use client"

import { useState } from "react"
import { Loader2, PackagePlus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  formatQty,
  recordPurchase,
  recordWaste,
  toBase,
  unitsFor,
  UNIT_LABEL,
  type BuyUnit,
  type InventoryItem,
} from "@/api/inventory"
import { Chip } from "@/components/finance/period-bar"
import { FormModal } from "@/components/form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, toNumber } from "@/lib/format"
import { uuid } from "@/lib/offline/queue"
import { cn } from "@/lib/utils"

/** The price an owner thinks in: per kilo, per litre, per piece. */
export function perUnitLabel(item: InventoryItem): string | null {
  if (item.unit_cost == null) return null
  const c = toNumber(item.unit_cost)
  if (item.unit === "g") return `${formatMoney(c * 1000)} / كيلو`
  if (item.unit === "ml") return `${formatMoney(c * 1000)} / لتر`
  return `${formatMoney(c)} / قطعة`
}

/** One chip look across the money screens (see period-bar). */
export { Chip }

/* ── شراء ───────────────────────────────────────────────────────────── */
export function PurchaseForm({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState<BuyUnit>("piece")
  const [cost, setCost] = useState("")
  const [expiry, setExpiry] = useState("")
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState<number | null>(null)
  if (item && seen !== item.id) {
    setSeen(item.id)
    setQty(item.purchase_qty ? String(Number(item.purchase_qty)) : "")
    setUnit(item.purchase_unit)
    setCost(item.purchase_cost ? String(Number(item.purchase_cost)) : "")
    setExpiry("")
  }
  if (!item && seen !== null) setSeen(null)

  const base = toBase(toNumber(qty), unit)
  const per =
    base > 0 && toNumber(cost) > 0
      ? unit === "kg" || unit === "g"
        ? `${formatMoney((toNumber(cost) / base) * 1000)} للكيلو`
        : unit === "l" || unit === "ml"
          ? `${formatMoney((toNumber(cost) / base) * 1000)} للتر`
          : `${formatMoney(toNumber(cost) / base)} للقطعة`
      : null

  async function save() {
    if (!item) return
    if (!(toNumber(qty) > 0)) return toast.error("أدخل الكمية")
    setSaving(true)
    try {
      await recordPurchase(item.id, {
        quantity: String(toNumber(qty)),
        unit,
        cost: toNumber(cost).toFixed(2),
        expiry_date: expiry || undefined,
        client_uuid: uuid(),
      })
      toast.success(`أُضيف ${formatQty(base, item.unit)} إلى ${item.name}`)
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
      open={item != null}
      onOpenChange={(o) => !o && onClose()}
      title={item ? `شراء: ${item.name}` : "شراء"}
      icon={<PackagePlus className="size-4.5" />}
      footer={
        <>
          <Button type="button" className="bg-brand-gradient flex-1" disabled={saving} data-form-primary onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            تسجيل الشراء
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      {item ? (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>الكمية</Label>
              <Input inputMode="decimal" dir="ltr" className="text-end" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            <UnitPicker units={unitsFor(item.unit)} value={unit} onChange={setUnit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>السعر الكلي (₪)</Label>
            <Input inputMode="decimal" dir="ltr" className="text-end" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            {per ? <p className="text-xs text-muted-foreground">= {per}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>تاريخ الصلاحية (اختياري)</Label>
            <Input type="date" dir="ltr" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            الرصيد بعد الشراء: {formatQty(toNumber(item.stock) + base, item.unit)}. سعر هذا الشراء يصبح تكلفة الوحدة.
          </p>
        </>
      ) : null}
    </FormModal>
  )
}

export function UnitPicker({ units, value, onChange }: { units: BuyUnit[]; value: BuyUnit; onChange: (u: BuyUnit) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>الوحدة</Label>
      <div className="flex h-9 gap-1">
        {units.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            className={cn(
              "rounded-lg px-3 text-xs font-semibold",
              value === u ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
            )}
          >
            {UNIT_LABEL[u]}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── هدر ────────────────────────────────────────────────────────────── */
const WASTE_REASONS = ["انتهت الصلاحية", "تلف", "انسكب", "أخرى"]

export function WasteForm({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState<BuyUnit>("piece")
  const [reason, setReason] = useState(WASTE_REASONS[0])
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState<number | null>(null)
  if (item && seen !== item.id) {
    setSeen(item.id)
    setQty("")
    setUnit(unitsFor(item.unit)[unitsFor(item.unit).length - 1])
    setReason(WASTE_REASONS[0])
  }
  if (!item && seen !== null) setSeen(null)

  async function save() {
    if (!item) return
    if (!(toNumber(qty) > 0)) return toast.error("أدخل الكمية")
    setSaving(true)
    try {
      await recordWaste(item.id, { quantity: String(toNumber(qty)), unit, reason, client_uuid: uuid() })
      toast.success("سُجّل الهدر")
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
      open={item != null}
      onOpenChange={(o) => !o && onClose()}
      title={item ? `هدر: ${item.name}` : "هدر"}
      icon={<Trash2 className="size-4.5" />}
      footer={
        <>
          <Button type="button" variant="destructive" className="flex-1" disabled={saving} data-form-primary onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            تسجيل الهدر
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      {item ? (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>الكمية التالفة</Label>
              <Input inputMode="decimal" dir="ltr" className="text-end" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            <UnitPicker units={unitsFor(item.unit)} value={unit} onChange={setUnit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>السبب</Label>
            <div className="flex flex-wrap gap-1.5">
              {WASTE_REASONS.map((r) => (
                <Chip key={r} on={reason === r} onClick={() => setReason(r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            الرصيد الحالي {formatQty(item.stock, item.unit)}. الهدر يُحسب خسارة في تقرير الأرباح.
          </p>
        </>
      ) : null}
    </FormModal>
  )
}

