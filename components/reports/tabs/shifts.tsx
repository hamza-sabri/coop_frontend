"use client"

/* الورديات — the shifts side by side. Each shows what came in, what the
 * drinks cost, what its staff cost for the days shown, and what was left:
 * what the shift CONTRIBUTED. Never net profit — rent does not belong to a
 * shift. */
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { fetchShiftsReport, type PnlQuery } from "@/api/finance"
import { Empty, Failed, Panel, SURFACE, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ShiftsTab({ q }: { q: PnlQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "shifts", q.period, q.date],
    queryFn: () => fetchShiftsReport(q).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  if (data.shifts.length === 0) {
    return (
      <Panel>
        <Empty>
          لا ورديات بعد.{" "}
          <Link href="/settings?tab=shifts" className="font-semibold text-primary hover:underline">
            أضفها من الإعدادات
          </Link>
        </Empty>
      </Panel>
    )
  }
  const best = data.shifts.reduce((a, b) => (toNumber(a.contribution) >= toNumber(b.contribution) ? a : b))
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", data.shifts.length > 1 ? "md:grid-cols-2" : "")}>
        {data.shifts.map((s) => {
          const c = toNumber(s.contribution)
          const rows: [string, string, boolean?][] = [
            ["صافي الإيراد", formatMoney(s.net_revenue)],
            ["− تكلفة المشروبات", formatMoney(s.cogs), true],
            ["− أجور الوردية", formatMoney(s.wages), true],
          ]
          return (
            <section key={s.id} className={cn(SURFACE, "p-5", s.id === best.id && data.shifts.length > 1 && "border-primary/50")}>
              <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-lg font-bold">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr">{s.start}–{s.end}</span> · {toNumber(s.hours)} ساعات
                  </p>
                </div>
                <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold tabular-nums">{s.share}% من الإيراد</span>
              </header>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="font-heading text-lg font-bold tabular-nums">{formatNumber(s.tickets)}</p>
                  <p className="text-[11px] text-muted-foreground">فاتورة</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="font-heading text-lg font-bold tabular-nums">{formatMoney(s.avg_ticket)}</p>
                  <p className="text-[11px] text-muted-foreground">متوسط الفاتورة</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="font-heading text-lg font-bold tabular-nums">{formatMoney(s.per_hour)}</p>
                  <p className="text-[11px] text-muted-foreground">إيراد الساعة</p>
                </div>
              </div>
              <dl className="mt-4 divide-y divide-border/70 text-sm">
                {rows.map(([k, v, less]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className={less ? "text-muted-foreground" : ""}>{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between pt-2.5">
                  <dt className="font-semibold">ما ساهمت به</dt>
                  <dd className={cn("font-heading text-lg font-bold tabular-nums", c >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                    {formatMoney(c)}
                  </dd>
                </div>
              </dl>
              {s.top_item ? <p className="mt-3 text-xs text-muted-foreground">الأكثر طلباً: <b className="text-foreground">{s.top_item}</b></p> : null}
            </section>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        الأجور من «أجر الوردية يومياً» في الإعدادات. الإيجار والفواتير لا تُوزَّع على الورديات — تجدها في تبويب الأرباح.
      </p>
    </div>
  )
}
