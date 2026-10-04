"use client"

/* ‹ أكتوبر ٢٠٢٦ › — picking a month the way people think of one, instead of
 * the browser's English month box. `value` is "YYYY-MM". */
import { ChevronLeft, ChevronRight } from "lucide-react"

import { label } from "@/lib/period"
import { cn } from "@/lib/utils"

function step(v: string, dir: -1 | 1): string {
  const [y, m] = v.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + dir, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export function MonthStepper({
  value,
  onChange,
  max,
  className,
  size = "md",
}: {
  value: string
  onChange: (v: string) => void
  /** Last month allowed, "YYYY-MM". */
  max?: string
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const atMax = max != null && value >= max
  const btn = cn("grid place-items-center rounded-lg transition hover:bg-muted disabled:opacity-30", size === "sm" ? "size-7" : "size-8")
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border/80 bg-card p-0.5",
        size !== "sm" && "p-1",
        size === "lg" && "h-11 w-full justify-between",
        className,
      )}
    >
      <button type="button" onClick={() => onChange(step(value, -1))} aria-label="الشهر السابق" className={btn}>
        <ChevronRight className="size-4" />
      </button>
      {/* Tapping the month, when it is not the current one, comes back to it. */}
      <button
        type="button"
        disabled={max == null || atMax}
        onClick={() => max && onChange(max)}
        title={max && !atMax ? "العودة إلى هذا الشهر" : undefined}
        className={cn(
          "px-2 text-center font-semibold tabular-nums disabled:cursor-default",
          size === "sm" ? "min-w-24 text-xs" : "min-w-28 text-sm",
          max && !atMax && "text-primary hover:underline",
        )}
      >
        {label("month", `${value}-01`)}
      </button>
      <button type="button" onClick={() => onChange(step(value, 1))} disabled={atMax} aria-label="الشهر التالي" className={btn}>
        <ChevronLeft className="size-4" />
      </button>
    </div>
  )
}
