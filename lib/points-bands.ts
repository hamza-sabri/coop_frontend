/* The points ladder, client side — ONLY for previews. The server computes
 * every real award with the same rule (apps/store/points.py rate_for):
 * the band containing the CASH paid sets the rate for the whole receipt,
 * points = floor(amount × rate × 10). */
import { POINTS_PER_ILS } from "@/lib/points"

export type Band = { min_total: string; max_total: string | null; rate_percent: string }

export function rateFor(bands: Band[], amount: number, defaultPercent = 2): number {
  if (!bands.length) return defaultPercent
  const sorted = [...bands].sort((a, b) => Number(a.min_total) - Number(b.min_total))
  for (const b of sorted) {
    const lo = Number(b.min_total)
    const hi = b.max_total == null || b.max_total === "" ? Infinity : Number(b.max_total)
    if (amount >= lo && amount < hi) return Number(b.rate_percent)
  }
  return 0
}

export function pointsFor(bands: Band[], amount: number, defaultPercent = 2): number {
  if (!(amount > 0)) return 0
  const rate = rateFor(bands, amount, defaultPercent)
  // Integer agorot first, so 35 × 2% is exactly 7 and not 6.999….
  const agorot = Math.round(amount * 100)
  return Math.floor((agorot * rate * POINTS_PER_ILS) / 10000 + 1e-9)
}

/** Bands as the editor keeps them: each starts where the previous ended. */
export function chain(bands: Band[]): Band[] {
  const out: Band[] = []
  let lo = "0"
  bands.forEach((b, i) => {
    const last = i === bands.length - 1
    out.push({ min_total: lo, max_total: last ? null : b.max_total, rate_percent: b.rate_percent })
    lo = b.max_total ?? lo
  })
  return out
}

/** A human problem with the ladder, or null. */
export function problem(bands: Band[]): string | null {
  let prev = 0
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]
    const r = Number(b.rate_percent)
    if (!Number.isFinite(r) || r < 0 || r > 100) return `الشريحة ${i + 1}: النسبة بين 0 و 100`
    if (i < bands.length - 1) {
      const hi = Number(b.max_total)
      if (!Number.isFinite(hi) || hi <= prev) return `الشريحة ${i + 1}: الحد الأعلى يجب أن يكون أكبر من ${prev}`
      prev = hi
    }
  }
  return null
}
