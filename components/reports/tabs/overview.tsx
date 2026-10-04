"use client"

/* نظرة عامة — four numbers, one chart, the drinks that carried the period.
 * Everything else has its own tab. */
import { useQuery } from "@tanstack/react-query"
import { AreaTrend, Bars } from "@/components/charts"
import { AlertTriangle } from "lucide-react"

import { fetchItems, fetchPnl, type PnlQuery } from "@/api/finance"
import { BarList, Failed, Panel, Stat, TabSkeleton, Versus } from "@/components/reports/kit"
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
    .map((r) => ({ label: `${Number(r.date.slice(8))}/${Number(r.date.slice(5, 7))}`, title: formatDate(r.date), revenue: toNumber(r.net_revenue) }))
  const top = (items.data?.items ?? []).filter((i) => toNumber(i.qty) > 0)
  const uncosted = toNumber(d.coverage.uncosted_revenue)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="دخل الصندوق" value={formatMoney(net)} sub={<Versus now={net} before={toNumber(prev?.net_revenue)} />} />
        <Stat
          label="ربحك بعد كل المصاريف"
          value={formatMoney(profit)}
          tone={profit >= 0 ? "good" : "bad"}
          sub={<Versus now={profit} before={toNumber(prev?.net_profit)} />}
        />
        <Stat label="عدد الفواتير" value={formatNumber(d.kpis.tickets)} sub={<Versus now={d.kpis.tickets} before={prev?.tickets} />} />
        <Stat label="متوسط الفاتورة" value={formatMoney(d.kpis.avg_ticket)} sub={`الكوب يكلّفك ${formatMoney(d.kpis.cost_per_cup)} في المتوسط`} />
      </div>

      {uncosted > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            بعت بـ {formatMoney(uncosted)} مشروبات لم تكتب تكلفتها، فالربح هنا أعلى من الحقيقي. اكتب التكلفة من صفحة المنيو.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="دخل الصندوق يوماً بيوم"
          hint={days.length > 1 ? "كل يوم عمل يبدأ الساعة ٤ فجراً" : "اختر أسبوعاً أو شهراً لرؤية الأيام"}
        >
          {days.length > 1 ? (
            days.length > 14 ? (
              <AreaTrend height={240} data={days.map((x) => ({ label: x.label, title: x.title, value: x.revenue }))} format={(v) => formatMoney(v)} />
            ) : (
              <Bars height={240} data={days.map((x) => ({ label: x.label, title: x.title, value: x.revenue }))} format={(v) => formatMoney(v)} />
            )
          ) : (
            <p className="py-10 text-center font-heading text-3xl font-bold tabular-nums">{formatMoney(net)}</p>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="الأكثر طلباً"
          hint="بعدد المرات — اضغط مشروباً لتفاصيله"
          action={
            <button type="button" onClick={() => goTo("items")} className="text-xs font-semibold text-primary hover:underline">
              كل المشروبات
            </button>
          }
        >
          <BarList
            rows={top
              .slice()
              .sort((a, b) => toNumber(b.qty) - toNumber(a.qty))
              .slice(0, 7)
              .map((i) => ({ key: i.product_id, label: i.name, value: toNumber(i.qty) }))}
            format={(v) => `${formatNumber(Math.round(v))} مرة`}
            onPick={(k) => onOpenItem(Number(k))}
          />
        </Panel>
      </div>
    </div>
  )
}
