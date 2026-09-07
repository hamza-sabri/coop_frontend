/* Points, in one place.

   The rate lived inside the POS page, which was fine while the POS was the
   only screen that had to divide by it. It is not any more: the invoice, the
   sales list and both receipt renderers all have to say "43 نقطة" and
   "₪ 4.30" and mean the same thing, and four copies of `/ 10` is three copies
   too many.

   Mirrors POINTS_PER_ILS in apps/store/points.py. If the server's rate ever
   changes, this is the line that changes with it. */
export const POINTS_PER_ILS = 10

/** What a number of points is worth, in shekels. */
export function pointsValue(points: number | null | undefined): number {
  return (Number(points) || 0) / POINTS_PER_ILS
}

/** How many points buy a bill of this size — the ceiling on a redemption. */
export function pointsForBill(total: number): number {
  return Math.max(0, Math.floor(total * POINTS_PER_ILS))
}
