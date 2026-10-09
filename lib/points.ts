/* Points, in one place.

   How many points make one shekel is the SHOP's setting (الإعدادات ← النقاط:
   10, 20, 50 or 100). The server is the truth; the app keeps the current
   value here so every screen — the till, the invoice, both receipt renderers —
   says "43 نقطة" and "₪ 4.30" and means the same thing. usePointsRate()
   (hooks/use-points-rate) loads it and keeps it current.

   Points are SPENT only in whole shekels — steps of the rate (10, 20, 30…
   when 10 = 1 ₪), never 55 points = 5.50 ₪. Earning may be any number. */

let perIls = 10

/** Set by usePointsRate() from the server. Ignores nonsense. */
export function setPointsPerIls(n: number | null | undefined) {
  if (n && Number.isInteger(n) && n > 0) perIls = n
}

/** How many points make one shekel in this shop. */
export function pointsPerIls(): number {
  return perIls
}

/** What a number of points is worth, in shekels. */
export function pointsValue(points: number | null | undefined): number {
  return (Number(points) || 0) / perIls
}

/** Round DOWN to whole shekels' worth of points (55 → 50 at 10 per ₪). */
export function wholePoints(points: number | null | undefined): number {
  return Math.max(0, Math.floor((Number(points) || 0) / perIls) * perIls)
}

/** How many points buy a bill of this size — whole shekels only. */
export function pointsForBill(total: number): number {
  return Math.max(0, Math.floor((Number(total) || 0) + 1e-9) * perIls)
}

/** Most points a customer can put towards this bill. */
export function spendablePoints(balance: number, total: number): number {
  return Math.min(wholePoints(balance), pointsForBill(total))
}
