"use client"

/* الأصناف — every drink on the menu, one row each.
 *
 * Four questions, one sort each: what sells most, what earns most, what earns
 * least per cup, and what nobody ordered at all. The last one is the one a
 * "top 10" can never show, because a drink nobody bought is on no receipt. */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Search } from "lucide-react"

import { fetchItems, type ItemRow, type PnlQuery } from "@/api/finance"
import { Chip } from "@/components/finance/period-bar"
import { Empty, Failed, MarginPill, Panel, Stat, TabSkeleton } from "@/components/reports/kit"
import { Input } from "@/components/ui/input"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Sort = "qty" | "profit" | "margin" | "dead"

const SORTS: { id: Sort; label: string }[] = [
  { id: "qty", label: "الأكثر مبيعاً" },
  { id: "profit", label: "الأعلى ربحاً" },
  { id: "margin", label: "الأقل هامشاً" },
  { id: "dead", label: "لم يُطلب" },
]

function Trend({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null
  if (!before) return <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">جديد</span>
  const d = ((now - before) / before) * 100
  if (Math.abs(d) < 1) return null
  const up = d > 0
  return (
    <span
      className={cn(
        "inline-flex w-10 items-center text-[10px] font-semibold tabular-nums",
        up ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
      )}
      dir="ltr"
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(d).toFixed(0)}%
    </span>
  )
}

export function ItemsTab({ q, onOpenItem }: { q: PnlQuery; onOpenItem: (id: number, name: string) => void }) {
  const [sort, setSort] = useState<Sort>("qty")
  const [search, setSearch] = useState("")
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "items", q.period, q.date],
    queryFn: () => fetchItems(q).then((r) => r.data),
    placeholderData: (p) => p,
  })

  const rows = useMemo(() => {
    const list = (data?.items ?? []).filter((i) => !search.trim() || i.name.includes(search.trim()))
    const n = (v: string | null) => (v == null ? Infinity : toNumber(v))
    if (sort === "dead") return list.filter((i) => toNumber(i.qty) === 0 && i.is_active)
    const sold = list.filter((i) => toNumber(i.qty) > 0)
    if (sort === "qty") return sold.sort((a, b) => toNumber(b.qty) - toNumber(a.qty))
    if (sort === "profit") return sold.sort((a, b) => toNumber(b.profit) - toNumber(a.profit))
    return sold.sort((a, b) => n(a.margin_pct) - n(b.margin_pct))
  }, [data, sort, search])

  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  const all = data.items
  const sold = all.filter((i) => toNumber(i.qty) > 0)
  const dead = all.filter((i) => toNumber(i.qty) === 0 && i.is_active).length
  const noCost = all.filter((i) => i.is_active && toNumber(i.cost) <= 0).length
  const maxQty = Math.max(1, ...rows.map((r) => toNumber(r.qty)))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الأكواب المباعة" value={formatNumber(Math.round(toNumber(data.totals.qty)))} />
        <Stat label="ربح المنيو" value={formatMoney(data.totals.profit)} sub="المبيعات ناقص تكلفة المشروبات" />
        <Stat label="أصناف بيعت" value={`${formatNumber(sold.length)} من ${formatNumber(all.filter((i) => i.is_active).length)}`} />
        <Stat
          label="لم تُطلب أبداً"
          value={formatNumber(dead)}
          tone={dead ? "warn" : undefined}
          sub={noCost ? `${formatNumber(noCost)} بلا تكلفة مسجلة` : undefined}
        />
      </div>

      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {SORTS.map((s) => (
              <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 ps-8 text-sm" placeholder="ابحث عن صنف…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty>{sort === "dead" ? "كل الأصناف طُلبت في هذه الفترة" : "لا مبيعات في هذه الفترة"}</Empty>
        ) : (
          <>
            {/* Desktop: a real table — the owner compares across columns. */}
            <table className="hidden w-full text-sm md:table">
              <thead className="text-[11px] text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th className="px-4 py-2 text-start font-medium">الصنف</th>
                  <th className="px-2 py-2 text-start font-medium w-px whitespace-nowrap">الأكواب</th>
                  <th className="px-2 py-2 text-end font-medium w-px whitespace-nowrap">الإيراد</th>
                  <th className="px-2 py-2 text-end font-medium w-px whitespace-nowrap">الربح</th>
                  <th className="px-2 py-2 text-center font-medium w-px whitespace-nowrap">الهامش</th>
                  <th className="px-2 py-2 text-end font-medium w-px whitespace-nowrap">من الربح</th>
                  <th className="px-4 py-2 text-end font-medium w-px whitespace-nowrap">آخر طلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((i) => (
                  <ItemTableRow key={i.product_id} i={i} maxQty={maxQty} onOpen={() => onOpenItem(i.product_id, i.name)} />
                ))}
              </tbody>
            </table>
            {/* Phone: one card per drink. */}
            <ul className="divide-y divide-border/60 md:hidden">
              {rows.map((i) => (
                <li key={i.product_id}>
                  <button type="button" onClick={() => onOpenItem(i.product_id, i.name)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                    <Thumb src={i.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatNumber(Math.round(toNumber(i.qty)))} كوب · ربح {formatMoney(i.profit)}
                      </p>
                    </div>
                    <MarginPill pct={i.margin_pct} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      <p className="text-[11px] text-muted-foreground">
        الإيراد هنا بسعر البند على الفاتورة؛ خصم الفاتورة والنقاط يظهران في تبويب الأرباح. صنف بلا تكلفة لا يُحسب له ربح.
      </p>
    </div>
  )
}

function Thumb({ src }: { src: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-9 shrink-0 rounded-lg bg-muted object-cover" />
  ) : (
    <span className="size-9 shrink-0 rounded-lg bg-muted" />
  )
}

function ItemTableRow({ i, maxQty, onOpen }: { i: ItemRow; maxQty: number; onOpen: () => void }) {
  const qty = toNumber(i.qty)
  return (
    <tr onClick={onOpen} className="cursor-pointer transition hover:bg-muted/40">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Thumb src={i.image} />
          <div className="min-w-0">
            <p className="truncate font-medium">{i.name}</p>
            <p className="text-[11px] text-muted-foreground">{i.category || "بلا تصنيف"}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2 whitespace-nowrap ps-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(qty / maxQty) * 100}%` }} />
          </div>
          <span className="w-8 font-semibold tabular-nums">{formatNumber(Math.round(qty))}</span>
          <Trend now={qty} before={toNumber(i.prev_qty)} />
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums">{formatMoney(i.revenue)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-end font-semibold tabular-nums">{i.margin_pct == null ? "—" : formatMoney(i.profit)}</td>
      <td className="px-2 py-2 text-center"><MarginPill pct={i.margin_pct} /></td>
      <td className="px-2 py-2 text-end tabular-nums text-muted-foreground">{i.margin_pct == null ? "—" : `${i.profit_share}%`}</td>
      <td className="px-4 py-2 text-end text-[11px] text-muted-foreground">
        {i.last_sold_at ? new Date(i.last_sold_at).toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "short" }) : "—"}
      </td>
    </tr>
  )
}
