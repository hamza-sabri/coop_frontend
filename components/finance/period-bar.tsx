"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { isCurrent, label, shift, type Period } from "@/lib/period"
import { cn } from "@/lib/utils"

export type PeriodState = { period: Period; anchor: string; shiftId: number | null }

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
  className,
}: {
  value: PeriodState
  onChange: (v: PeriodState) => void
  today: string
  shifts?: { id: number; name: string; start: string; end: string }[]
  className?: string
}) {
  const atNow = isCurrent(value.period, value.anchor, today)
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex rounded-xl border border-border bg-card p-0.5" role="tablist">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value.period === o.value}
            onClick={() => onChange({ ...value, period: o.value, anchor: today })}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              value.period === o.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
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
