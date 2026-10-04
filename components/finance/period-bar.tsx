"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { SegmentedControl } from "@/components/ui/segmented-control"
import { isCurrent, label, shift, type Period } from "@/lib/period"
import { cn } from "@/lib/utils"

export type PeriodState = { period: Period; anchor: string; shiftId: number | null }

const OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "يوم" },
  { value: "week", label: "أسبوع" },
  { value: "month", label: "شهر" },
]

/**
 * يوم · أسبوع · شهر, with ‹ › to walk back through time and, when the shop
 * has shifts, a chip per shift. One bar for every money screen, so the owner
 * learns it once.
 */
export function PeriodBar({
  value,
  onChange,
  today,
  shifts,
}: {
  value: PeriodState
  onChange: (v: PeriodState) => void
  today: string
  shifts?: { id: number; name: string; start: string; end: string }[]
}) {
  const atNow = isCurrent(value.period, value.anchor, today)
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SegmentedControl
        size="sm"
        options={OPTIONS}
        value={value.period}
        onChange={(p) => onChange({ ...value, period: p, anchor: today })}
      />
      <div className="clay-well inline-flex items-center rounded-full p-1">
        {/* RTL: "back in time" sits on the right. */}
        <button
          type="button"
          aria-label="السابق"
          onClick={() => onChange({ ...value, anchor: shift(value.period, value.anchor, -1) })}
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, anchor: today })}
          className="min-w-32 px-2 text-center text-xs font-semibold"
          title="العودة إلى اليوم"
        >
          {label(value.period, value.anchor)}
        </button>
        <button
          type="button"
          aria-label="التالي"
          disabled={atNow}
          onClick={() => onChange({ ...value, anchor: shift(value.period, value.anchor, 1) })}
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      {shifts && shifts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {[{ id: null as number | null, name: "كل اليوم", start: "", end: "" }, ...shifts].map((s) => (
            <button
              key={s.id ?? "all"}
              type="button"
              onClick={() => onChange({ ...value, shiftId: s.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                value.shiftId === s.id
                  ? "bg-primary text-primary-foreground"
                  : "clay-chip text-muted-foreground hover:text-foreground",
              )}
              title={s.start ? `${s.start}–${s.end}` : undefined}
            >
              {s.name}
              {s.start ? (
                <span className="text-[10px] font-normal opacity-75" dir="ltr">
                  {s.start}–{s.end}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
