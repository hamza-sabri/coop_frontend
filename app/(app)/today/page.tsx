"use client"

/* ==========================================================================
   اليوم — cashing up.

   This is not the monthly report with a shorter window on it. An owner closing
   the shop asks a different set of questions from an owner reviewing a month:
   how much is in the drawer, how much of today was paid for with points rather
   than money, was it busier or quieter than yesterday, what did we actually
   sell, and is anything still sitting open on the board.

   So: one screen, no filters, no period picker, nothing to configure. It
   refreshes itself every half minute and it is never served from cache,
   because a figure five minutes old is a figure that disagrees with the notes
   in somebody's hand.
   ========================================================================== */
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Coffee,
  Gift,
  Receipt,
  Smartphone,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { todayReport, type TodayReport } from "@/api/reports"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

function Tile({
  label,
  value,
  sub,
  icon,
  big,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  icon?: React.ReactNode
  big?: boolean
}) {
  return (
    <div className={cn("clay-card rep-kpi p-4", big && "sm:col-span-2")}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-heading font-bold tracking-tight tabular-nums",
            big ? "text-3xl" : "text-xl",
          )}
        >
          {value}
        </p>
        {icon ? <span className="mt-1 text-primary">{icon}</span> : null}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      {sub ? <div className="mt-0.5 text-[11px]">{sub}</div> : null}
    </div>
  )
}

export default function TodayPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "today"],
    queryFn: todayReport,
    // The drawer does not wait. Cheap query, uncached server-side.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[26px]" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-[26px]" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <p className="clay-card p-8 text-center text-sm text-muted-foreground">
        تعذّر تحميل ملخّص اليوم. حدّث الصفحة.
      </p>
    )
  }

  const d: TodayReport = data
  const revenue = toNumber(d.revenue)
  const prev = toNumber(d.previous_revenue)
  const delta = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : null
  const up = (delta ?? 0) >= 0
  const busiest = Math.max(...d.by_hour.map((h) => h.count), 0)
  const hours = d.by_hour.map((h) => ({ hour: `${h.hour}`, count: h.count }))
  const maxQty = Math.max(...d.top.map((t) => Math.abs(toNumber(t.qty))), 1)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="اليوم"
        description={`من منتصف الليل حتى الآن · يتحدّث تلقائياً`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile
          big
          label="إيراد اليوم"
          value={formatMoney(revenue)}
          icon={<Receipt className="size-5" />}
          sub={
            delta === null ? (
              <span className="text-muted-foreground">أول يوم فيه مبيعات</span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  up ? "text-lime" : "text-destructive",
                )}
              >
                {up ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {formatNumber(Math.abs(delta))}٪ عن أمس (
                {formatMoney(prev)})
              </span>
            )
          }
        />
        <Tile
          label="الأكواب"
          value={formatNumber(Math.round(toNumber(d.cups)))}
          icon={<Coffee className="size-4" />}
        />
        <Tile label="الفواتير" value={formatNumber(d.tickets)} />
        <Tile label="متوسط الفاتورة" value={formatMoney(d.avg_ticket)} />
        <Tile
          label="دُفع بالنقاط"
          value={formatMoney(d.points_value)}
          icon={<Gift className="size-4" />}
          sub={
            <span className="text-muted-foreground">
              {formatNumber(d.points_spent)} نقطة — ليست في الدرج
            </span>
          }
        />
        {d.returns > 0 && (
          <Tile
            label="مرتجعات"
            value={formatNumber(d.returns)}
            sub={
              <span className="text-destructive">
                {formatMoney(d.returns_value)}
              </span>
            }
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* hour by hour */}
        <div className="clay-card rep-chart p-5 lg:col-span-2">
          <h3 className="font-heading text-base font-bold">ساعة بساعة</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            عدد الفواتير — الساعة الأكثر ازدحاماً بارزة
          </p>
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={34} />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "فاتورة"]}
                  labelFormatter={(l) => `الساعة ${l}:٠٠`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {hours.map((h) => (
                    <Cell
                      key={h.hour}
                      fill={
                        h.count === busiest && busiest > 0
                          ? "var(--primary)"
                          : "color-mix(in oklab, var(--primary) 38%, transparent)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* the app's day */}
        <div className="clay-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="size-4 text-primary" />
            <h3 className="font-heading text-base font-bold">طلبات التطبيق</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.orders.placed)}
              </p>
              <p className="text-[11px] text-muted-foreground">وصل اليوم</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.orders.collected)}
              </p>
              <p className="text-[11px] text-muted-foreground">سُلّم</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.orders.cancelled)}
              </p>
              <p className="text-[11px] text-muted-foreground">أُلغي</p>
            </div>
            {/* The one number on this page that is a TO-DO rather than a
                result: you cannot close the day with a cup still on the pass. */}
            <div
              className={cn(
                "rounded-2xl p-3",
                d.orders.still_open > 0 ? "bg-destructive/12" : "bg-muted/50",
              )}
            >
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.orders.still_open)}
              </p>
              <p className="text-[11px] text-muted-foreground">ما زال مفتوحاً</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <p>
              نقاط مُنحت اليوم:{" "}
              <b className="text-foreground">{formatNumber(d.points.earned)}</b>
            </p>
            <p>
              نقاط استُبدلت:{" "}
              <b className="text-foreground">{formatNumber(d.points.spent)}</b>
            </p>
            <p>
              فواتير معرّفة بزبون:{" "}
              <b className="text-foreground">
                {formatNumber(d.identified_share)}٪
              </b>
            </p>
          </div>
        </div>
      </div>

      {/* what went out */}
      <div className="clay-card p-5">
        <h3 className="font-heading mb-3 text-base font-bold">ما بِيع اليوم</h3>
        {d.top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            لا مبيعات بعد اليوم.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {d.top.map((t, i) => {
              const qty = Math.abs(toNumber(t.qty))
              return (
                <li key={`${t.name}-${i}`} className="relative overflow-hidden rounded-xl">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 start-0 rounded-xl bg-primary/12"
                    style={{ width: `${Math.max(4, (qty / maxQty) * 100)}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate text-sm font-medium">{t.name}</span>
                    <span className="shrink-0 font-heading text-sm font-bold tabular-nums">
                      {formatNumber(Math.round(qty))} كوب
                      <span className="ms-2 text-xs font-normal text-muted-foreground">
                        {formatMoney(t.revenue)}
                      </span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
