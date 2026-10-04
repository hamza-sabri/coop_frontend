"use client"

/* الأصناف — the shelf, grouped by kind, read in one glance per row:
 *
 *   [icon]  حليب كامل الدسم                           12.4 لتر
 *           ████████████░░░░░│░░░  ألبان الجنيدي      يكفي ٤ أيام
 *
 * "يكفي" is the stock divided by the last 14 days' average use — the number
 * to order by — and the bar draws the same thing: full = two weeks or more.
 * An item nothing has used lately is drawn against its reorder level. */
import { useMemo, useState } from "react"
import {
  Apple,
  Box,
  Coffee,
  Droplets,
  Milk,
  Package,
  PackagePlus,
  Search,
  ShoppingBasket,
  Trash2,
  Wheat,
  X,
} from "lucide-react"

import { formatQty, type InventoryItem } from "@/api/inventory"
import { perUnitLabel } from "@/components/stock/forms"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Filter = "all" | "reorder" | "expiry"

export function categoryIcon(name: string) {
  if (/تغليف|كوب|أكواب|غطاء|أغطية|مصاص|محارم/.test(name)) return Package
  if (/ألبان|حليب|كريم/.test(name)) return Milk
  if (/قهوة|بن|كاكاو/.test(name)) return Coffee
  if (/سيرب|صوص|شراب/.test(name)) return Droplets
  if (/فواكه|فاكهة|خضار/.test(name)) return Apple
  if (/جاف|سكر|طحين|بودرة/.test(name)) return Wheat
  return Box
}

const needsOrder = (i: InventoryItem) =>
  i.state.includes("out") || i.state.includes("low") || (i.days_left != null && i.days_left <= 3)
const expiring = (i: InventoryItem) => i.state.includes("expiring") || i.state.includes("expired")

function lastsLabel(i: InventoryItem): { text: string; tone: "bad" | "warn" | "ok" | "mute" } {
  const stock = toNumber(i.stock)
  if (stock <= 0) return { text: stock < 0 ? "سالب — سجّل الشراء" : "نفد", tone: "bad" }
  if (i.days_left == null) return { text: "لا استهلاك مؤخراً", tone: "mute" }
  if (i.days_left < 1) return { text: "ينفد اليوم", tone: "bad" }
  const d = i.days_left
  const text = d === 1 ? "يكفي يوماً" : d === 2 ? "يكفي يومين" : d <= 10 ? `يكفي ${d} أيام` : d > 60 ? "يكفي +٦٠ يوماً" : `يكفي ${d} يوماً`
  return { text, tone: d <= 2 ? "bad" : d <= 7 ? "warn" : "ok" }
}

const TONE = {
  bad: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  warn: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  mute: "bg-muted text-muted-foreground",
}

export function ItemList({
  items,
  loading,
  isOwner,
  onOpen,
  onBuy,
  onWaste,
}: {
  items: InventoryItem[]
  loading: boolean
  isOwner: boolean
  onOpen: (i: InventoryItem) => void
  onBuy: (i: InventoryItem) => void
  onWaste: (i: InventoryItem) => void
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const counts = useMemo(
    () => ({ all: items.length, reorder: items.filter(needsOrder).length, expiry: items.filter(expiring).length }),
    [items],
  )
  const groups = useMemo(() => {
    const q = search.trim()
    const rows = items.filter((i) => {
      if (filter === "reorder" && !needsOrder(i)) return false
      if (filter === "expiry" && !expiring(i)) return false
      return !q || `${i.name} ${i.supplier} ${i.category}`.includes(q)
    })
    const m = new Map<string, InventoryItem[]>()
    for (const r of rows) {
      const k = r.category || "بلا تصنيف"
      m.set(k, [...(m.get(k) ?? []), r])
    }
    // Within a group: what needs attention first, then by name.
    return [...m.entries()].map(([k, list]) => [
      k,
      list.sort((a, b) => Number(needsOrder(b)) - Number(needsOrder(a)) || a.name.localeCompare(b.name, "ar")),
    ] as const)
  }, [items, search, filter])

  let n = 0 // running index for the entrance stagger
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-xl ps-9 pe-9"
            placeholder="ابحث باسم الصنف أو المورّد…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setSearch("")}
              className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-1 rounded-xl border border-border/80 bg-card p-1" role="tablist">
          {(
            [
              ["all", "الكل"],
              ["reorder", "يحتاج طلب"],
              ["expiry", "الصلاحية"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "min-w-5 rounded-md px-1 text-[10px] tabular-nums",
                  filter === f
                    ? "bg-primary-foreground/20"
                    : f === "reorder" && counts.reorder
                      ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                      : f === "expiry" && counts.expiry
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        : "bg-muted",
                )}
              >
                {formatNumber(counts[f])}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-12 text-center">
          <ShoppingBasket className="size-8 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">
            {items.length
              ? filter === "reorder"
                ? "لا شيء يحتاج طلباً الآن."
                : filter === "expiry"
                  ? "لا شيء قريب الانتهاء."
                  : "لا شيء يطابق البحث."
              : "لا أصناف بعد. أضف ما تشتريه: أكواب، حليب، بن…"}
          </p>
        </div>
      ) : (
        groups.map(([cat, list]) => {
          const Icon = categoryIcon(cat)
          const value = isOwner ? list.reduce((s, i) => s + Math.max(0, toNumber(i.stock_value)), 0) : 0
          return (
            <section key={cat}>
              <header className="mb-1.5 flex items-center gap-2 px-1">
                <Icon className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-bold text-muted-foreground">{cat}</h3>
                <span className="text-[11px] text-muted-foreground/70">{formatNumber(list.length)}</span>
                {isOwner && value > 0 ? (
                  <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">{formatMoney(value)}</span>
                ) : null}
              </header>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/80 bg-card">
                {list.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    index={n++}
                    isOwner={isOwner}
                    onOpen={() => onOpen(i)}
                    onBuy={() => onBuy(i)}
                    onWaste={() => onWaste(i)}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function Row({
  item,
  index,
  isOwner,
  onOpen,
  onBuy,
  onWaste,
}: {
  item: InventoryItem
  index: number
  isOwner: boolean
  onOpen: () => void
  onBuy: () => void
  onWaste: () => void
}) {
  const stock = toNumber(item.stock)
  const reorder = toNumber(item.reorder_level)
  const fill =
    stock <= 0
      ? 0
      : item.days_left != null
        ? Math.min(1, item.days_left / 14)
        : Math.min(1, stock / (reorder > 0 ? reorder * 3 : stock))
  const lasts = lastsLabel(item)
  const bar =
    lasts.tone === "bad" ? "bg-rose-500" : lasts.tone === "warn" ? "bg-amber-500" : lasts.tone === "ok" ? "bg-emerald-500" : "bg-muted-foreground/40"
  const per = isOwner ? perUnitLabel(item) : null
  const expiry = item.expiry_date ? (item.state.includes("expired") ? "منتهي" : item.state.includes("expiring") ? "ينتهي" : null) : null

  return (
    <li
      className="group flex items-center gap-3 px-3 py-3 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 sm:px-4"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            <p className="shrink-0 font-heading text-sm font-bold tabular-nums" dir="rtl">
              {formatQty(item.stock, item.unit)}
            </p>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("animate-bar h-full rounded-full", bar)} style={{ width: `${fill > 0 ? Math.max(3, fill * 100) : 0}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-muted-foreground">
              {item.supplier || "—"}
              {expiry ? (
                <span className="ms-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  · {expiry} {formatDate(item.expiry_date!)}
                </span>
              ) : null}
              {per ? <span className="ms-1.5 hidden tabular-nums sm:inline">· {per}</span> : null}
            </span>
            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-semibold", TONE[lasts.tone])}>{lasts.text}</span>
          </div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {isOwner ? (
          <button
            type="button"
            onClick={onBuy}
            aria-label={`تسجيل شراء ${item.name}`}
            title="تسجيل شراء"
            className="grid size-8 place-items-center rounded-lg text-primary transition hover:bg-primary/10"
          >
            <PackagePlus className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onWaste}
          aria-label={`تسجيل هدر ${item.name}`}
          title="تسجيل هدر"
          className="grid size-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-500/10"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}
