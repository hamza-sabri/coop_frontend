"use client"

/* الأوقات — when the shop is busy, said the way you would say it out loud;
 *
 *   "أزحم وقت: ٥ المساء. أهدأ وقت: ١ بعد منتصف الليل. أفضل يوم: الجمعة."
 *   Then one bar per hour, opening to close — tap an hour to see what sold
 *   in it — and one bar per day of the week.
 *
 * No grid of numbers to decode: the hour × category table was correct and
 * nobody could read it. The detail is still there, one tap away. */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Moon, Sun, Trophy } from "lucide-react"
import { Bars, hourShort, hourSpoken } from "@/components/charts"

import { fetchTimes, type PnlQuery } from "@/api/finance"
import { Empty, Failed, Panel, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export function TimesTab({ q }: { q: PnlQuery }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "times", q.period, q.date],
    queryFn: () => fetchTimes(q).then((r) => r.data),
    placeholderData: (p) => p,
  })

  const hours = useMemo(() => {
    if (!data) return []
    const cut = data.day_start_hour
    const by = new Map<number, { cups: number; money: number; cats: { name: string; cups: number }[] }>()
    for (const c of data.cells) {
      const r = by.get(c.hour) ?? { cups: 0, money: 0, cats: [] }
      r.cups += toNumber(c.qty)
      r.money += toNumber(c.revenue)
      if (toNumber(c.qty) > 0) r.cats.push({ name: c.category, cups: toNumber(c.qty) })
      by.set(c.hour, r)
    }
    return [...by.entries()]
      .sort(([a], [b]) => ((a - cut + 24) % 24) - ((b - cut + 24) % 24))
      .map(([hour, r]) => ({ hour, ...r, cats: r.cats.sort((a, b) => b.cups - a.cups) }))
  }, [data])

  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />
  if (hours.length === 0) return <Empty>لا مبيعات في هذه الفترة</Empty>

  const peak = hours.reduce((a, b) => (b.cups > a.cups ? b : a))
  // The quietest hour the shop is really open — a single sale at 8am on one
  // odd morning is not "the quiet time".
  const open_ = hours.filter((h) => h.cups >= peak.cups * 0.1)
  const quiet = (open_.length ? open_ : hours).reduce((a, b) => (b.cups < a.cups ? b : a))
  const days = data.weekdays.map((w) => ({ day: w.weekday, money: toNumber(w.avg_revenue), tickets: toNumber(w.avg_tickets) }))

  const peakCats = peak.cats.slice(0, 3).map((c) => c.name).join("، ")

  return (
    <div className="space-y-4">
      {/* three sentences, not three numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact icon={<Sun className="size-4" />} tone="amber" label="أزحم وقت" value={hourSpoken(peak.hour)} sub={`${formatNumber(Math.round(peak.cups))} طلب في هذه الساعة`} />
        <Fact icon={<Moon className="size-4" />} tone="sky" label="أهدأ وقت" value={hourSpoken(quiet.hour)} sub={`${formatNumber(Math.round(quiet.cups))} طلب فقط`} />
        <Fact icon={<Trophy className="size-4" />} tone="emerald" label="أفضل يوم" value={data.best_weekday ?? "—"} sub="أعلى مبيعات في اليوم" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="الزحمة خلال اليوم" hint={peakCats ? `في الذروة يُطلب أكثر: ${peakCats}` : "كم طلباً في كل ساعة"}>
          <Bars
            height={260}
            data={hours.map((h) => ({ label: hourShort(h.hour), title: hourSpoken(h.hour), value: Math.round(h.cups) }))}
            format={(v) => `${formatNumber(v)} طلب`}
          />
        </Panel>
        <Panel title="أيام الأسبوع" hint="كم نبيع في اليوم الواحد، في المتوسط">
          <Bars
            height={260}
            showValues
            data={days.map((d) => ({ label: d.day, value: Math.round(d.money) }))}
            format={(v) => formatMoney(v)}
          />
        </Panel>
      </div>
    </div>
  )
}

function Fact({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  tone: "amber" | "sky" | "emerald"
  label: string
  value: string
  sub: string
}) {
  const t = {
    amber: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  }[tone]
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", t)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-heading text-lg font-bold">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}
