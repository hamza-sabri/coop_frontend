"use client"

/* المرتجعات — what came back over the counter, and why. A remake costs the
 * drink but no money; a refund costs both. */
import { useQuery } from "@tanstack/react-query"

import { fetchReturnsReport, type PnlQuery } from "@/api/finance"
import { BarList, Empty, Failed, Panel, Stat, TabSkeleton } from "@/components/reports/kit"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"

export function ReturnsTab({ q }: { q: PnlQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "returns", q.period, q.date],
    queryFn: () => fetchReturnsReport(q).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="مرتجعات" value={formatNumber(data.count)} sub={`${data.rate_pct}% من الأكواب`} tone={toNumber(data.rate_pct) > 3 ? "warn" : undefined} />
        <Stat label="إعادة تحضير" value={formatNumber(data.remakes)} sub="بدون استرداد مبلغ" />
        <Stat label="أُعيد للزبائن" value={formatMoney(data.refunds)} />
        <Stat label="تكلفة ضاعت" value={formatMoney(data.written_off)} sub="مشروبات حُضّرت ثم أُرجعت" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="لماذا أُرجعت" hint="عدد المرتجعات لكل سبب">
          <BarList rows={data.by_reason.map((r) => ({ key: r.reason, label: r.label, value: r.count, sub: toNumber(r.refunds) ? formatMoney(r.refunds) : undefined }))} format={(v) => formatNumber(v)} empty="لا مرتجعات في هذه الفترة" />
        </Panel>
        <Panel title="أي الأصناف" hint="الأكثر إرجاعاً">
          <BarList rows={data.by_item.map((r) => ({ key: r.name, label: r.name, value: r.count }))} format={(v) => formatNumber(v)} empty="لا مرتجعات في هذه الفترة" />
        </Panel>
      </div>
      <Panel title="آخر المرتجعات" flush>
        {data.latest.length === 0 ? (
          <Empty>لا مرتجعات في هذه الفترة</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] text-muted-foreground">
              <tr className="border-y border-border/70">
                <th className="px-4 py-2 text-start font-medium">الصنف</th>
                <th className="px-2 py-2 text-start font-medium">السبب</th>
                <th className="hidden px-2 py-2 text-start font-medium sm:table-cell">الموظف</th>
                <th className="px-2 py-2 text-end font-medium">المبلغ</th>
                <th className="px-4 py-2 text-end font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.latest.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">{r.item}</td>
                  <td className="px-2 py-2">{r.reason}{r.note ? <span className="text-[11px] text-muted-foreground"> — {r.note}</span> : null}</td>
                  <td className="hidden px-2 py-2 text-muted-foreground sm:table-cell">{r.by || "—"}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{toNumber(r.refund) ? formatMoney(r.refund) : "إعادة تحضير"}</td>
                  <td className="px-4 py-2 text-end text-[11px] text-muted-foreground">{formatDate(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
