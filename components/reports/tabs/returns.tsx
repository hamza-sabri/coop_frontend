"use client"

/* المرتجعات — what came back over the counter, and why. A remake costs the
 * drink but no money; a refund costs both. */
import { useQuery } from "@tanstack/react-query"

import { fetchReturnsReport, type PnlQuery, type ReturnsReport } from "@/api/finance"

type Ret = ReturnsReport["latest"][number]
import { BarList, Empty, Failed, Panel, Stat, TabSkeleton } from "@/components/reports/kit"
import { Bars } from "@/components/charts"
import { DataTable } from "@/components/data-table"
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="مرتجعات" value={formatNumber(data.count)} sub={`${data.rate_pct}٪ من الطلبات`} tone={toNumber(data.rate_pct) > 3 ? "warn" : undefined} />
        <Stat label="إعادة تحضير" value={formatNumber(data.remakes)} sub="بدون استرداد مبلغ" />
        <Stat label="أُعيد للزبائن" value={formatMoney(data.refunds)} />
        <Stat label="تكلفة ضاعت" value={formatMoney(data.written_off)} sub="مشروبات حُضّرت ثم أُرجعت" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="لماذا أُرجعت" hint="عدد المرتجعات لكل سبب">
          {data.by_reason.length ? (
            <Bars height={220} showValues data={data.by_reason.map((r) => ({ label: r.label, value: r.count }))} format={(v) => `${formatNumber(v)} مرة`} />
          ) : (
            <Empty>لا مرتجعات في هذه الفترة</Empty>
          )}
        </Panel>
        <Panel title="أي الأصناف" hint="الأكثر إرجاعاً">
          <BarList rows={data.by_item.map((r) => ({ key: r.name, label: r.name, value: r.count }))} format={(v) => formatNumber(v)} empty="لا مرتجعات في هذه الفترة" />
        </Panel>
      </div>
      <DataTable<Ret>
        rows={data.latest}
        rowKey={(r) => r.id}
        columns={[
          { key: "item", header: "المشروب", sort: (r) => r.item, cell: (r) => <span className="font-medium">{r.item}</span> },
          {
            key: "why",
            header: "السبب",
            sort: (r) => r.reason,
            cell: (r) => (
              <span>
                {r.reason}
                {r.note ? <span className="text-xs text-muted-foreground"> — {r.note}</span> : null}
              </span>
            ),
          },
          { key: "by", header: "الموظف", width: "w-28", hideBelow: "lg", cell: (r) => <span className="text-muted-foreground">{r.by || "—"}</span> },
          {
            key: "money",
            header: "ماذا كلّف",
            width: "w-32",
            align: "end",
            sort: (r) => toNumber(r.refund),
            cell: (r) => (toNumber(r.refund) ? <span className="tabular-nums">أُعيد {formatMoney(r.refund)}</span> : <span className="text-muted-foreground">حُضّر من جديد</span>),
          },
          { key: "at", header: "متى", width: "w-28", align: "end", sort: (r) => r.at, cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.at)}</span> },
        ]}
        searchText={(r) => `${r.item} ${r.reason} ${r.note ?? ""} ${r.by ?? ""}`}
        searchPlaceholder="ابحث في المرتجعات…"
        defaultSort={{ key: "at", dir: "desc" }}
        empty="لا مرتجعات في هذه الفترة"
        mobileRow={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{r.item}</p>
              <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.at)}</span>
          </div>
        )}
      />
    </div>
  )
}
