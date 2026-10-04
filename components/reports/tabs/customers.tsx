"use client"

/* الزبائن — who comes back, who spends, and what the points scheme costs. */
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { fetchCustomersReport, type CustomersReport, type PnlQuery } from "@/api/finance"
import { DataTable } from "@/components/data-table"
import { Failed, Panel, Stat, TabSkeleton } from "@/components/reports/kit"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatMoney, formatNumber } from "@/lib/format"

type Top = CustomersReport["top"][number]

function Face({ c }: { c: Top }) {
  return (
    <Avatar className="size-9 shrink-0">
      {c.avatar ? <AvatarImage src={c.avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{c.name.charAt(0)}</AvatarFallback>
    </Avatar>
  )
}

export function CustomersTab({ q }: { q: PnlQuery }) {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "customers", q.period, q.date],
    queryFn: () => fetchCustomersReport(q).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  const P = data.points
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="زبائن زاروا" value={formatNumber(data.customers)} sub={`${formatNumber(data.returning)} عائد · ${formatNumber(data.new)} لأول مرة`} />
        <Stat label="فواتير باسم زبون" value={`${data.identified_share}%`} sub={`${formatNumber(data.identified)} من ${formatNumber(data.tickets)} فاتورة`} />
        <Stat label="زبائن جدد سُجّلوا" value={formatNumber(data.added)} />
        <Stat label="نقاط لم تُستخدم" value={formatMoney(P.outstanding_value)} sub={`${formatNumber(P.outstanding)} نقطة مستحقة`} />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable<Top>
            rows={data.top}
            rowKey={(c) => c.id}
            columns={[
              {
                key: "name",
                header: "أفضل الزبائن",
                cell: (c) => (
                  <div className="flex items-center gap-3">
                    <Face c={c} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-end text-xs text-muted-foreground [direction:ltr] [unicode-bidi:plaintext]">{c.phone}</p>
                    </div>
                  </div>
                ),
              },
              { key: "visits", header: "زيارات", width: "w-24", align: "center", sort: (c) => c.visits, cell: (c) => <span className="tabular-nums">{formatNumber(c.visits)}</span> },
              { key: "avg", header: "متوسط الفاتورة", width: "w-32", align: "end", hideBelow: "lg", sort: (c) => Number(c.avg), cell: (c) => <span className="tabular-nums">{formatMoney(c.avg)}</span> },
              { key: "spend", header: "صرف", width: "w-32", align: "end", sort: (c) => Number(c.spend), cell: (c) => <span className="font-semibold tabular-nums">{formatMoney(c.spend)}</span> },
            ]}
            defaultSort={{ key: "spend", dir: "desc" }}
            onRowClick={(c) => router.push(`/customers/${c.id}`)}
            empty="لا زبائن مرتبطون بفواتير هذه الفترة"
            mobileRow={(c) => (
              <div className="flex items-center gap-3">
                <Face c={c} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(c.visits)} زيارة</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(c.spend)}</span>
              </div>
            )}
          />
        </div>
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
          <p className="mt-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            كل فاتورة بلا اسم زبون هي نقاط لم تُعطَ وزيارة لا نعرف صاحبها — اختر الزبون عند الكاشير.
          </p>
        </Panel>
      </div>
    </div>
  )
}
