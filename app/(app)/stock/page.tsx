"use client"

/**
 * المخزون — what the café BUYS: cups, lids, milk, beans, fruit.
 *
 * Not the menu. Selling a latte never moves these numbers (there are no
 * recipes); they move three ways, each a row in the item's history:
 *   شراء  — a delivery arrived. Its price sets the unit cost.     (owner)
 *   هدر   — milk went off, a crate fell.                          (anyone)
 *   جرد   — the shelf was counted; the count becomes the truth.   (anyone)
 *
 * Employees see quantities and record waste and counts. What anything COST
 * is the owner's — the server strips it before it ever reaches their phone.
 */
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Search,
  ShoppingBasket,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  inventorySummary,
  listItems,
  recordPurchase,
  recordStocktake,
  recordWaste,
  formatQty,
  toBase,
  unitsFor,
  UNIT_LABEL,
  type BuyUnit,
  type InventoryItem,
} from "@/api/inventory"
import { uuid } from "@/lib/offline/queue"
import { ItemDrawer } from "@/components/stock/item-drawer"
import { Chip, PurchaseForm, UnitPicker, WasteForm, perUnitLabel } from "@/components/stock/forms"
import { FormModal } from "@/components/form-modal"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { cn } from "@/lib/utils"

type StateFilter = "all" | "low" | "out" | "expiring"

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  out: { label: "نفد", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  low: { label: "منخفض", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  expired: { label: "منتهي", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  expiring: { label: "ينتهي قريباً", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
}

export default function StockPage() {
  const isOwner = useIsOwner()
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [stateF, setStateF] = useState<StateFilter>("all")
  const [open, setOpen] = useState<InventoryItem | "new" | null>(null)
  const [buying, setBuying] = useState<InventoryItem | null>(null)
  const [wasting, setWasting] = useState<InventoryItem | null>(null)
  const [counting, setCounting] = useState(false)

  const items = useQuery({ queryKey: ["inventory", "items"], queryFn: () => listItems() })
  const summary = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: () => inventorySummary().then((r) => r.data),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inventory"] })
    qc.invalidateQueries({ queryKey: ["reports"] })
  }

  const rows = useMemo(() => {
    const q = search.trim()
    return (items.data ?? []).filter((i) => {
      if (category && i.category !== category) return false
      if (q && !`${i.name} ${i.supplier} ${i.category}`.includes(q)) return false
      if (stateF === "low") return i.state.includes("low") || i.state.includes("out")
      if (stateF === "out") return i.state.includes("out")
      if (stateF === "expiring") return i.state.includes("expiring") || i.state.includes("expired")
      return true
    })
  }, [items.data, search, category, stateF])

  const groups = useMemo(() => {
    const m = new Map<string, InventoryItem[]>()
    for (const r of rows) {
      const k = r.category || "بلا تصنيف"
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
  }, [rows])

  const s = summary.data
  return (
    <div className="mx-auto w-full max-w-6xl pb-24">
      <PageHeader
        title="المخزون"
        action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCounting(true)}>
              <ClipboardCheck className="size-4" />
              جرد
            </Button>
            {isOwner ? (
              <Button
                size="sm"
                className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25"
                onClick={() => setOpen("new")}
              >
                <Plus className="size-4" />
                صنف
              </Button>
            ) : null}
          </div>
        }
      />

      {/* ── at a glance ─────────────────────────────────────────────── */}
      <div className={cn("mb-4 grid grid-cols-2 gap-3", isOwner ? "md:grid-cols-4 lg:grid-cols-7" : "md:grid-cols-4")}>
        <Stat label="الأصناف" value={s ? formatNumber(s.items) : "—"} />
        <Stat label="منخفض" value={s ? formatNumber(s.low) : "—"} tone={s?.low ? "warn" : undefined} onClick={() => setStateF("low")} />
        <Stat label="نفد" value={s ? formatNumber(s.out) : "—"} tone={s?.out ? "bad" : undefined} onClick={() => setStateF("out")} />
        <Stat label="ينتهي خلال أسبوع" value={s ? formatNumber(s.expiring) : "—"} tone={s?.expiring ? "warn" : undefined} onClick={() => setStateF("expiring")} />
        {isOwner ? (
          <>
            <Stat label="قيمة المخزون" value={s?.stock_value ? formatMoney(s.stock_value) : "—"} />
            <Stat label="مشتريات هذا الشهر" value={s?.purchases_month ? formatMoney(s.purchases_month) : "—"} />
            <Stat label="هدر هذا الشهر" value={s?.waste_month ? formatMoney(s.waste_month) : "—"} />
          </>
        ) : null}
      </div>

      {/* ── filters ─────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder="ابحث عن صنف أو مورّد…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["all", "low", "out", "expiring"] as StateFilter[]).map((f) => (
            <Chip key={f} on={stateF === f} onClick={() => setStateF(f)}>
              {{ all: "الكل", low: "يحتاج طلب", out: "نفد", expiring: "صلاحية" }[f]}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-border" />
          <Chip on={category == null} onClick={() => setCategory(null)}>كل التصنيفات</Chip>
          {(s?.categories ?? []).map((c) => (
            <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── the list ────────────────────────────────────────────────── */}
      {items.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card flex flex-col items-center gap-2 p-10 text-center">
          <ShoppingBasket className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {items.data?.length ? "لا شيء يطابق البحث." : "لا أصناف بعد. أضف ما تشتريه: أكواب، حليب، بن…"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([cat, list]) => (
            <section key={cat}>
              <h3 className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{cat}</h3>
              <ul className="rounded-2xl border border-border/80 bg-card divide-y divide-border/60 overflow-hidden p-0">
                {list.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    isOwner={isOwner}
                    onOpen={() => setOpen(i)}
                    onBuy={() => setBuying(i)}
                    onWaste={() => setWasting(i)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ItemDrawer
        item={open === "new" ? null : open}
        open={open != null}
        onOpenChange={(o) => !o && setOpen(null)}
        onSaved={refresh}
        onBuy={(i) => setBuying(i)}
        onWaste={(i) => setWasting(i)}
      />
      <PurchaseForm item={buying} onClose={() => setBuying(null)} onSaved={refresh} />
      <WasteForm item={wasting} onClose={() => setWasting(null)} onSaved={refresh} />
      <Stocktake open={counting} onClose={() => setCounting(false)} items={items.data ?? []} onSaved={refresh} />
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string
  value: string
  tone?: "warn" | "bad"
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border border-border/80 bg-card p-3.5 text-start disabled:cursor-default"
    >
      <p
        className={cn(
          "font-heading text-lg font-bold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </button>
  )
}

function ItemRow({
  item,
  isOwner,
  onOpen,
  onBuy,
  onWaste,
}: {
  item: InventoryItem
  isOwner: boolean
  onOpen: () => void
  onBuy: () => void
  onWaste: () => void
}) {
  const stock = toNumber(item.stock)
  const reorder = toNumber(item.reorder_level)
  const fill = reorder > 0 ? Math.min(1, stock / (reorder * 3)) : stock > 0 ? 1 : 0
  const per = isOwner ? perUnitLabel(item) : null
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{item.name}</span>
          {item.state.map((st) => (
            <span key={st} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATE_BADGE[st]?.cls)}>
              {STATE_BADGE[st]?.label}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-40">
            <div
              className={cn(
                "h-full rounded-full",
                item.state.includes("out") ? "bg-rose-500" : item.state.includes("low") ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${Math.max(3, fill * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {item.supplier ? `${item.supplier}` : ""}
            {item.expiry_date ? `${item.supplier ? " · " : ""}صلاحية ${formatDate(item.expiry_date)}` : ""}
          </span>
        </div>
      </button>
      <div className="text-end">
        <p className="font-heading text-sm font-bold tabular-nums">{formatQty(item.stock, item.unit)}</p>
        {per ? <p className="text-[10px] text-muted-foreground tabular-nums">{per}</p> : null}
      </div>
      <div className="flex shrink-0 gap-1">
        {isOwner ? (
          <button
            type="button"
            onClick={onBuy}
            aria-label="تسجيل شراء"
            title="تسجيل شراء"
            className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/20"
          >
            <PackagePlus className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onWaste}
          aria-label="تسجيل هدر"
          title="تسجيل هدر"
          className="grid size-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600 transition hover:bg-rose-500/20"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}

/* ── جرد ────────────────────────────────────────────────────────────── */
function Stocktake({
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
