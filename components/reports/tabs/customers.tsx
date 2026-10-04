"use client"

/* الزبائن — who comes back, who spends, and what the points scheme costs. */
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { fetchCustomersReport, type PnlQuery } from "@/api/finance"
import { Empty, Failed, Panel, Stat, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber } from "@/lib/format"

export function CustomersTab({ q }: { q: PnlQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "customers", q.period, q.date],
    queryFn: () => fetchCustomersReport(q).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  const P = data.points
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="زبائن زاروا" value={formatNumber(data.customers)} sub={`${formatNumber(data.returning)} عائد · ${formatNumber(data.new)} لأول مرة`} />
        <Stat label="فواتير باسم زبون" value={`${data.identified_share}%`} sub={`${formatNumber(data.identified)} من ${formatNumber(data.tickets)} فاتورة`} />
        <Stat label="زبائن جدد سُجّلوا" value={formatNumber(data.added)} />
        <Stat label="نقاط لم تُستخدم" value={formatMoney(P.outstanding_value)} sub={`${formatNumber(P.outstanding)} نقطة مستحقة`} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        كل فاتورة بلا زبون هي نقاط لم تُمنح وزيارة لا نعرف صاحبها — اربط الزبون عند الكاونتر.
      </p>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="أفضل الزبائن" hint="بما صرفوه في الفترة" flush>
          {data.top.length === 0 ? (
            <Empty>لا زبائن مرتبطون بفواتير هذه الفترة</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] text-muted-foreground">
                <tr className="border-y border-border/70">
                  <th className="px-4 py-2 text-start font-medium">الزبون</th>
                  <th className="px-2 py-2 text-center font-medium">زيارات</th>
                  <th className="hidden px-2 py-2 text-end font-medium sm:table-cell">متوسط</th>
                  <th className="px-2 py-2 text-end font-medium">صرف</th>
                  <th className="px-4 py-2 text-end font-medium">نقاطه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.top.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <p className="text-[11px] text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{c.phone}</p>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{formatNumber(c.visits)}</td>
                    <td className="hidden px-2 py-2 text-end tabular-nums sm:table-cell">{formatMoney(c.avg)}</td>
                    <td className="px-2 py-2 text-end font-semibold tabular-nums">{formatMoney(c.spend)}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-muted-foreground">{formatNumber(c.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="النقاط في الفترة" hint="١٠ نقاط = ١ ₪">
          <dl className="divide-y divide-border/70 text-sm">
            <div className="flex justify-between py-2.5">
              <dt>كسبها الزبائن</dt>
              <dd className="text-end"><b className="tabular-nums">{formatNumber(P.earned)}</b><p className="text-[11px] text-muted-foreground">{formatMoney(P.earned_value)}</p></dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt>استخدموها في الدفع</dt>
              <dd className="text-end"><b className="tabular-nums">{formatNumber(P.redeemed)}</b><p className="text-[11px] text-muted-foreground">{formatMoney(P.redeemed_value)}</p></dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt>رصيد مستحق الآن</dt>
              <dd className="text-end"><b className="tabular-nums">{formatNumber(P.outstanding)}</b><p className="text-[11px] text-muted-foreground">{formatMoney(P.outstanding_value)}</p></dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  )
}
