"use client"

/* The two charts the app uses (DESIGN.md §4): vertical bars and a filled
 * area. Time runs left → right; the best bar is solid, the rest muted; the
 * tooltip says the value in words. Nothing else — no pies, no grids. */
import {
  Area as RArea,
  AreaChart,
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

export type Point = { label: string; value: number; /** Tooltip title; defaults to label. */ title?: string }

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
          <Tooltip
            {...TIP}
            cursor={{ stroke: "var(--border)" }}
            labelFormatter={(_, p) => (p?.[0]?.payload?.title as string) ?? (p?.[0]?.payload?.label as string) ?? ""}
            formatter={(v) => [format(Number(v)), ""]}
            separator=""
          />
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
