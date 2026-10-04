"use client"

/* الأوقات — when the shop is busy, and with what.
 *   by hour × category: the rota question ("two baristas at five?") and the
 *     menu question ("anyone buying smoothies at midnight?") in one grid;
 *   by weekday: the AVERAGE day, so a month with five Fridays does not crown
 *     Friday for that alone.
 * Hours run in the order the shop lives them — opening to close, across
 * midnight — not 0 to 23. */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { fetchTimes, type PnlQuery } from "@/api/finance"
import { Chip } from "@/components/finance/period-bar"
import { AXIS, Empty, Failed, Panel, Stat, TabSkeleton, TOOLTIP_STYLE } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

export function TimesTab({ q }: { q: PnlQuery }) {
  const [metric, setMetric] = useState<"qty" | "revenue">("qty")
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "times", q.period, q.date],
    queryFn: () => fetchTimes(q).then((r) => r.data),
    placeholderData: (p) => p,
  })

  const grid = useMemo(() => {
    if (!data) return null
    const cut = data.day_start_hour
    const hours = Array.from(new Set(data.cells.map((c) => c.hour))).sort(
      (a, b) => ((a - cut + 24) % 24) - ((b - cut + 24) % 24),
    )
    const cell = new Map<string, number>()
    const row = new Map<number, number>()
    let max = 0
    for (const c of data.cells) {
      const v = toNumber(metric === "qty" ? c.qty : c.revenue)
      cell.set(`${c.hour}|${c.category}`, v)
      row.set(c.hour, (row.get(c.hour) ?? 0) + v)
      max = Math.max(max, v)
    }
    return { hours, cell, row, max, maxRow: Math.max(1, ...row.values()) }
  }, [data, metric])

  if (isLoading && !data) return <TabSkeleton />
  if (!data || !grid) return <Failed />
  const fmt = (v: number) => (metric === "qty" ? formatNumber(Math.round(v)) : formatMoney(v))
  const weekdays = data.weekdays.map((w) => ({ day: w.weekday, revenue: toNumber(w.avg_revenue), tickets: toNumber(w.avg_tickets) }))
  const quiet = grid.hours.length
    ? grid.hours.reduce((a, b) => ((grid.row.get(a) ?? 0) <= (grid.row.get(b) ?? 0) ? a : b))
    : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="ساعة الذروة" value={data.peak_hour != null ? <span dir="ltr">{hh(data.peak_hour)}</span> : "—"} sub="أكثر ساعة أكواباً" />
        <Stat label="أهدأ ساعة" value={quiet != null ? <span dir="ltr">{hh(quiet)}</span> : "—"} sub="أقل ساعة طلباً خلال الدوام" />
        <Stat label="أفضل يوم" value={data.best_weekday ?? "—"} sub="بمتوسط الإيراد" />
      </div>

      <Panel
        title="الساعات حسب التصنيف"
        hint="كل خانة = ما بيع من التصنيف في تلك الساعة. الأغمق أكثر."
        action={
          <div className="flex gap-1.5">
            <Chip on={metric === "qty"} onClick={() => setMetric("qty")}>الكمية</Chip>
            <Chip on={metric === "revenue"} onClick={() => setMetric("revenue")}>الإيراد</Chip>
          </div>
        }
      >
        {grid.hours.length === 0 ? (
          <Empty>لا مبيعات في هذه الفترة</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="w-14 text-start font-medium text-muted-foreground">الساعة</th>
                  {data.categories.map((c) => (
                    <th key={c} className="truncate px-1 text-center font-medium text-muted-foreground">{c}</th>
                  ))}
                  <th className="w-40 text-start font-medium text-muted-foreground">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {grid.hours.map((h) => {
                  const total = grid.row.get(h) ?? 0
                  return (
                    <tr key={h}>
                      <td className="tabular-nums text-muted-foreground" dir="ltr">{hh(h)}</td>
                      {data.categories.map((c) => {
                        const v = grid.cell.get(`${h}|${c}`) ?? 0
                        const a = grid.max ? v / grid.max : 0
                        return (
                          <td
                            key={c}
                            title={`${c} · ${hh(h)} · ${fmt(v)}`}
                            className="h-8 rounded-md text-center tabular-nums"
                            style={{
                              background: v ? `color-mix(in oklab, var(--chart-1) ${Math.round(10 + a * 75)}%, var(--card))` : "var(--muted)",
                              color: a > 0.5 ? "white" : undefined,
                            }}
                          >
                            {v ? fmt(v) : ""}
                          </td>
                        )
                      })}
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(total / grid.maxRow) * 100}%` }} />
                          </div>
                          <span className="w-14 text-end font-semibold tabular-nums">{fmt(total)}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="متوسط اليوم حسب أيام الأسبوع" hint="متوسط إيراد اليوم الواحد، من السبت إلى الجمعة">
        <div className="h-52" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...weekdays].reverse()} margin={{ left: 0, right: 4, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} width={44} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v, _n, p) => [`${formatMoney(Number(v))} · ${formatNumber(Math.round((p.payload as { tickets: number }).tickets))} فاتورة`, "متوسط اليوم"]}
              />
              <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  )
}
