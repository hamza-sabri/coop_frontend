"use client"

/* The two charts the app uses (DESIGN.md §4): vertical bars and a filled
 * area. Time runs left → right; the best bar is solid, the rest muted; the
 * tooltip says the value in words. One exception, asked for by the owner: a
 * donut for "share of sales by category", where the parts-of-a-whole IS the
 * question — and every slice opens what is inside it. */
import {
  Area as RArea,
  AreaChart,
  Pie,
  PieChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

export type Point = {
  label: string
  value: number
  /** Tooltip title; defaults to label. */
  title?: string
  /** Extra tooltip lines under the value (e.g. "₪1,240 مبيعات"). */
  lines?: string[]
}

/** The tooltip box itself, for charts whose points carry extra lines. */
function TipBox({ active, payload, format }: { active?: boolean; payload?: { payload?: Point; value?: unknown }[]; format: (v: number) => string }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div style={TIP.contentStyle} className="px-3 py-2">
      <p className="mb-1 font-semibold">{p.title ?? p.label}</p>
      <p className="tabular-nums">{format(Number(p.value))}</p>
      {(p.lines ?? []).map((l) => (
        <p key={l} className="tabular-nums text-muted-foreground">{l}</p>
      ))}
    </div>
  )
}

const AXIS = { fontSize: 11, tickLine: false, axisLine: false, stroke: "var(--muted-foreground)" } as const
const TIP = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: 12,
    boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.25)",
    direction: "rtl" as const,
  },
  cursor: { fill: "var(--muted)", opacity: 0.45 },
}

/** Vertical bars. `highlight` makes the biggest bar solid and the others soft. */
export function Bars({
  data,
  format,
  height = 220,
  highlight = true,
  color = "var(--chart-1)",
  showValues = false,
  className,
}: {
  data: Point[]
  format: (v: number) => string
  height?: number
  highlight?: boolean
  color?: string
  /** Print the value on top of each bar — for short series (≤ 8). */
  showValues?: boolean
  className?: string
}) {
  const max = Math.max(0, ...data.map((d) => d.value))
  // Counts never show "1.5" on the axis.
  const whole = data.every((d) => Number.isInteger(d.value))
  return (
    <div className={cn("w-full", className)} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <BarChart data={data} margin={{ left: 0, right: 4, top: showValues ? 18 : 6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={6} />
          <YAxis {...AXIS} width={40} allowDecimals={!whole} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            {...TIP}
            labelFormatter={(_, p) => (p?.[0]?.payload?.title as string) ?? (p?.[0]?.payload?.label as string) ?? ""}
            formatter={(v) => [format(Number(v)), ""]}
            separator=""
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={i} fill={color} fillOpacity={!highlight || d.value === max ? 1 : 0.42} />
            ))}
            {showValues ? (
              <LabelList dataKey="value" position="top" formatter={(v: unknown) => compact(Number(v))} style={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A line with the space under it filled — for a trend over many points. */
export function AreaTrend({
  data,
  format,
  height = 220,
  color = "var(--chart-1)",
  className,
}: {
  data: Point[]
  format: (v: number) => string
  height?: number
  color?: string
  className?: string
}) {
  const id = `area-${Math.round(Math.random() * 1e9)}`
  return (
    <div className={cn("w-full", className)} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <AreaChart data={data} margin={{ left: 0, right: 6, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...AXIS} width={40} tickFormatter={(v) => compact(Number(v))} />
          {data.some((d) => d.lines?.length) ? (
            <Tooltip cursor={{ stroke: "var(--border)" }} content={<TipBox format={format} />} />
          ) : (
            <Tooltip
              {...TIP}
              cursor={{ stroke: "var(--border)" }}
              labelFormatter={(_, p) => (p?.[0]?.payload?.title as string) ?? (p?.[0]?.payload?.label as string) ?? ""}
              formatter={(v) => [format(Number(v)), ""]}
              separator=""
            />
          )}
          <RArea
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${id})`}
            animationDuration={900}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 12,345 → "12.3k" on an axis — the tooltip has the exact figure. */
function compact(v: number): string {
  if (!Number.isFinite(v)) return ""
  const a = Math.abs(v)
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10000 ? 0 : 1)}k`
  return String(Math.round(v * 100) / 100)
}

/** 17 → "٥ م" — how an hour is written under a chart. */
export function hourShort(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "ص" : "م"}`
}
/** 17 → "٥ مساءً" — how people say the time. */
export function hourSpoken(h: number): string {
  const x = h % 12 === 0 ? 12 : h % 12
  if (h === 0) return "١٢ منتصف الليل"
  if (h < 5) return `${x} بعد منتصف الليل`
  if (h < 12) return `${x} صباحاً`
  if (h === 12) return "١٢ ظهراً"
  if (h < 17) return `${x} بعد الظهر`
  return `${x} مساءً`
}

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

/** "2026-10-01" → its weekday, as people say it ("الخميس"). Read at noon so
 *  no timezone can push it to the day before. */
export function weekdayOf(iso: string): string {
  return WEEKDAYS[new Date(`${iso.slice(0, 10)}T12:00:00`).getDay()]
}

/** Under a daily chart: the day's name; with more than a week of bars the
 *  date too, so two Thursdays are never the same label ("الخميس 1"). */
export function dayAxis(iso: string, many: boolean): string {
  return many ? `${weekdayOf(iso)} ${Number(iso.slice(8, 10))}` : weekdayOf(iso)
}

/** The tooltip title: "الخميس 1 أكتوبر". */
export function daySpoken(iso: string): string {
  return `${weekdayOf(iso)} ${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
}

/** Slices that tell apart next to each other, in the app's palette first. */
export const SLICE_COLORS = [
  "var(--chart-1)", "var(--chart-4)", "var(--chart-5)", "var(--chart-3)",
  "oklch(0.65 0.17 25)", "oklch(0.6 0.15 300)", "oklch(0.7 0.12 195)", "oklch(0.68 0.06 260)",
]

/** A donut: parts of a whole. `onSelect` gets the clicked slice's index. */
export function Donut({
  data,
  format,
  height = 240,
  center,
  onSelect,
}: {
  data: Point[]
  format: (v: number) => string
  height?: number
  /** Big text in the hole (the total). */
  center?: { value: string; label: string }
  onSelect?: (index: number) => void
}) {
  return (
    <div className="relative w-full" style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height }}>
        <PieChart>
          <Tooltip
            {...TIP}
            formatter={(v, _n, p) => [format(Number(v)), (p?.payload as Point | undefined)?.title ?? (p?.payload as Point | undefined)?.label ?? ""]}
            separator=" · "
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="92%"
            paddingAngle={data.length > 1 ? 1.5 : 0}
            stroke="var(--card)"
            strokeWidth={2}
            animationDuration={700}
            onClick={(_d, i) => onSelect?.(i)}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" dir="rtl">
          <div>
            <p className="font-heading text-lg font-bold tabular-nums leading-tight">{center.value}</p>
            <p className="text-[11px] text-muted-foreground">{center.label}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
