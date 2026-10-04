"use client"

/* «آخر ٧ أيام · آخر ٣٠ يوماً · آخر ٩٠ يوماً» — a rolling window, for pages
 * that answer "how are things going lately" rather than "what was the
 * September statement". Ends yesterday-or-today the way a person means it:
 * it includes today. */
import { cn } from "@/lib/utils"

export type RollingDays = 7 | 30 | 90

export const ROLLING: { days: RollingDays; label: string }[] = [
  { days: 7, label: "آخر ٧ أيام" },
  { days: 30, label: "آخر ٣٠ يوماً" },
  { days: 90, label: "آخر ٣ أشهر" },
]

/** [start, end] ISO dates for the last `days` business days ending `today`. */
export function rollingRange(days: number, today: string): { start: string; end: string } {
  const d = new Date(`${today}T00:00:00`)
  d.setDate(d.getDate() - (days - 1))
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return { start, end: today }
}

export function RangeChips({ value, onChange, className }: { value: RollingDays; onChange: (d: RollingDays) => void; className?: string }) {
  return (
    <div className={cn("inline-flex gap-1 rounded-xl border border-border/80 bg-card p-1", className)} role="tablist">
      {ROLLING.map((r) => (
        <button
          key={r.days}
          type="button"
          role="tab"
          aria-selected={value === r.days}
          onClick={() => onChange(r.days)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === r.days ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
