"use client"

/* One drink's report — used in two places: the drink's own drawer in the menu
 * (tab التقارير) and the الأصناف report tab. Same component, so the numbers
 * cannot disagree between them. */
import { useQuery } from "@tanstack/react-query"
import { Clock } from "lucide-react"

import { fetchItem, type PnlQuery } from "@/api/finance"
import { Bars, hourShort, hourSpoken } from "@/components/charts"
import { BarList, Empty, Failed, Panel, Stat } from "@/components/reports/kit"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { label as periodLabel } from "@/lib/period"

function ago(iso: string | null): string {
  if (!iso) return "لم يُبع بعد"
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `قبل ${Math.max(1, mins)} دقيقة`
  const h = Math.round(mins / 60)
  if (h < 24) return `قبل ${h} ساعة`
  const d = Math.round(h / 24)
  return d === 1 ? "أمس" : `قبل ${d} يوم`
}

const n0 = (v: string | number) => formatNumber(Math.round(toNumber(v)))

export function ItemReport({ productId, q }: { productId: number; q: PnlQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "item", productId, q.period, q.date],
    queryFn: () => fetchItem(productId, q).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }
  if (!data) return <Failed />
  const P = data.period
  const days = data.days.map((d) => ({ day: Number(d.date.slice(8)), qty: toNumber(d.qty) }))
  // Opening to close, across midnight — 13 … 23, 00, 01 — not 0 to 23.
  const hours = [...data.by_hour]
    .sort((a, b) => ((a.hour - 4 + 24) % 24) - ((b.hour - 4 + 24) % 24))
    .map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}`, qty: toNumber(h.qty) }))
  const periodName = q.period === "custom" ? "" : periodLabel(q.period, q.date ?? P.start)

  return (
    <div className="stagger space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        آخر طلب: <b className="text-foreground">{ago(data.last_sold_at)}</b>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="اليوم" value={n0(data.cups.today)} sub="كوب" />
        <Stat label="آخر ٧ أيام" value={n0(data.cups.week)} sub="كوب" />
        <Stat label="آخر ٣٠ يوماً" value={n0(data.cups.month)} sub="كوب" />
      </div>

      <Panel title={`في ${periodName || "الفترة"}`} hint={P.rank ? `الترتيب ${P.rank} من ${P.of} بعدد الأكواب` : undefined}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-muted-foreground">الأكواب</dt>
            <dd className="font-heading text-lg font-bold tabular-nums">{n0(P.qty)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">الإيراد</dt>
            <dd className="font-heading text-lg font-bold tabular-nums">{formatMoney(P.revenue)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">الربح</dt>
            <dd className="font-heading text-lg font-bold tabular-nums">{formatMoney(P.profit)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">ربح الكوب الواحد</dt>
            <dd className="font-heading text-lg font-bold tabular-nums">
              {data.product.unit_profit ? formatMoney(data.product.unit_profit) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          يساهم بـ<b className="text-foreground"> {P.profit_share}% </b>من ربح كل المنيو
          {data.product.unit_profit ? null : (
            <> · <span className="text-amber-700 dark:text-amber-400">أضف تكلفته في الأساسية ليظهر ربحه</span></>
          )}
        </p>
      </Panel>

      {days.length > 1 ? (
        <Panel title="الأكواب يومياً">
          <Bars
            height={160}
            data={days.map((d) => ({ label: String(d.day), value: Number(d.qty), title: `يوم ${d.day}` }))}
            format={(v) => `${n0(v)} كوب`}
          />
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title="متى يُطلب" hint="حسب الساعة">
          {hours.length ? (
            <Bars
              height={150}
              data={hours.map((h) => ({ label: hourShort(Number(h.hour)), value: Number(h.qty), title: hourSpoken(Number(h.hour)) }))}
              format={(v) => `${n0(v)} كوب`}
            />
          ) : (
            <Empty>لا طلبات في الفترة</Empty>
          )}
        </Panel>
        <Panel title="الأحجام" hint="أي حجم يُطلب وكم يربح">
          {data.sizes.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th className="pb-1.5 text-start font-medium">الحجم</th>
                  <th className="pb-1.5 text-center font-medium">كم كوب</th>
                  <th className="pb-1.5 text-end font-medium">الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.sizes.map((s) => (
                  <tr key={s.label}>
                    <td className="py-1.5">{s.label}</td>
                    <td className="py-1.5 text-center tabular-nums">{n0(s.qty)}</td>
                    <td className="py-1.5 text-end font-semibold tabular-nums">{formatMoney(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>لا مبيعات</Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title="أكثر من يطلبه">
          <BarList
            rows={data.buyers.map((b) => ({ key: b.customer_id, label: b.name, value: toNumber(b.qty) }))}
            format={(v) => `${n0(v)} كوب`}
            empty="لا زبائن مسجلين على هذا الصنف"
          />
        </Panel>
        <Panel title="المرتجعات">
          <BarList
            rows={data.returns.map((r) => ({ key: r.reason, label: r.reason, value: r.count }))}
            format={(v) => n0(v)}
            empty="لا مرتجعات — ممتاز"
          />
        </Panel>
      </div>
    </div>
  )
}

export function ItemReportSheet({
  productId,
  name,
  q,
  onClose,
}: {
  productId: number | null
  name?: string
  q: PnlQuery
  onClose: () => void
}) {
  return (
    <Sheet open={productId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" size="lg" className="flex flex-col gap-0 p-0">
        <div className="border-b px-5 pb-3 pt-5">
          <SheetTitle className="font-heading text-lg">{name ?? "الصنف"}</SheetTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{productId != null ? <ItemReport productId={productId} q={q} /> : null}</div>
      </SheetContent>
    </Sheet>
  )
}
