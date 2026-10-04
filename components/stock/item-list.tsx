"use client"

/* الأصناف — the shelf as cards, grouped by kind.
 *
 *   ╭──╮  حليب كامل الدسم
 *   │ 4│  ألبان الجنيدي · ينتهي ١٠ أكتوبر
 *   ╰──╯  28.3 لتر                26 لتر/يوم
 *         [شراء]  [هدر]
 *
 * The ring is how long the shelf lasts at the last 14 days' pace — full at
 * two weeks — the number to order by. Green, amber, red say the same thing
 * the label does; colour is never the only signal. */
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Filter = "all" | "reorder" | "expiry"
type Tone = "bad" | "warn" | "ok" | "mute"

/** A kind of thing on the shelf: its icon and a fixed tint (by kind, never by position). */
export function categoryLook(name: string): { Icon: typeof Box; tint: string } {
  if (/تغليف|كوب|أكواب|غطاء|أغطية|مصاص|محارم/.test(name)) return { Icon: Package, tint: "bg-slate-500/10 text-slate-700 dark:text-slate-300" }
  if (/ألبان|حليب|كريم/.test(name)) return { Icon: Milk, tint: "bg-sky-500/10 text-sky-700 dark:text-sky-300" }
  if (/قهوة|بن|كاكاو/.test(name)) return { Icon: Coffee, tint: "bg-amber-700/10 text-amber-800 dark:text-amber-300" }
  if (/سيرب|صوص|شراب/.test(name)) return { Icon: Droplets, tint: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }
  if (/فواكه|فاكهة|خضار/.test(name)) return { Icon: Apple, tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
  if (/جاف|سكر|طحين|بودرة/.test(name)) return { Icon: Wheat, tint: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300" }
  return { Icon: Box, tint: "bg-muted text-muted-foreground" }
}
export const categoryIcon = (name: string) => categoryLook(name).Icon

const needsOrder = (i: InventoryItem) =>
  i.state.includes("out") || i.state.includes("low") || (i.days_left != null && i.days_left <= 3)
const expiring = (i: InventoryItem) => i.state.includes("expiring") || i.state.includes("expired")

function lasts(i: InventoryItem): { text: string; tone: Tone } {
  const stock = toNumber(i.stock)
  if (stock <= 0) return { text: stock < 0 ? "سالب — سجّل الشراء" : "نفد", tone: "bad" }
  if (i.days_left == null) return { text: "لا استهلاك مؤخراً", tone: "mute" }
  const d = i.days_left
  if (d < 1) return { text: "ينفد اليوم", tone: "bad" }
  const text = d === 1 ? "يكفي يوماً" : d === 2 ? "يكفي يومين" : d <= 10 ? `يكفي ${d} أيام` : d > 60 ? "يكفي +٦٠ يوماً" : `يكفي ${d} يوماً`
  return { text, tone: d <= 2 ? "bad" : d <= 7 ? "warn" : "ok" }
}

const RING: Record<Tone, string> = {
  bad: "stroke-rose-500",
  warn: "stroke-amber-500",
  ok: "stroke-emerald-500",
  mute: "stroke-muted-foreground/30",
}
const LABEL: Record<Tone, string> = {
  bad: "text-rose-700 dark:text-rose-300",
  warn: "text-amber-700 dark:text-amber-300",
  ok: "text-emerald-700 dark:text-emerald-300",
  mute: "text-muted-foreground",
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
    // What needs attention first, then the shortest-lasting, then by name.
    const key = (i: InventoryItem) => (toNumber(i.stock) <= 0 ? -1 : (i.days_left ?? 9999))
    return [...m.entries()].map(
      ([k, list]) => [k, list.sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name, "ar"))] as const,
    )
  }, [items, search, filter])

  let n = 0 // running index for the entrance stagger
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-xl bg-card ps-9 pe-9"
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
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none",
                filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px] rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-12 text-center animate-in fade-in">
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
          const { Icon, tint } = categoryLook(cat)
          const value = isOwner ? list.reduce((s, i) => s + Math.max(0, toNumber(i.stock_value)), 0) : 0
          return (
            <section key={cat}>
              <header className="mb-2 flex items-center gap-2">
                <span className={cn("grid size-7 place-items-center rounded-lg", tint)}>
                  <Icon className="size-3.5" />
                </span>
                <h3 className="font-heading text-sm font-bold">{cat}</h3>
                <span className="rounded-md bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {formatNumber(list.length)}
                </span>
                {isOwner && value > 0 ? (
                  <span className="ms-auto text-xs tabular-nums text-muted-foreground">{formatMoney(value)}</span>
                ) : null}
              </header>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((i) => (
                  <Card
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

/** Days of cover as a ring: full at 14 days. */
function Gauge({ item, tone }: { item: InventoryItem; tone: Tone }) {
  const stock = toNumber(item.stock)
  const d = item.days_left
  const fill = stock <= 0 ? 0 : d == null ? 0 : Math.min(1, d / 14)
  const r = 22
  const c = 2 * Math.PI * r
  const centre = stock <= 0 ? "!" : d == null ? "—" : d > 99 ? "99+" : formatNumber(d)
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        {fill > 0 ? (
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className={cn("animate-ring", RING[tone])}
            style={{ strokeDasharray: c, strokeDashoffset: c * (1 - fill), ["--ring-c" as string]: `${c}` }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className={cn("font-heading text-base font-bold tabular-nums", stock <= 0 && "text-rose-600")}>{centre}</p>
          {d != null && stock > 0 ? <p className="mt-0.5 text-[9px] text-muted-foreground">يوم</p> : null}
        </div>
      </div>
    </div>
  )
}

function Card({
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
  const l = lasts(item)
  const expiry = item.expiry_date
    ? item.state.includes("expired")
      ? "منتهي"
      : item.state.includes("expiring")
        ? `ينتهي ${formatDate(item.expiry_date)}`
        : null
    : null
  const perDay = toNumber(item.daily_use)

  return (
    <li
      className="group relative flex flex-col rounded-2xl border border-border/80 bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_6px_20px_-12px_rgb(0_0_0/0.25)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${Math.min(index, 18) * 35}ms` }}
    >
      <button type="button" onClick={onOpen} className="flex items-center gap-3 p-3.5 pb-2 text-start">
        <Gauge item={item} tone={l.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.supplier || "—"}
            {expiry ? <span className="font-semibold text-amber-700 dark:text-amber-300"> · {expiry}</span> : null}
          </p>
          <p className={cn("mt-1 text-[11px] font-semibold", LABEL[l.tone])}>{l.text}</p>
        </div>
      </button>
      <div className="mt-auto flex items-center gap-2 border-t border-border/60 px-3.5 py-2">
        <div className="min-w-0 flex-1">
          <span className="font-heading text-base font-bold tabular-nums">{formatQty(item.stock, item.unit)}</span>
          {perDay > 0 ? (
            <span className="ms-1.5 text-[11px] tabular-nums text-muted-foreground">· {formatQty(perDay, item.unit)}/يوم</span>
          ) : null}
        </div>
        {isOwner ? (
          <button
            type="button"
            onClick={onBuy}
            aria-label={`تسجيل شراء ${item.name}`}
            className="flex h-8 items-center gap-1 rounded-lg bg-primary/8 px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
          >
            <PackagePlus className="size-3.5" />
            شراء
          </button>
        ) : null}
        <button
          type="button"
          onClick={onWaste}
          aria-label={`تسجيل هدر ${item.name}`}
          title="تسجيل هدر"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}
