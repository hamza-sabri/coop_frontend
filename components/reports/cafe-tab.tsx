"use client"

/* ==========================================================================
   المقهى — the report a coffee shop actually reads.

   The tabs beside this one were written for a shop that holds stock: what is
   priced below cost, what is expiring, what has no barcode, what the shelves
   are worth. A café holds a menu and a crowd, not a warehouse, and its
   questions are different:

     what sells, and — separately — what EARNS. They are never the same list,
       and a shop that only reads the first keeps pushing its cheapest cup;
     what is dead on the menu, including the drinks that sold nothing at all,
       which no "least sold" ranking can show you because they never appear
       on a receipt;
     when it is busy, by hour and by weekday, because that is the rota;
     which sizes people actually buy;
     how much of the till is the app;
     and what the points scheme costs against what it brings back.

   One request, one cached response, one screen.
   ========================================================================== */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
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
  Clock,
  Coffee,
  Gift,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"

import { cafeReport, type CafeDrink, type CafeReport } from "@/api/reports"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="clay-card rep-kpi p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
        {icon ? <span className="mt-0.5 text-primary">{icon}</span> : null}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      {sub ? <p className="text-[10px] text-muted-foreground/70">{sub}</p> : null}
    </div>
  )
}

/** A ranked list with the magnitude drawn behind each row.
 *
 *  Ranked bars rather than a chart with an axis: the reader is comparing
 *  named things against each other, not reading values off a scale, and the
 *  name has to be legible — which a rotated x-axis label never is. */
function Rank({
  title,
  hint,
  rows,
  metric,
  icon,
  empty = "لا توجد بيانات في هذه الفترة",
}: {
  title: string
  hint?: string
  rows: { name: string; value: number; sub?: string }[]
  /** How to render the number at the end of the row. */
  metric: (v: number) => string
  icon?: React.ReactNode
  empty?: string
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  return (
    <div className="clay-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-heading text-base font-bold">{title}</h3>
      </div>
      {hint ? <p className="-mt-2 mb-3 text-xs text-muted-foreground">{hint}</p> : null}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="relative overflow-hidden rounded-xl">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 start-0 rounded-xl bg-primary/12"
                style={{ width: `${Math.max(4, (Math.abs(r.value) / max) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatNumber(i + 1)}
                  </span>
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  {r.sub ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {r.sub}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-heading text-sm font-bold tabular-nums">
                  {metric(r.value)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const cups = (d: CafeDrink) => Math.abs(toNumber(d.quantity))
const money = (d: CafeDrink) => Math.abs(toNumber(d.revenue))

/* ── the tab ────────────────────────────────────────────────────────────── */

export function CafeTab({ days }: { days: number }) {
  const [showAllDead, setShowAllDead] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "cafe", days],
    queryFn: () => cafeReport(days),
    staleTime: 60_000,
    retry: 1,
  })

  const byDay = useMemo(
    () =>
      (data?.when.by_day ?? []).map((d) => ({
        day: d.day.slice(5),
        total: toNumber(d.total),
      })),
    [data],
  )
  const byHour = useMemo(
    () =>
      (data?.when.by_hour ?? []).map((h) => ({
        hour: `${h.hour}`,
        count: h.count,
      })),
    [data],
  )
  const byWeekday = useMemo(
    () =>
      (data?.when.by_weekday ?? []).map((w) => ({
        day: w.day,
        revenue: toNumber(w.revenue),
      })),
    [data],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[26px]" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-[26px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-[26px]" />
          <Skeleton className="h-72 rounded-[26px]" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="clay-card p-8 text-center text-sm text-muted-foreground">
        تعذّر تحميل التقرير. حدّث الصفحة.
      </p>
    )
  }

  const d: CafeReport = data
  const h = d.headline
  const appRevenue = toNumber(d.app.revenue)
  const counterRevenue = Math.max(0, toNumber(h.revenue) - appRevenue)
  const bestHourCount = Math.max(...byHour.map((r) => r.count), 0)

  return (
    <div className="space-y-5">
      {/* ── the headline ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="الإيراد" value={formatMoney(h.revenue)} />
        <Kpi label="الأكواب المباعة" value={formatNumber(Math.round(toNumber(h.cups)))} icon={<Coffee className="size-4" />} />
        <Kpi label="عدد الفواتير" value={formatNumber(h.tickets)} sub={h.returns ? `${formatNumber(h.returns)} مرتجع` : undefined} />
        <Kpi label="متوسط الفاتورة" value={formatMoney(h.avg_ticket)} />
        <Kpi label="أكواب لكل فاتورة" value={formatNumber(toNumber(h.cups_per_ticket))} />
        <Kpi
          label="ساعة الذروة"
          value={h.peak_hour != null ? `${formatNumber(h.peak_hour)}:٠٠` : "—"}
          sub={h.peak_day ? `أكثر يوم: ${h.peak_day}` : undefined}
          icon={<Clock className="size-4" />}
        />
      </div>

      {/* ── revenue over time + where it came from ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="clay-card rep-chart p-5 lg:col-span-2">
          <h3 className="font-heading mb-2 text-base font-bold">الإيراد اليومي</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay} margin={{ left: 4, right: 4 }}>
                <defs>
                  <linearGradient id="cafe-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={46} />
                <Tooltip formatter={(v) => [formatMoney(Number(v)), "الإيراد"]} />
                <Area
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#cafe-rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Two parts of one whole, so one bar — not a two-slice pie, which
            makes a reader estimate angles to learn a percentage that can
            simply be written down. Both segments are labelled, so the colours
            are decoration rather than the key. */}
        <div className="clay-card rep-val flex flex-col p-5">
          <h3 className="font-heading text-base font-bold">التطبيق مقابل الكاونتر</h3>
          <p className="mb-4 text-xs text-muted-foreground">من أين يأتي الإيراد</p>

          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, d.app.share)}%` }}
            />
            <span
              aria-hidden="true"
              className="h-full w-0.5 shrink-0 bg-card"
            />
            <span className="h-full flex-1 bg-[var(--chart-5)]" />
          </div>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-primary" />
                التطبيق
              </dt>
              <dd className="font-heading font-bold tabular-nums">
                {formatMoney(appRevenue)}
                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                  {formatNumber(d.app.share)}٪
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2">
                <i className="size-2.5 rounded-full bg-[var(--chart-5)]" />
                الكاونتر
              </dt>
              <dd className="font-heading font-bold tabular-nums">
                {formatMoney(counterRevenue)}
              </dd>
            </div>
          </dl>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-4 text-center">
            <div className="rounded-2xl bg-muted/50 px-2 py-2">
              <p className="font-heading text-base font-bold">
                {d.app.median_wait_min != null
                  ? `${formatNumber(d.app.median_wait_min)} د`
                  : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">وسيط وقت الانتظار</p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-2 py-2">
              <p className="font-heading text-base font-bold">
                {formatNumber(d.app.cancel_rate)}٪
              </p>
              <p className="text-[10px] text-muted-foreground">
                ملغاة ({formatNumber(d.app.cancelled)} من {formatNumber(d.app.orders)})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── when ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="clay-card rep-chart p-5">
          <h3 className="font-heading text-base font-bold">ساعات الذروة</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            عدد الفواتير حسب ساعة اليوم — متى تحتاج ناس أكثر خلف الماكينة
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={34} />
                <Tooltip
                  formatter={(v) => [formatNumber(Number(v)), "فاتورة"]}
                  labelFormatter={(l) => `الساعة ${l}:٠٠`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byHour.map((r) => (
                    // The busiest hour is the point of the chart, so it is the
                    // one that is not muted.
                    <Cell
                      key={r.hour}
                      fill={
                        r.count === bestHourCount && bestHourCount > 0
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

        <div className="clay-card rep-chart p-5">
          <h3 className="font-heading text-base font-bold">أيام الأسبوع</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            الإيراد حسب اليوم — أي يوم يحمل الأسبوع
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byWeekday}
                layout="vertical"
                margin={{ left: 4, right: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="day"
                  width={58}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v) => [formatMoney(Number(v)), "الإيراد"]} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── the drinks ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Rank
          title="الأكثر مبيعاً"
          hint="بعدد الأكواب"
          icon={<Coffee className="size-4 text-primary" />}
          rows={d.drinks.top_by_cups.map((x) => ({
            name: x.name,
            value: cups(x),
            sub: `${formatNumber(x.sales)} فاتورة`,
          }))}
          metric={(v) => `${formatNumber(Math.round(v))} كوب`}
        />
        <Rank
          title="الأعلى دخلاً"
          hint="بالشيكل — ليست نفس القائمة، وهذا هو المقصود"
          icon={<TrendingUp className="size-4 text-primary" />}
          rows={d.drinks.top_by_revenue.map((x) => ({
            name: x.name,
            value: money(x),
          }))}
          metric={(v) => formatMoney(v)}
        />
        <Rank
          title="الأبطأ حركة"
          hint="بِيعت، لكن بالكاد"
          icon={<TrendingDown className="size-4 text-primary" />}
          rows={d.drinks.slowest.map((x) => ({
            name: x.name,
            value: cups(x),
          }))}
          metric={(v) => `${formatNumber(Math.round(v))} كوب`}
        />

        {/* A list, not a ranking: every row is the same number — zero. */}
        <div className="clay-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Coffee className="size-4 text-destructive" />
            <h3 className="font-heading text-base font-bold">لم يُباع نهائياً</h3>
            <span className="ms-auto rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive">
              {formatNumber(d.drinks.never_sold.length)}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            على المنيو، وما باع ولا كوب خلال الفترة. لا تظهر في «الأقل مبيعاً»
            لأنها لا تظهر على أي فاتورة أصلاً.
          </p>
          {d.drinks.never_sold.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              كل صنف على المنيو باع — ممتاز.
            </p>
          ) : (
            <>
              <ul className="space-y-1">
                {(showAllDead
                  ? d.drinks.never_sold
                  : d.drinks.never_sold.slice(0, 8)
                ).map((x) => (
                  <li
                    key={x.product_id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 odd:bg-muted/40"
                  >
                    <span className="truncate text-sm">{x.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatMoney(x.price)}
                    </span>
                  </li>
                ))}
              </ul>
              {d.drinks.never_sold.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllDead((v) => !v)}
                  className="mt-2 w-full rounded-xl py-1.5 text-xs font-semibold text-primary hover:bg-primary/8"
                >
                  {showAllDead
                    ? "عرض أقل"
                    : `عرض الكل (${formatNumber(d.drinks.never_sold.length)})`}
                </button>
              )}
            </>
          )}
        </div>

        <Rank
          title="الأحجام"
          hint="أي حجم يطلبه الناس فعلاً"
          rows={d.drinks.by_size.map((x) => ({
            name: x.label,
            value: Math.abs(toNumber(x.qty)),
            sub: formatMoney(x.revenue),
          }))}
          metric={(v) => `${formatNumber(Math.round(v))} كوب`}
          empty="لا توجد أحجام على المنيو بعد"
        />
        <Rank
          title="التصنيفات"
          hint="بالإيراد"
          rows={d.drinks.by_category.map((x) => ({
            name: x.name,
            value: Math.abs(toNumber(x.revenue)),
          }))}
          metric={(v) => formatMoney(v)}
        />
      </div>

      {/* ── loyalty ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-heading mb-3 flex items-center gap-2 text-lg font-bold">
          <Gift className="size-4 text-primary" />
          الولاء
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Kpi
            label="نقاط ممنوحة"
            value={formatNumber(d.loyalty.earned)}
            sub={`بقيمة ${formatMoney(d.loyalty.earned_value)}`}
          />
          <Kpi
            label="نقاط مستبدلة"
            value={formatNumber(d.loyalty.spent)}
            sub={`خصمت ${formatMoney(d.loyalty.spent_value)} · ${formatNumber(d.loyalty.redemptions)} مرة`}
          />
          <Kpi
            label="رصيد قائم"
            value={formatMoney(d.loyalty.outstanding)}
            sub="نقاط بيد الزبائن، لم تُستبدل بعد"
          />
          <Kpi
            label="زبائن جدد"
            value={formatNumber(d.loyalty.new_customers)}
            icon={<Users className="size-4" />}
          />
          <Kpi
            label="نسبة التكرار"
            value={`${formatNumber(d.loyalty.repeat_rate)}٪`}
            sub={`${formatNumber(d.loyalty.repeat)} من ${formatNumber(d.loyalty.identified)} زاروا أكثر من مرة`}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Rank
          title="أفضل الزبائن"
          hint="بإجمالي ما صرفوه في الفترة"
          icon={<Users className="size-4 text-primary" />}
          rows={d.loyalty.top_customers.map((c) => ({
            name: c.name,
            value: Math.abs(toNumber(c.total)),
            sub: `${formatNumber(c.visits)} زيارة`,
          }))}
          metric={(v) => formatMoney(v)}
          empty="لا يوجد زبائن مرتبطون بفواتير هذه الفترة"
        />

        <div className="clay-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="size-4 text-primary" />
            <h3 className="font-heading text-base font-bold">طلبات التطبيق</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.app.orders)}
              </p>
              <p className="text-[11px] text-muted-foreground">طلب</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.app.collected)}
              </p>
              <p className="text-[11px] text-muted-foreground">تم استلامه</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.app.open)}
              </p>
              <p className="text-[11px] text-muted-foreground">مفتوح الآن</p>
            </div>
            <div
              className={cn(
                "rounded-2xl p-3",
                d.app.cancel_rate > 15 ? "bg-destructive/10" : "bg-muted/50",
              )}
            >
              <p className="font-heading text-xl font-bold">
                {formatNumber(d.app.cancelled)}
              </p>
              <p className="text-[11px] text-muted-foreground">ملغى</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            نسبة تعرّف الزبون على الفاتورة {formatNumber(h.identified_share)}٪ — كل
            فاتورة بلا زبون هي نقاط لم تُمنح وزيارة لا نعرف صاحبها.
          </p>
        </div>
      </div>
    </div>
  )
}
