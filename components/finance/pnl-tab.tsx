"use client"

/* ==========================================================================
   الأرباح — did the shop make money, and where did it go.

   The statement reads top to bottom the way an accountant would write it,
   but every line is one the owner can act on: discounts the cashiers gave,
   what the points scheme cost at the till, what came back over the counter,
   what the drinks cost to make, and the month's running costs spread over
   the days shown.

   Two lines sit BELOW the profit, deliberately not subtracted: the points
   customers still hold (owed, not spent) and what was paid for stock (spend,
   not cost — the cost is counted when the drink is sold).
   ========================================================================== */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, ChevronDown, Info, TrendingDown, TrendingUp } from "lucide-react"

import { fetchPnl, type Pnl } from "@/api/finance"
import { PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { businessToday, label as periodLabel } from "@/lib/period"
import { cn } from "@/lib/utils"

function pct(part: number, whole: number): string {
  if (!whole) return "—"
  return `${((part / whole) * 100).toFixed(1)}%`
}

function Delta({ now, before }: { now: number; before: number | null | undefined }) {
  if (before == null || !Number.isFinite(before) || before === 0) return null
  const d = ((now - before) / Math.abs(before)) * 100
  const up = d >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
      dir="ltr"
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {d.toFixed(0)}%
    </span>
  )
}

function Kpi({
  label,
  value,
  sub,
  delta,
  tone,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  delta?: React.ReactNode
  tone?: "good" | "bad"
}) {
  return (
    <div className="clay-card p-4">
      <p
        className={cn(
          "font-heading text-xl font-bold tracking-tight tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {delta}
      </div>
      {sub ? <p className="text-[10px] text-muted-foreground/80">{sub}</p> : null}
    </div>
  )
}

type Row = {
  label: string
  amount: number
  kind: "line" | "less" | "total" | "grand"
  hint?: string
  children?: { label: string; amount: number }[]
  hideIfZero?: boolean
}

function Statement({ rows, base }: { rows: Row[]; base: number }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="divide-y divide-border/60">
      {rows
        .filter((r) => !(r.hideIfZero && r.amount === 0))
        .map((r) => {
          const negative = r.amount < 0
          const isOpen = open === r.label
          return (
            <div key={r.label}>
              <button
                type="button"
                disabled={!r.children?.length}
                onClick={() => setOpen(isOpen ? null : r.label)}
                className={cn(
                  "flex w-full items-center gap-3 px-1 text-start",
                  r.kind === "grand" ? "py-3.5" : "py-2.5",
                  r.children?.length ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 text-sm",
                    r.kind === "less" && "text-muted-foreground",
                    (r.kind === "total" || r.kind === "grand") && "font-semibold",
                    r.kind === "grand" && "text-base",
                  )}
                >
                  {r.kind === "less" ? <span className="w-3 text-center opacity-60">−</span> : null}
                  {r.label}
                  {r.children?.length ? (
                    <ChevronDown className={cn("size-3.5 opacity-60 transition", isOpen && "rotate-180")} />
                  ) : null}
                  {r.hint ? (
                    <span className="truncate text-[10px] font-normal text-muted-foreground/80">
                      {r.hint}
                    </span>
                  ) : null}
                </span>
                <span className="w-14 shrink-0 text-end text-[11px] tabular-nums text-muted-foreground">
                  {r.kind === "less" || r.kind === "total" || r.kind === "grand"
                    ? pct(Math.abs(r.amount), base)
                    : ""}
                </span>
                <span
                  className={cn(
                    "w-28 shrink-0 text-end font-heading tabular-nums",
                    r.kind === "grand" ? "text-lg font-bold" : "text-sm font-semibold",
                    r.kind === "grand" && (negative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"),
                    r.kind !== "grand" && negative && "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {formatMoney(r.amount)}
                </span>
              </button>
              {isOpen && r.children ? (
                <div className="mb-2 ms-5 rounded-xl bg-muted/40 px-3 py-1.5">
                  {r.children.map((c) => (
                    <div key={c.label} className="flex items-center justify-between py-1 text-xs">
                      <span>{c.label}</span>
                      <span className="tabular-nums">{formatMoney(c.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
    </div>
  )
}

export function PnlTab() {
  const today = businessToday()
  const [state, setState] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "pnl", state.period, state.anchor, state.shiftId],
    queryFn: () =>
      fetchPnl({ period: state.period, date: state.anchor, shift: state.shiftId }).then((r) => r.data),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const series = useMemo(
    () =>
      (data?.series ?? [])
        .filter((r) => r.date <= (data?.range.elapsed_end ?? r.date))
        .map((r) => ({
          day: r.date.slice(8),
          revenue: toNumber(r.net_revenue),
          profit: toNumber(r.net_profit ?? r.gross_profit),
        })),
    [data],
  )

  return (
    <div>
      <PeriodBar value={state} onChange={setState} today={today} shifts={data?.shifts} />
      {isLoading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-[26px]" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[26px]" />
        </div>
      ) : isError || !data ? (
        <p className="clay-card p-8 text-center text-sm text-muted-foreground">
          تعذّر تحميل الأرباح. حدّث الصفحة.
        </p>
      ) : (
        <PnlBody data={data} series={series} />
      )}
    </div>
  )
}

function PnlBody({
  data,
  series,
}: {
  data: Pnl
  series: { day: string; revenue: number; profit: number }[]
}) {
  const L = data.lines
  const net = toNumber(L.net_revenue)
  const isShift = Boolean(data.shift)
  const bottom = toNumber(isShift ? L.contribution : L.net_profit)
  const prev = data.previous
  const prevBottom = toNumber(isShift ? prev?.contribution : prev?.net_profit)
  const uncosted = toNumber(data.coverage.uncosted_revenue)
  const prevLabel = prev
    ? periodLabel(data.range.period === "custom" ? "day" : data.range.period, prev.start)
    : ""

  const rows: Row[] = [
    { label: "إجمالي المبيعات", amount: toNumber(L.gross_sales), kind: "line", hint: "قبل أي خصم" },
    { label: "خصومات الكاشير", amount: -toNumber(L.discounts), kind: "less", hideIfZero: true },
    { label: "نقاط استخدمها الزبائن", amount: -toNumber(L.points_redeemed), kind: "less", hideIfZero: true },
    {
      label: "مرتجعات",
      amount: -toNumber(L.returns),
      kind: "less",
      hideIfZero: true,
      hint: data.kpis.returns_count
        ? `${formatNumber(data.kpis.returns_count)} مرتجع${data.kpis.remakes ? ` · ${formatNumber(data.kpis.remakes)} إعادة تحضير` : ""}`
        : undefined,
    },
    { label: "صافي الإيراد", amount: net, kind: "total" },
    { label: "تكلفة المشروبات المباعة", amount: -toNumber(L.cogs), kind: "less" },
    { label: "هدر المخزون", amount: -toNumber(L.waste), kind: "less", hideIfZero: true },
    { label: "إجمالي الربح", amount: toNumber(L.gross_profit), kind: "total" },
  ]
  if (isShift) {
    rows.push(
      { label: "أجور الوردية", amount: -toNumber(L.shift_wages), kind: "less", hint: `${formatMoney(data.shift?.wage_per_day)} يومياً` },
      { label: "مساهمة الوردية", amount: bottom, kind: "grand" },
    )
  } else {
    rows.push(
      {
        label: "المصاريف التشغيلية",
        amount: -toNumber(L.opex),
        kind: "less",
        hint: data.range.days > 1 ? undefined : "حصة اليوم من مصاريف الشهر",
        children: (data.opex ?? []).map((o) => ({ label: o.name, amount: toNumber(o.amount) })),
      },
      { label: "صافي الربح", amount: bottom, kind: "grand" },
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="صافي الإيراد"
          value={formatMoney(net)}
          delta={<Delta now={net} before={toNumber(prev?.net_revenue)} />}
        />
        <Kpi
          label="إجمالي الربح"
          value={formatMoney(L.gross_profit)}
          sub={`هامش ${data.kpis.gross_margin_pct}%`}
          delta={<Delta now={toNumber(L.gross_profit)} before={toNumber(prev?.gross_profit)} />}
        />
        <Kpi
          label={isShift ? "مساهمة الوردية" : "صافي الربح"}
          value={formatMoney(bottom)}
          tone={bottom >= 0 ? "good" : "bad"}
          sub={!isShift && data.kpis.net_margin_pct ? `هامش ${data.kpis.net_margin_pct}%` : undefined}
          delta={<Delta now={bottom} before={prevBottom} />}
        />
        <Kpi
          label="الفواتير"
          value={formatNumber(data.kpis.tickets)}
          delta={<Delta now={data.kpis.tickets} before={prev?.tickets} />}
        />
        <Kpi label="متوسط الفاتورة" value={formatMoney(data.kpis.avg_ticket)} />
        <Kpi
          label="تكلفة الكوب"
          value={formatMoney(data.kpis.cost_per_cup)}
          sub={`${formatNumber(Math.round(toNumber(data.kpis.cups)))} صنف مباع`}
        />
      </div>

      {uncosted > 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {formatMoney(uncosted)} من المبيعات بدون تكلفة مسجّلة ({formatNumber(data.coverage.uncosted_lines)} بند)،
            فالربح هنا أعلى من الحقيقي. أضف التكلفة لكل مشروب من المنيو — البيع الجديد يُحسب بها تلقائياً.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="clay-card p-5 lg:col-span-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-heading text-base font-bold">
              {isShift ? `الوردية: ${data.shift?.name}` : "قائمة الأرباح"}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {data.range.days} {data.range.days === 1 ? "يوم" : "أيام"}
              {data.range.elapsed_end < data.range.end ? " حتى اليوم" : ""}
              {prev
                ? ` · مقارنة بـ${prevLabel}${data.range.elapsed_end < data.range.end ? " (نفس عدد الأيام)" : ""}`
                : ""}
            </span>
          </div>
          <Statement rows={rows} base={net} />

          <div className="mt-4 rounded-2xl bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Info className="size-3.5" />
              للعلم — لا تُخصم من الربح
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span>
                  نقاط عند الزبائن لم تُستخدم بعد
                  <span className="ms-1 text-muted-foreground">({formatNumber(data.memo.points_outstanding)} نقطة)</span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(data.memo.points_outstanding_value)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>
                  مشتريات المخزون في الفترة
                  <span className="ms-1 text-muted-foreground">(تُحسب تكلفتها عند بيع المشروب)</span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(data.memo.purchases)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {series.length > 1 ? (
            <div className="clay-card p-5">
              <h3 className="font-heading text-base font-bold">الإيراد والربح يومياً</h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                الأعمدة صافي الإيراد، والخط {isShift ? "إجمالي الربح" : "صافي الربح بعد حصة اليوم من المصاريف"}
              </p>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ left: 0, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                      formatter={(v, n) => [formatMoney(Number(v)), n === "revenue" ? "الإيراد" : "الربح"]}
                    />
                    <Bar dataKey="revenue" fill="var(--primary)" opacity={0.35} radius={[6, 6, 0, 0]} />
                    <Line dataKey="profit" stroke="var(--chart-2, #16a34a)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {!isShift ? (
            <div className="clay-card p-5">
              <h3 className="font-heading text-base font-bold">نقطة التعادل</h3>
              {data.kpis.break_even_daily ? (
                <>
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                    {formatMoney(data.kpis.break_even_daily)}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">يومياً</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    مبيعات يومية تغطي المصاريف الثابتة بهامش الربح الحالي ({data.kpis.gross_margin_pct}%).
                    المعدّل الفعلي في هذه الفترة{" "}
                    <b className="text-foreground">{formatMoney(net / Math.max(1, data.range.days))}</b> يومياً.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  سجّل المصاريف الشهرية (إيجار، رواتب…) لتظهر نقطة التعادل.
                </p>
              )}
            </div>
          ) : null}

          <div className="clay-card p-5">
            <h3 className="font-heading text-base font-bold">المرتجعات</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-muted/50 px-2 py-2">
                <p className="font-heading text-base font-bold">{formatNumber(data.kpis.returns_count)}</p>
                <p className="text-[10px] text-muted-foreground">مرتجع</p>
              </div>
              <div className="rounded-2xl bg-muted/50 px-2 py-2">
                <p className="font-heading text-base font-bold">{formatNumber(data.kpis.remakes)}</p>
                <p className="text-[10px] text-muted-foreground">إعادة تحضير</p>
              </div>
              <div className="rounded-2xl bg-muted/50 px-2 py-2">
                <p className="font-heading text-base font-bold tabular-nums">
                  {formatMoney(data.kpis.returns_cost_written_off)}
                </p>
                <p className="text-[10px] text-muted-foreground">تكلفة ضاعت</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

