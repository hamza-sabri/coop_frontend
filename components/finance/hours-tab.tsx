"use client"

/* الساعات — when each kind of drink sells.
 *
 * A grid, hour by category, shaded by how much sold. The rota question ("do
 * I need two baristas at five?") is answered by the row totals; the menu
 * question ("is anyone buying smoothies at midnight?") by the columns.
 * Hours run in the order the shop lives them — opening to close, across
 * midnight — not 0 to 23. */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchHours, fetchShifts } from "@/api/finance"
import { PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { businessToday } from "@/lib/period"

export function HoursTab() {
  const today = businessToday()
  const [state, setState] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })
  const [metric, setMetric] = useState<"qty" | "revenue">("qty")

  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => fetchShifts().then((r) => r.data),
    staleTime: 5 * 60_000,
  })
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "hours", state.period, state.anchor, state.shiftId],
    queryFn: () =>
      fetchHours({ period: state.period, date: state.anchor, shift: state.shiftId }).then((r) => r.data),
    staleTime: 60_000,
    placeholderData: (p) => p,
  })

  const grid = useMemo(() => {
    if (!data) return null
    const cut = data.day_start_hour
    const hours = Array.from(new Set(data.cells.map((c) => c.hour))).sort(
      (a, b) => ((a - cut + 24) % 24) - ((b - cut + 24) % 24),
    )
    const cell = new Map<string, number>()
    let max = 0
    const rowTotal = new Map<number, number>()
    const colTotal = new Map<string, number>()
    for (const c of data.cells) {
      const v = toNumber(metric === "qty" ? c.qty : c.revenue)
      cell.set(`${c.hour}|${c.category}`, v)
      max = Math.max(max, v)
      rowTotal.set(c.hour, (rowTotal.get(c.hour) ?? 0) + v)
      colTotal.set(c.category, (colTotal.get(c.category) ?? 0) + v)
    }
    const maxRow = Math.max(0, ...rowTotal.values())
    return { hours, cell, max, rowTotal, colTotal, maxRow }
  }, [data, metric])

  const fmt = (v: number) => (metric === "qty" ? formatNumber(Math.round(v)) : formatMoney(v))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PeriodBar
          value={state}
          onChange={setState}
          today={today}
          shifts={(shifts.data ?? [])
            .filter((s) => s.is_active)
            .map((s) => ({ id: s.id, name: s.name, start: s.start.slice(0, 5), end: s.end.slice(0, 5) }))}
        />
        <div className="mb-4 flex gap-1.5">
          {(["qty", "revenue"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={
                metric === m
                  ? "rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                  : "clay-chip rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              }
            >
              {m === "qty" ? "الكمية" : "الإيراد"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-96 rounded-[26px]" />
      ) : !grid || grid.hours.length === 0 ? (
        <p className="clay-card p-8 text-center text-sm text-muted-foreground">لا مبيعات في هذه الفترة.</p>
      ) : (
        <div className="clay-card overflow-x-auto p-4">
          {data?.peak_hour != null ? (
            <p className="mb-3 text-sm">
              الذروة الساعة{" "}
              <b dir="ltr" className="font-heading">
                {String(data.peak_hour).padStart(2, "0")}:00
              </b>
              {data.categories[0] ? (
                <span className="text-muted-foreground"> · الأكثر مبيعاً: {data.categories[0]}</span>
              ) : null}
            </p>
          ) : null}
          <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-14 text-start font-medium text-muted-foreground">الساعة</th>
                {data!.categories.map((c) => (
                  <th key={c} className="px-1 text-center font-medium text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-44 text-start font-medium text-muted-foreground">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {grid.hours.map((h) => {
                const total = grid.rowTotal.get(h) ?? 0
                return (
                  <tr key={h}>
                    <td className="font-heading tabular-nums text-muted-foreground" dir="ltr">
                      {String(h).padStart(2, "0")}:00
                    </td>
                    {data!.categories.map((c) => {
                      const v = grid.cell.get(`${h}|${c}`) ?? 0
                      const a = grid.max ? v / grid.max : 0
                      return (
                        <td
                          key={c}
                          title={`${c} · ${fmt(v)}`}
                          className="h-8 rounded-lg text-center tabular-nums"
                          style={{
                            background: v
                              ? `color-mix(in oklab, var(--primary) ${Math.round(8 + a * 72)}%, transparent)`
                              : "var(--muted)",
                            color: a > 0.55 ? "var(--primary-foreground)" : undefined,
                          }}
                        >
                          {v ? fmt(v) : ""}
                        </td>
                      )
                    })}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${grid.maxRow ? (total / grid.maxRow) * 100 : 0}%` }}
                          />
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
    </div>
  )
}
