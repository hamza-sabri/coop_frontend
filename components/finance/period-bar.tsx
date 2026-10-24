"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import { isCurrent, label, shift, type Period } from "@/lib/period"
import { cn } from "@/lib/utils"

/** A range the owner set by hand: dates from the calendar, times typed.
 *  `toTime` is inclusive — "until 23:59" means the whole of that minute. */
export type CustomRange = { from: string; to: string; fromTime: string; toTime: string }

export type PeriodState = {
  period: Period
  anchor: string
  shiftId: number | null
  /** Set → the bar is on «فترة» and this range wins over period/anchor. */
  custom?: CustomRange | null
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** CustomRange → the API's ?start=&end= (exact moments, end exclusive). */
export function customQuery(c: CustomRange): { start: string; end: string } {
  const [y, m, d] = c.to.split("-").map(Number)
  const [hh, mm] = c.toTime.split(":").map(Number)
  const end = new Date(Date.UTC(y, m - 1, d, hh, mm + 1))
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    start: `${c.from}T${c.fromTime}`,
    end: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
  }
}

const OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "يوم" },
  { value: "week", label: "أسبوع" },
  { value: "month", label: "شهر" },
]

/** A flat chip: one look for every toggle on the money screens. */
export function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/**
 * يوم · أسبوع · شهر, with ‹ › to walk back through time and, when asked for,
 * a chip per shift. One bar for every money screen, so the owner learns it once.
 */
export function PeriodBar({
  value,
  onChange,
  today,
  shifts,
  allowCustom = false,
  className,
}: {
  value: PeriodState
  onChange: (v: PeriodState) => void
  today: string
  shifts?: { id: number; name: string; start: string; end: string }[]
  /** Adds «فترة»: any start and end, to the minute. */
  allowCustom?: boolean
  className?: string
}) {
  const atNow = isCurrent(value.period, value.anchor, today)
  const custom = allowCustom ? value.custom ?? null : null
  const tab = (on: boolean) =>
    cn(
      "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
      on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
    )
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex rounded-xl border border-border bg-card p-0.5" role="tablist">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={!custom && value.period === o.value}
            onClick={() => onChange({ ...value, period: o.value, anchor: today, custom: null })}
            className={tab(!custom && value.period === o.value)}
          >
            {o.label}
          </button>
        ))}
        {allowCustom ? (
          <button
            type="button"
            role="tab"
            aria-selected={Boolean(custom)}
            onClick={() =>
              custom ? null : onChange({ ...value, custom: { from: today, to: today, fromTime: "00:00", toTime: "23:59" } })
            }
            className={tab(Boolean(custom))}
          >
            فترة
          </button>
        ) : null}
      </div>
      {custom ? (
        <CustomRangeFields value={custom} onChange={(c) => onChange({ ...value, custom: c })} />
      ) : (
      <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
        {/* RTL: "back in time" sits on the right. */}
        <button
          type="button"
          aria-label="الفترة السابقة"
          onClick={() => onChange({ ...value, anchor: shift(value.period, value.anchor, -1) })}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, anchor: today })}
          className="min-w-32 px-2 text-center text-xs font-semibold"
          title="العودة إلى الفترة الحالية"
        >
          {label(value.period, value.anchor)}
        </button>
        <button
          type="button"
          aria-label="الفترة التالية"
          disabled={atNow}
          onClick={() => onChange({ ...value, anchor: shift(value.period, value.anchor, 1) })}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      )}
      {shifts && shifts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip on={value.shiftId == null} onClick={() => onChange({ ...value, shiftId: null })}>
            كل اليوم
          </Chip>
          {shifts.map((s) => (
            <Chip
              key={s.id}
              on={value.shiftId === s.id}
              onClick={() => onChange({ ...value, shiftId: s.id })}
              title={`${s.start}–${s.end}`}
            >
              {s.name}
              <span className="text-[10px] font-normal opacity-75" dir="ltr">
                {s.start}–{s.end}
              </span>
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** From date + time, to date + time. Each part applies as soon as it is a
 *  whole value, so a half-typed time never sends a broken range. */
function CustomRangeFields({ value, onChange }: { value: CustomRange; onChange: (c: CustomRange) => void }) {
  const time = (k: "fromTime" | "toTime", aria: string) => (
    <input
      type="time"
      dir="ltr"
      aria-label={aria}
      value={value[k]}
      onChange={(e) => {
        if (HHMM.test(e.target.value)) onChange({ ...value, [k]: e.target.value })
      }}
      className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold tabular-nums"
    />
  )
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5" data-testid="custom-range">
      <DateRangePicker
        value={{ from: value.from, to: value.to }}
        onChange={(r) => (r.from && r.to ? onChange({ ...value, from: r.from, to: r.to }) : null)}
        className="h-8 min-w-52 text-xs"
      />
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        من الساعة {time("fromTime", "من الساعة")}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        إلى الساعة {time("toTime", "إلى الساعة")}
      </span>
    </div>
  )
}
