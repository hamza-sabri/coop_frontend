"use client"

/* نظرة عامة — four numbers, one chart, the drinks that carried the period.
 * Everything else has its own tab. */
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle } from "lucide-react"

import { fetchItems, fetchPnl, type PnlQuery } from "@/api/finance"
import { AXIS, BarList, Delta, Failed, Panel, Stat, TabSkeleton, TOOLTIP_STYLE } from "@/components/reports/kit"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"

export function OverviewTab({ q, onOpenItem, goTo }: { q: PnlQuery; onOpenItem: (id: number) => void; goTo: (tab: string) => void }) {
  const pnl = useQuery({
    queryKey: ["reports", "pnl", q.period, q.date, null],
    queryFn: () => fetchPnl({ ...q, shift: null }).then((r) => r.data),
    placeholderData: (p) => p,
  })
  const items = useQuery({
    queryKey: ["reports", "items", q.period, q.date],
    queryFn: () => fetchItems(q).then((r) => r.data),
    placeholderData: (p) => p,
  })

  if (pnl.isLoading && !pnl.data) return <TabSkeleton />
  if (!pnl.data) return <Failed />
  const d = pnl.data
  const L = d.lines
  const prev = d.previous
  const net = toNumber(L.net_revenue)
  const profit = toNumber(L.net_profit)
  const days = (d.series ?? [])
    .filter((r) => r.date <= d.range.elapsed_end)
    .map((r) => ({ day: Number(r.date.slice(8)), revenue: toNumber(r.net_revenue) }))
  const top = (items.data?.items ?? []).filter((i) => toNumber(i.qty) > 0)
  const uncosted = toNumber(d.coverage.uncosted_revenue)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="صافي الإيراد" value={formatMoney(net)} delta={<Delta now={net} before={toNumber(prev?.net_revenue)} />} />
        <Stat
          label="صافي الربح"
          value={formatMoney(profit)}
          tone={profit >= 0 ? "good" : "bad"}
          delta={<Delta now={profit} before={toNumber(prev?.net_profit)} />}
          sub={d.kpis.net_margin_pct ? `هامش ${d.kpis.net_margin_pct}%` : undefined}
        />
        <Stat label="الفواتير" value={formatNumber(d.kpis.tickets)} delta={<Delta now={d.kpis.tickets} before={prev?.tickets} />} />
        <Stat label="متوسط الفاتورة" value={formatMoney(d.kpis.avg_ticket)} sub={`تكلفة الكوب ${formatMoney(d.kpis.cost_per_cup)}`} />
      </div>

      {prev ? (
        <p className="text-[11px] text-muted-foreground">
          النسب مقارنة بالفترة السابقة ({formatDate(prev.start)} – {formatDate(prev.end)}){d.range.elapsed_end < d.range.end ? "، بنفس عدد الأيام" : ""}.
        </p>
      ) : null}

      {uncosted > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {formatMoney(uncosted)} من المبيعات لأصناف بلا تكلفة مسجلة، فالربح هنا أعلى من الحقيقي. أضف التكلفة من المنيو.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="الإيراد يومياً"
          hint={days.length > 1 ? "صافي ما دخل الصندوق كل يوم عمل (يبدأ اليوم الساعة ٤ فجراً)" : "اختر أسبوعاً أو شهراً لرؤية الأيام"}
        >
          {days.length > 1 ? (
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ left: 0, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" />
                  <YAxis {...AXIS} width={44} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatMoney(Number(v)), "الإيراد"]} labelFormatter={(l) => `يوم ${l}`} />
                  <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center font-heading text-3xl font-bold tabular-nums">{formatMoney(net)}</p>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="الأكثر مبيعاً"
          hint="بعدد الأكواب — اضغط صنفاً لتفاصيله"
          action={
            <button type="button" onClick={() => goTo("items")} className="text-xs font-semibold text-primary hover:underline">
              كل الأصناف
            </button>
          }
        >
          <BarList
            rows={top
              .slice()
              .sort((a, b) => toNumber(b.qty) - toNumber(a.qty))
              .slice(0, 6)
              .map((i) => ({ key: i.product_id, label: i.name, value: toNumber(i.qty) }))}
            format={(v) => `${formatNumber(Math.round(v))} كوب`}
            onPick={(k) => onOpenItem(Number(k))}
          />
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="إجمالي الربح" value={formatMoney(L.gross_profit)} sub={`هامش ${d.kpis.gross_margin_pct}% بعد تكلفة المشروبات`} />
        <Stat label="المصاريف" value={formatMoney(L.opex)} sub="حصة الفترة من الإيجار والرواتب والفواتير" />
        <Stat
          label="نقطة التعادل"
          value={d.kpis.break_even_daily ? formatMoney(d.kpis.break_even_daily) : "—"}
          sub={d.kpis.break_even_daily ? "مبيعات يومية تغطي المصاريف" : "سجّل المصاريف لتظهر"}
        />
      </div>
    </div>
  )
}
