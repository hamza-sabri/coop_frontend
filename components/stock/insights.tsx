"use client"

/* نظرة عامة — the shelf in money, for the owner.
 *
 *   What is on the shelf now, and in what.
 *   Where the period's stock went: sold in drinks, remade, wasted, lost.
 *   Buying against using, day by day.
 *   What runs out first — with the button to order it.
 *
 * Every shekel is a sum of the stock moves' own costs, so it reconciles with
 * each item's statement. */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PackagePlus } from "lucide-react"

import { formatQty, inventoryInsights, type InventoryItem } from "@/api/inventory"
import { CountUp } from "@/components/count-up"
import { PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import { AXIS, BarList, Empty, Failed, Panel, TabSkeleton, TOOLTIP_STYLE } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { businessToday } from "@/lib/period"
import { cn } from "@/lib/utils"

const PALETTE = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-2)", "oklch(0.7 0.12 20)", "oklch(0.65 0.05 270)"]

export function StockInsights({ items, onBuy }: { items: InventoryItem[]; onBuy: (i: InventoryItem) => void }) {
  const today = businessToday()
  const [p, setP] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "insights", p.period, p.anchor],
    queryFn: () => inventoryInsights({ period: p.period, date: p.anchor }).then((r) => r.data),
    placeholderData: (x) => x,
  })
  const byId = new Map(items.map((i) => [i.id, i]))

  return (
    <div className="space-y-3">
      <PeriodBar value={p} onChange={setP} today={today} />
      {isLoading && !data ? (
        <TabSkeleton />
      ) : !data ? (
        <Failed />
      ) : (
        <Body data={data} byId={byId} onBuy={onBuy} />
      )}
    </div>
  )
}

function Body({
  data,
  byId,
  onBuy,
}: {
  data: NonNullable<Awaited<ReturnType<typeof inventoryInsights>>["data"]>
  byId: Map<number, InventoryItem>
  onBuy: (i: InventoryItem) => void
}) {
  const value = toNumber(data.stock_value)
  const cats = data.by_category.filter((c) => toNumber(c.value) > 0)
  const F = data.flow
  const out = [
    { key: "used", label: "مشروبات مباعة", value: toNumber(F.used), color: "var(--chart-1)" },
    { key: "remakes", label: "إعادة تحضير", value: toNumber(F.remakes), color: "var(--chart-5)" },
    { key: "waste", label: "هدر", value: toNumber(F.waste), color: "oklch(0.64 0.19 22)" },
    { key: "shortfall", label: "نقص في الجرد", value: toNumber(F.shortfall), color: "oklch(0.7 0.05 270)" },
  ].filter((r) => r.value > 0)
  const outTotal = out.reduce((s, r) => s + r.value, 0)
  const days = data.daily.map((d) => ({
    day: Number(d.date.slice(8)),
    date: d.date,
    purchases: toNumber(d.purchases),
    used: toNumber(d.used) + toNumber(d.waste),
  }))
  const lossPct = outTotal ? ((toNumber(F.waste) + toNumber(F.shortfall)) / outTotal) * 100 : 0

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-5">
        {/* ── on the shelf now ───────────────────────────────────────── */}
        <Panel className="lg:col-span-3" title="على الرف الآن" hint={`${formatNumber(data.items)} صنف بآخر سعر شراء`}>
          <p className="font-heading text-4xl font-bold tracking-tight tabular-nums">
            <CountUp value={value} decimals={2} suffix=" ₪" />
          </p>
          {cats.length ? (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted" dir="rtl">
                {cats.map((c, i) => (
                  <div
                    key={c.name}
                    className="animate-bar h-full first:rounded-s-full last:rounded-e-full"
                    style={{
                      width: `${(toNumber(c.value) / value) * 100}%`,
                      background: PALETTE[i % PALETTE.length],
                      animationDelay: `${i * 70}ms`,
                    }}
                    title={`${c.name}: ${formatMoney(c.value)}`}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {cats.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="ms-auto shrink-0 tabular-nums text-muted-foreground">{formatMoney(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>

        {/* ── where it went ──────────────────────────────────────────── */}
        <Panel
          className="lg:col-span-2"
          title="أين ذهب المخزون"
          hint={outTotal ? `${lossPct.toFixed(1)}% منه هدر ونقص` : "لا حركة خروج في هذه الفترة"}
        >
          {outTotal ? (
            <div className="flex items-center gap-4">
              <div className="relative size-36 shrink-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 180 }}>
                  <PieChart>
                    <Pie
                      data={out}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="68%"
                      outerRadius="100%"
                      paddingAngle={out.length > 1 ? 2 : 0}
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      animationDuration={900}
                    >
                      {out.map((r) => (
                        <Cell key={r.key} fill={r.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [formatMoney(Number(v)), String(n)]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="font-heading text-base font-bold tabular-nums">{formatMoney(outTotal)}</p>
                    <p className="text-[10px] text-muted-foreground">خرج من الرف</p>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {out.map((r) => (
                  <li key={r.key} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                      <span className="min-w-0 truncate">{r.label}</span>
                      <span className="ms-auto shrink-0 font-semibold tabular-nums">{formatMoney(r.value)}</span>
                    </div>
                    <p className="ps-4.5 text-[10px] tabular-nums text-muted-foreground">
                      {((r.value / outTotal) * 100).toFixed(1)}%
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty>—</Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* ── buying vs using ─────────────────────────────────────────── */}
        <Panel
          className="lg:col-span-3"
          title="الشراء مقابل الاستهلاك"
          hint={`اشتريت ${formatMoney(F.purchases)} · استُهلك ${formatMoney(toNumber(F.used) + toNumber(F.remakes) + toNumber(F.waste))}`}
        >
          {days.length > 1 ? (
            <div className="h-60" dir="ltr">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 180 }}>
                <BarChart data={days} margin={{ left: 0, right: 4, top: 6 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" />
                  <YAxis {...AXIS} width={44} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.date as string) ?? ""}
                    formatter={(v, n) => [formatMoney(Number(v)), n === "purchases" ? "مشتريات" : "استهلاك"]}
                  />
                  <Bar dataKey="used" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={800} />
                  <Bar dataKey="purchases" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={800} animationBegin={150} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>اختر أسبوعاً أو شهراً لرؤية الأيام</Empty>
          )}
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-5)" }} />
              مشتريات
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} />
              استهلاك (بيع + هدر)
            </span>
          </div>
        </Panel>

        {/* ── runs out first ─────────────────────────────────────────── */}
        <Panel className="lg:col-span-2" title="ينفد قريباً" hint="بمعدّل استهلاك آخر ١٤ يوماً">
          {data.running_out.length ? (
            <ul className="space-y-1">
              {data.running_out.map((r, i) => {
                const item = byId.get(r.id)
                const d = r.days_left
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg px-1 py-1.5 animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg font-heading text-sm font-bold tabular-nums",
                        d <= 2 ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-amber-500/12 text-amber-800 dark:text-amber-300",
                      )}
                      title="أيام متبقية"
                    >
                      {formatNumber(d)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {formatQty(r.stock, r.unit)} · {formatQty(r.per_day, r.unit)} يومياً
                      </p>
                    </div>
                    {item ? (
                      <button
                        type="button"
                        onClick={() => onBuy(item)}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        <PackagePlus className="size-3.5" />
                        شراء
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty>كل شيء يكفي أكثر من أسبوع</Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="الأكثر استهلاكاً" hint="بالتكلفة — ما يذهب في المشروبات">
          <BarList
            rows={data.top_used.map((r) => ({
              key: r.id,
              label: r.name,
              sub: formatQty(r.quantity, r.unit),
              value: toNumber(r.cost),
            }))}
            format={(v) => formatMoney(v)}
          />
        </Panel>
        <Panel title="الهدر" hint="ما تلف أو انسكب، وأكثر سبب له">
          <BarList
            rows={data.top_waste.map((r) => ({
              key: r.id,
              label: r.name,
              sub: r.reasons?.[0] ? `${r.reasons[0].reason} · ${formatQty(r.quantity, r.unit)}` : formatQty(r.quantity, r.unit),
              value: toNumber(r.cost),
            }))}
            format={(v) => formatMoney(v)}
            empty="لا هدر في هذه الفترة"
          />
        </Panel>
      </div>
    </>
  )
}
