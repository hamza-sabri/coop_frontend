"use client"

/* One raw material, in a drawer: المخزون (what it is, how it is bought, when
 * to reorder) and الحركة (every purchase, waste and count, newest first). */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History, Loader2, Package, PackagePlus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteItem,
  formatQty,
  itemMoves,
  saveItem,
  UNIT_LABEL,
  type BuyUnit,
  type InventoryItem,
} from "@/api/inventory"
import { ConfirmDelete } from "@/components/confirm-delete"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { perUnitLabel } from "@/components/stock/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { uuid } from "@/lib/offline/queue"
import { cn } from "@/lib/utils"

const BUY_UNITS: BuyUnit[] = ["piece", "kg", "g", "l", "ml"]
const KIND_TONE: Record<string, string> = {
  purchase: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  waste: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  count: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  adjust: "bg-muted text-muted-foreground",
}

/** Reorder level is typed in the unit a person counts in: kilos, litres. */
const big = (u: string) => u === "g" || u === "ml"

export function ItemDrawer({
  item,
  open,
  onOpenChange,
  onSaved,
  onBuy,
  onWaste,
}: {
  item: InventoryItem | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
  onBuy: (i: InventoryItem) => void
  onWaste: (i: InventoryItem) => void
}) {
  const isOwner = useIsOwner()
  const isNew = item == null
  const [tab, setTab] = useState("info")
  const [f, setF] = useState({
    name: "",
    category: "",
    purchase_unit: "piece" as BuyUnit,
    purchase_qty: "1",
    purchase_cost: "",
    opening: "",
    reorder: "",
    expiry_date: "",
    supplier: "",
    notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [seen, setSeen] = useState<string | null>(null)

  const sig = open ? `${item?.id ?? "new"}:${item?.updated_at ?? ""}` : null
  if (sig !== seen) {
    setSeen(sig)
    if (open) {
      setTab("info")
      const unit = item?.unit ?? "piece"
      setF({
        name: item?.name ?? "",
        category: item?.category ?? "",
        purchase_unit: item?.purchase_unit ?? "piece",
        purchase_qty: item ? String(Number(item.purchase_qty)) : "1",
        purchase_cost: item?.purchase_cost != null ? String(Number(item.purchase_cost)) : "",
        opening: "",
        reorder: item ? String(Number(item.reorder_level) / (big(unit) ? 1000 : 1)) : "",
        expiry_date: item?.expiry_date ?? "",
        supplier: item?.supplier ?? "",
        notes: item?.notes ?? "",
      })
    }
  }

  const moves = useQuery({
    queryKey: ["inventory", "moves", item?.id],
    queryFn: () => itemMoves(item!.id).then((r) => r.data),
    enabled: open && !isNew && tab === "moves",
  })

  const baseOf = (u: BuyUnit) => (u === "kg" || u === "g" ? "g" : u === "l" || u === "ml" ? "ml" : "piece")
  const reorderBase = toNumber(f.reorder) * (big(baseOf(f.purchase_unit)) ? 1000 : 1)

  async function save() {
    if (!f.name.trim()) return toast.error("أدخل اسم الصنف")
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(),
        category: f.category.trim(),
        purchase_unit: f.purchase_unit,
        purchase_qty: String(toNumber(f.purchase_qty) || 1),
        reorder_level: String(reorderBase),
        expiry_date: f.expiry_date || null,
        supplier: f.supplier.trim(),
        notes: f.notes,
      }
      if (isOwner) body.purchase_cost = toNumber(f.purchase_cost).toFixed(2)
      if (isNew) {
        body.client_uuid = uuid()
        if (toNumber(f.opening) > 0) body.opening_stock = String(toNumber(f.opening))
      }
      await saveItem(item?.id ?? null, body)
      toast.success(isNew ? "أُضيف الصنف" : "حُفظ")
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const unitWord = UNIT_LABEL[f.purchase_unit]
  const reorderWord = big(baseOf(f.purchase_unit)) ? (baseOf(f.purchase_unit) === "g" ? "كيلو" : "لتر") : "قطعة"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" size="lg" className="flex flex-col gap-0 p-0">
        <div className="border-b px-5 pb-3 pt-5">
          <SheetTitle className="flex items-center gap-2 font-heading text-lg">
            <Package className="size-5 text-primary" />
            {isNew ? "صنف جديد" : item.name}
          </SheetTitle>
          {!isNew ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-heading text-xl font-bold tabular-nums">{formatQty(item.stock, item.unit)}</span>
              {isOwner && perUnitLabel(item) ? (
                <span className="text-xs text-muted-foreground">{perUnitLabel(item)}</span>
              ) : null}
              {isOwner && item.stock_value ? (
                <span className="text-xs text-muted-foreground">· قيمة الرصيد {formatMoney(item.stock_value)}</span>
              ) : null}
            </div>
          ) : null}
          {!isNew ? (
            <div className="mt-3 flex gap-2">
              {isOwner ? (
                <Button size="sm" className="gap-1.5" onClick={() => onBuy(item)}>
                  <PackagePlus className="size-4" />
                  شراء
                </Button>
              ) : null}
              <Button size="sm" variant="outline" className="gap-1.5 text-rose-600" onClick={() => onWaste(item)}>
                <Trash2 className="size-4" />
                هدر
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {!isNew ? (
            <SegmentedTabs
              tabs={[
                { id: "info", label: "المخزون" },
                { id: "moves", label: "الحركة" },
              ]}
              active={tab}
              onChange={setTab}
            />
          ) : null}

          {tab === "info" ? (
            <div
              className="space-y-4 pb-6"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                  e.preventDefault()
                  save()
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>الاسم</Label>
                  <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="حليب كامل الدسم" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>التصنيف</Label>
                  <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="ألبان، تغليف…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>المورّد</Label>
                  <Input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
                </div>
              </div>

              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="mb-2 text-xs font-semibold">كيف تشتريه؟</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {BUY_UNITS.filter((u) => isNew || baseOf(u) === item.unit).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setF({ ...f, purchase_unit: u })}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold",
                        f.purchase_unit === u ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
                      )}
                    >
                      {UNIT_LABEL[u]}
                    </button>
                  ))}
                </div>
                <div className={cn("grid gap-3", isOwner ? "grid-cols-2" : "grid-cols-1")}>
                  <div className="flex flex-col gap-1.5">
                    <Label>الكمية في العبوة ({unitWord})</Label>
                    <Input inputMode="decimal" dir="ltr" className="text-end" value={f.purchase_qty} onChange={(e) => setF({ ...f, purchase_qty: e.target.value })} />
                  </div>
                  {isOwner ? (
                    <div className="flex flex-col gap-1.5">
                      <Label>سعرها (₪)</Label>
                      <Input inputMode="decimal" dir="ltr" className="text-end" value={f.purchase_cost} onChange={(e) => setF({ ...f, purchase_cost: e.target.value })} placeholder="0.00" />
                    </div>
                  ) : null}
                </div>
                {isOwner && toNumber(f.purchase_qty) > 0 && toNumber(f.purchase_cost) > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {toNumber(f.purchase_qty)} {unitWord} بـ{formatMoney(f.purchase_cost)} ={" "}
                    <b className="text-foreground">
                      {formatMoney(toNumber(f.purchase_cost) / toNumber(f.purchase_qty))} لكل {unitWord}
                    </b>
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {isNew ? (
                  <div className="flex flex-col gap-1.5">
                    <Label>الموجود الآن ({unitWord})</Label>
                    <Input inputMode="decimal" dir="ltr" className="text-end" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} placeholder="0" />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <Label>نبّهني عندما يقلّ عن ({reorderWord})</Label>
                  <Input inputMode="decimal" dir="ltr" className="text-end" value={f.reorder} onChange={(e) => setF({ ...f, reorder: e.target.value })} placeholder="0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>تاريخ الصلاحية</Label>
                  <Input type="date" dir="ltr" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ملاحظات</Label>
                <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="pb-6">
              {moves.isLoading ? (
                <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />
              ) : (moves.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">لا حركات بعد.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {(moves.data ?? []).map((m) => {
                    const q = toNumber(m.quantity)
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <span className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold", KIND_TONE[m.kind])}>
                          {m.kind_label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
                            {q > 0 ? "+" : "−"}
                            {formatQty(Math.abs(q), item!.unit)}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatDate(m.created_at)}
                            {m.reason ? ` · ${m.reason}` : ""}
                            {m.created_by_name ? ` · ${m.created_by_name}` : ""}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs tabular-nums text-muted-foreground">
                            الرصيد {formatQty(m.stock_after, item!.unit)}
                          </p>
                          {isOwner && m.total_cost && toNumber(m.total_cost) > 0 && m.kind !== "count" ? (
                            <p className="text-xs font-semibold tabular-nums">{formatMoney(m.total_cost)}</p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <History className="size-3.5" />
                آخر ٢٠٠ حركة
              </p>
            </div>
          )}
        </div>

        {tab === "info" ? (
          <div className="flex gap-2 border-t p-4">
            <Button className="bg-brand-gradient flex-1" disabled={saving} data-form-primary onClick={save}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ
            </Button>
            {!isNew && isOwner ? (
              <Button variant="outline" className="text-rose-600" onClick={() => setConfirm(true)} aria-label="حذف الصنف">
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>

      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title="حذف الصنف؟"
        description="يُحذف الصنف وكل حركاته. الأفضل غالباً تركه — لا يظهر في التقارير إن لم يتحرك."
        onConfirm={async () => {
          if (!item) return
          try {
            await deleteItem(item.id)
            toast.success("حُذف")
            onSaved()
            onOpenChange(false)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذر الحذف")
          }
          setConfirm(false)
        }}
      />
    </Sheet>
  )
}
