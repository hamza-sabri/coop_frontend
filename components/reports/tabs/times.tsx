"use client"

/* الأوقات — when the shop is busy, said the way you would say it out loud.
 *
 *   "أزحم وقت: ٥ المساء. أهدأ وقت: ١ بعد منتصف الليل. أفضل يوم: الجمعة."
 *   Then one bar per hour, opening to close — tap an hour to see what sold
 *   in it — and one bar per day of the week.
 *
 * No grid of numbers to decode: the hour × category table was correct and
 * nobody could read it. The detail is still there, one tap away. */
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Moon, Sun, Trophy } from "lucide-react"

import { fetchTimes, type PnlQuery } from "@/api/finance"
import { Empty, Failed, Panel, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** 17 → "٥ مساءً", 1 → "١ بعد منتصف الليل" — how people say the time. */
function spoken(h: number): string {
  const x = h % 12 === 0 ? 12 : h % 12
  if (h === 0) return "١٢ منتصف الليل"
  if (h < 5) return `${x} بعد منتصف الليل`
  if (h < 12) return `${x} صباحاً`
  if (h === 12) return "١٢ ظهراً"
  if (h < 17) return `${x} بعد الظهر`
  return `${x} مساءً`
}
const short = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "ص" : "م"}`

export function TimesTab({ q }: { q: PnlQuery }) {
  const [open, setOpen] = useState<number | null>(null)
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

  const max = Math.max(1, ...hours.map((h) => h.cups))
  const peak = hours.reduce((a, b) => (b.cups > a.cups ? b : a))
  // The quietest hour the shop is really open — a single sale at 8am on one
  // odd morning is not "the quiet time".
  const open_ = hours.filter((h) => h.cups >= peak.cups * 0.1)
  const quiet = (open_.length ? open_ : hours).reduce((a, b) => (b.cups < a.cups ? b : a))
  const days = data.weekdays.map((w) => ({ day: w.weekday, money: toNumber(w.avg_revenue), tickets: toNumber(w.avg_tickets) }))
  const maxDay = Math.max(1, ...days.map((d) => d.money))

  return (
    <div className="space-y-3">
      {/* three sentences, not three numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact icon={<Sun className="size-4" />} tone="amber" label="أزحم وقت" value={spoken(peak.hour)} sub={`${formatNumber(Math.round(peak.cups))} كوب في هذه الساعة`} />
        <Fact icon={<Moon className="size-4" />} tone="sky" label="أهدأ وقت" value={spoken(quiet.hour)} sub={`${formatNumber(Math.round(quiet.cups))} كوب فقط`} />
        <Fact icon={<Trophy className="size-4" />} tone="emerald" label="أفضل يوم" value={data.best_weekday ?? "—"} sub="أعلى مبيعات في اليوم" />
      </div>

      <Panel title="الزحمة خلال اليوم" hint="كم كوباً بيع في كل ساعة — اضغط على ساعة لترى ماذا بيع فيها">
        <ol className="space-y-1">
          {hours.map((h, i) => {
            const isPeak = h.hour === peak.hour
            const isOpen = open === h.hour
            return (
              <li key={h.hour}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : h.hour)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-start transition hover:bg-muted/50"
                >
                  <span className={cn("w-12 shrink-0 text-xs tabular-nums", isPeak ? "font-bold" : "text-muted-foreground")}>{short(h.hour)}</span>
                  <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted/60">
                    <span
                      className={cn("animate-bar absolute inset-y-0 start-0 rounded-md", isPeak ? "bg-primary" : "bg-primary/45")}
                      style={{ width: `${(h.cups / max) * 100}%`, animationDelay: `${i * 35}ms` }}
                    />
                  </span>
                  <span className={cn("w-20 shrink-0 text-end text-xs tabular-nums", isPeak && "font-bold")}>
                    {formatNumber(Math.round(h.cups))} كوب
                  </span>
                  <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen ? (
                  <div className="mb-1 ms-15 rounded-lg bg-muted/40 px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="mb-1 text-muted-foreground">
                      {spoken(h.hour)} · {formatMoney(h.money)}
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {h.cats.slice(0, 5).map((c) => (
                        <li key={c.name}>
                          {c.name} <b className="tabular-nums">{formatNumber(Math.round(c.cups))}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      </Panel>

      <Panel title="أيام الأسبوع" hint="كم نبيع في اليوم الواحد، في المتوسط">
        <ol className="space-y-1.5">
          {days.map((d, i) => {
            const best = d.day === data.best_weekday
            return (
              <li key={d.day} className="flex items-center gap-3">
                <span className={cn("w-16 shrink-0 text-sm", best ? "font-bold" : "text-muted-foreground")}>{d.day}</span>
                <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted/60">
                  <span
                    className={cn("animate-bar absolute inset-y-0 start-0 rounded-md", best ? "bg-emerald-500" : "bg-primary/45")}
                    style={{ width: `${(d.money / maxDay) * 100}%`, animationDelay: `${i * 50}ms` }}
                  />
                </span>
                <span className={cn("w-24 shrink-0 text-end text-sm tabular-nums", best && "font-bold")}>{formatMoney(Math.round(d.money))}</span>
              </li>
            )
          })}
        </ol>
      </Panel>
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
