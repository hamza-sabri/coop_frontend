"use client"

/* The pieces every report tab is built from — flat, bordered, no soft clay
 * shadows. A tab is a few Panels; a Panel answers one question, says which
 * in its title, and says how to read it in one line under the title. */
import { TrendingDown, TrendingUp } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const SURFACE = "rounded-2xl border border-border/80 bg-card"

export function Panel({
  title,
  hint,
  action,
  className,
  children,
  flush,
}: {
  title?: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
  /** No inner padding — for tables that run edge to edge. */
  flush?: boolean
}) {
  return (
    <section className={cn(SURFACE, flush ? "overflow-hidden" : "p-4 sm:p-5", className)}>
      {title || action ? (
        <header className={cn("mb-3 flex items-start justify-between gap-3", flush && "px-4 pt-4 sm:px-5")}>
          <div className="min-w-0">
            {title ? <h3 className="font-heading text-[15px] font-bold leading-tight">{title}</h3> : null}
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function Delta({
  now,
  before,
  invert = false,
}: {
  now: number
  before: number | null | undefined
  /** For costs: going up is bad. */
  invert?: boolean
}) {
  if (before == null || !Number.isFinite(before) || before === 0) return null
  const d = ((now - before) / Math.abs(before)) * 100
  if (!Number.isFinite(d)) return null
  const up = d >= 0
  const good = invert ? !up : up
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        good
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
      )}
      dir="ltr"
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {Math.abs(d) >= 100 ? d.toFixed(0) : d.toFixed(1)}%
    </span>
  )
}

export function Stat({
  label,
  value,
  sub,
  delta,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  delta?: React.ReactNode
  tone?: "good" | "bad" | "warn"
}) {
  return (
    <div className={cn(SURFACE, "p-4")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-bold tracking-tight tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "bad" && "text-rose-700 dark:text-rose-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      {sub || delta ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {delta}
          {sub}
        </div>
      ) : null}
    </div>
  )
}

/** Ranked rows with the magnitude drawn behind the name. */
export function BarList({
  rows,
  format,
  empty = "لا شيء في هذه الفترة",
  onPick,
}: {
  rows: { key: string | number; label: React.ReactNode; value: number; sub?: React.ReactNode }[]
  format: (v: number) => string
  empty?: string
  onPick?: (key: string | number) => void
}) {
  if (!rows.length) return <Empty>{empty}</Empty>
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  return (
    <ol className="space-y-1">
      {rows.map((r) => {
        const Row = onPick ? "button" : "div"
        return (
          <li key={r.key}>
            <Row
              type={onPick ? "button" : undefined}
              onClick={onPick ? () => onPick(r.key) : undefined}
              className={cn(
                "relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg px-2.5 py-2 text-start",
                onPick && "transition hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-1 start-0 rounded-md bg-primary/10"
                style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
              />
              <span className="relative min-w-0 truncate text-sm">
                {r.label}
                {r.sub ? <span className="ms-1.5 text-[11px] text-muted-foreground">{r.sub}</span> : null}
              </span>
              <span className="relative shrink-0 font-semibold tabular-nums text-sm">{format(r.value)}</span>
            </Row>
          </li>
        )
      })}
    </ol>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}

export function TabSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

export function Failed() {
  return (
    <div className={cn(SURFACE, "p-8 text-center text-sm text-muted-foreground")}>
      تعذّر تحميل التقرير. حدّث الصفحة.
    </div>
  )
}

export function MarginPill({ pct }: { pct: string | number | null | undefined }) {
  if (pct == null) return <span className="text-[11px] text-muted-foreground">بلا تكلفة</span>
  const n = toNumber(pct)
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        n >= 60
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : n >= 40
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
      )}
    >
      {formatNumber(Math.round(n))}%
    </span>
  )
}

/** Chart chrome shared by every chart: one axis, recessive grid, ltr. */
export const AXIS = { fontSize: 11, tickLine: false, axisLine: false } as const
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: 12,
    boxShadow: "none",
  },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
}
