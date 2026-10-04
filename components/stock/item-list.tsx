"use client"

/* الأصناف — the shelf as one table (DESIGN.md §2): search, a filter for
 * what needs attention, a kind picker, and every row saying how long the
 * item lasts at the last 14 days' pace — the number to order by.
 *
 *   الصنف                 التصنيف   الكمية         يكفي              القيمة
 *   [🥛] حليب كامل الدسم   ألبان     34.8 لتر       (4) يكفي ٤ أيام    177 ₪   [شراء][🗑]
 *
 * Grouping by kind used to be separate grids — which left a single card
 * alone on its row whenever a kind had one item. Kind is a filter now. */
import { useMemo, useState } from "react"
import { Apple, Box, Check, ChevronDown, Coffee, Droplets, Milk, Package, PackagePlus, Trash2, Wheat } from "lucide-react"

import { formatQty, type InventoryItem } from "@/api/inventory"
import { DataTable, type Column } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tone = "bad" | "warn" | "ok" | "mute"

/** A kind of thing on the shelf: its icon and a fixed tint (by kind, never by position). */
export function categoryLook(name: string): { Icon: typeof Box; tint: string } {
  if (/تغليف|كوب|أكواب|غطاء|أغطية|مصاص|محارم/.test(name)) return { Icon: Package, tint: "bg-slate-500/10 text-slate-700 dark:text-slate-300" }
  if (/ألبان|حليب|كريم|milk/i.test(name)) return { Icon: Milk, tint: "bg-sky-500/10 text-sky-700 dark:text-sky-300" }
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
  if (i.days_left == null) return { text: "لا يُستهلك حالياً", tone: "mute" }
  const d = i.days_left
  if (d < 1) return { text: "ينفد اليوم", tone: "bad" }
  const text = d === 1 ? "يكفي يوماً" : d === 2 ? "يكفي يومين" : d <= 10 ? `يكفي ${d} أيام` : d > 60 ? "يكفي أكثر من شهرين" : `يكفي ${d} يوماً`
  return { text, tone: d <= 2 ? "bad" : d <= 7 ? "warn" : "ok" }
}
/** Sort key: nothing left first, then the shortest-lasting, then the unused. */
const urgency = (i: InventoryItem) => (toNumber(i.stock) <= 0 ? -1 : (i.days_left ?? 9999))

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
  const [kind, setKind] = useState<string | null>(null)
  const kinds = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.category || "بلا تصنيف", (m.get(i.category || "بلا تصنيف") ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [items])
  const rows = useMemo(() => (kind ? items.filter((i) => (i.category || "بلا تصنيف") === kind) : items), [items, kind])

  const columns: Column<InventoryItem>[] = [
    {
      key: "name",
      header: "الصنف",
      sort: (i) => i.name,
      cell: (i) => <NameCell item={i} />,
    },
    {
      key: "kind",
      header: "التصنيف",
      width: "w-32",
      hideBelow: "lg",
      sort: (i) => i.category,
      cell: (i) => <span className="text-xs text-muted-foreground">{i.category || "بلا تصنيف"}</span>,
    },
    {
      key: "qty",
      header: "الكمية",
      width: "w-36",
      sort: (i) => toNumber(i.stock),
      cell: (i) => (
        <div>
          <p className="font-heading font-bold tabular-nums">{formatQty(i.stock, i.unit)}</p>
          {toNumber(i.daily_use) > 0 ? (
            <p className="text-[11px] tabular-nums text-muted-foreground">{formatQty(toNumber(i.daily_use), i.unit)} في اليوم</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "lasts",
      header: "يكفي",
      width: "w-48",
      sort: urgency,
      cell: (i) => {
        const l = lasts(i)
        return (
          <div className="flex items-center gap-2">
            <Ring item={i} tone={l.tone} />
            <span className={cn("text-xs font-semibold", LABEL[l.tone])}>{l.text}</span>
          </div>
        )
      },
    },
    ...(isOwner
      ? [
          {
            key: "value",
            header: "القيمة",
            width: "w-28",
            align: "end" as const,
            hideBelow: "xl" as const,
            sort: (i: InventoryItem) => toNumber(i.stock_value),
            cell: (i: InventoryItem) => <span className="tabular-nums text-muted-foreground">{formatMoney(i.stock_value)}</span>,
          },
        ]
      : []),
    {
      key: "actions",
      header: "",
      width: isOwner ? "w-40" : "w-14",
      align: "end",
      cell: (i) => <Actions item={i} isOwner={isOwner} onBuy={onBuy} onWaste={onWaste} />,
    },
  ]

  return (
    <DataTable<InventoryItem>
      rows={rows}
      rowKey={(i) => i.id}
      columns={columns}
      loading={loading}
      onRowClick={onOpen}
      searchText={(i) => `${i.name} ${i.supplier} ${i.category}`}
      searchPlaceholder="ابحث باسم الصنف أو المورّد…"
      defaultSort={{ key: "lasts", dir: "asc" }}
      filters={[
        { id: "all", label: "الكل" },
        { id: "reorder", label: "يحتاج طلب", test: needsOrder, tone: "bad" },
        { id: "expiry", label: "قارب على الانتهاء", test: expiring, tone: "warn" },
      ]}
      toolbar={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
                {kind ?? "كل الأنواع"}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setKind(null)}>
              <Check className={cn("size-4", kind ? "opacity-0" : "opacity-100")} />
              كل الأنواع
              <span className="ms-auto text-xs tabular-nums text-muted-foreground">{formatNumber(items.length)}</span>
            </DropdownMenuItem>
            {kinds.map(([k, n]) => {
              const { Icon } = categoryLook(k)
              return (
                <DropdownMenuItem key={k} onClick={() => setKind(k)}>
                  <Check className={cn("size-4", kind === k ? "opacity-100" : "opacity-0")} />
                  <Icon className="size-4 text-muted-foreground" />
                  {k}
                  <span className="ms-auto text-xs tabular-nums text-muted-foreground">{formatNumber(n)}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      empty={items.length ? "لا شيء يطابق." : "لا أصناف بعد. أضف ما تشتريه: أكواب، حليب، بن…"}
      mobileRow={(i) => {
        const l = lasts(i)
        const { Icon, tint } = categoryLook(i.category)
        return (
          <div className="flex items-center gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tint)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{i.name}</p>
              <p className={cn("text-[11px] font-semibold", LABEL[l.tone])}>{l.text}</p>
            </div>
            <span className="shrink-0 font-heading text-sm font-bold tabular-nums">{formatQty(i.stock, i.unit)}</span>
          </div>
        )
      }}
    />
  )
}

function NameCell({ item }: { item: InventoryItem }) {
  const { Icon, tint } = categoryLook(item.category)
  const expiry = item.expiry_date
    ? item.state.includes("expired")
      ? `انتهت صلاحيته ${formatDate(item.expiry_date)}`
      : item.state.includes("expiring")
        ? `ينتهي ${formatDate(item.expiry_date)}`
        : null
    : null
  return (
    <div className="flex items-center gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tint)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.supplier || "بلا مورّد"}
          {expiry ? <span className="font-semibold text-amber-700 dark:text-amber-300"> · {expiry}</span> : null}
        </p>
      </div>
    </div>
  )
}

/** Days of cover as a small ring: full at 14 days. */
function Ring({ item, tone }: { item: InventoryItem; tone: Tone }) {
  const stock = toNumber(item.stock)
  const d = item.days_left
  const fill = stock <= 0 || d == null ? 0 : Math.min(1, d / 14)
  const r = 14
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        {fill > 0 ? (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className={cn("animate-ring", RING[tone])}
            style={{ strokeDasharray: c, strokeDashoffset: c * (1 - fill), ["--ring-c" as string]: `${c}` }}
          />
        ) : null}
      </svg>
      <span className={cn("relative text-[11px] font-bold tabular-nums", stock <= 0 && "text-rose-600")}>
        {stock <= 0 ? "!" : d == null ? "" : d > 99 ? "99+" : formatNumber(d)}
      </span>
    </span>
  )
}

function Actions({
  item,
  isOwner,
  onBuy,
  onWaste,
}: {
  item: InventoryItem
  isOwner: boolean
  onBuy: (i: InventoryItem) => void
  onWaste: (i: InventoryItem) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {isOwner ? (
        <button
          type="button"
          onClick={() => onBuy(item)}
          aria-label={`تسجيل شراء ${item.name}`}
          className="flex h-8 items-center gap-1 rounded-lg bg-primary/8 px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
        >
          <PackagePlus className="size-3.5" />
          شراء
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onWaste(item)}
        aria-label={`تسجيل هدر ${item.name}`}
        title="تسجيل هدر (تلف أو انسكب)"
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600"
      >
        <Trash2 className="size-3.5" />
        هدر
      </button>
    </div>
  )
}
