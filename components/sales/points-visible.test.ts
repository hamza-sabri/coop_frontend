/* Points have to be SAID, not implied.

   The bug this locks down had no stack trace: a sale part-paid with points
   showed «₪ 15.00» struck through and «₪ 10.70» beside it, and the receipt
   said «الخصم − ₪ 4.30». Every number was right and nothing anywhere said the
   4.30 came out of the customer's points — so neither the owner reading his
   takings nor the customer holding the paper could tell a loyalty redemption
   from a cashier being generous.

   These are source assertions rather than render tests on purpose: the thing
   being protected is that the words appear at all, and a render test that
   mounts the dialog would pass just as well with the points line deleted and
   a `beansSpent > 0` guard that is never true. */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { POINTS_PER_ILS, pointsForBill, pointsValue } from "@/lib/points"

const read = (p: string) => readFileSync(p, "utf8")

describe("the shekel value of points", () => {
  it("matches the server's rate", () => {
    expect(POINTS_PER_ILS).toBe(10)
    expect(pointsValue(43)).toBeCloseTo(4.3, 5)
  })

  it("treats nothing as zero rather than NaN", () => {
    expect(pointsValue(null)).toBe(0)
    expect(pointsValue(undefined)).toBe(0)
  })

  it("never lets points buy more than the bill", () => {
    // 15.00 ₪ is 150 points' worth, so a 400-point balance is capped there.
    expect(pointsForBill(15)).toBe(150)
    // Rounds DOWN: 10.05 ₪ must not authorise 100.5 points.
    expect(pointsForBill(10.05)).toBe(100)
    expect(pointsForBill(-3)).toBe(0)
  })
})

describe("the invoice says what the points paid", () => {
  const src = read("components/sales/sale-detail.tsx")

  it("names the redemption instead of folding it into a discount", () => {
    expect(src).toContain("مدفوع بالنقاط")
    expect(src).toContain("نقطة")
  })

  it("prefers the server's shekel figure over dividing by today's rate", () => {
    // A sale rung up under an older rate keeps the discount it was given.
    expect(src).toContain("sale.beans_value")
  })

  it("separates a points redemption from a cashier's discount", () => {
    expect(src).toContain("خصم إضافي")
    expect(src).toMatch(/otherDiscount/)
  })

  it("shows what was actually handed over as cash", () => {
    expect(src).toContain("المدفوع نقداً")
  })
})

describe("the paper says it too", () => {
  it.each([
    ["lib/print/receipt.ts", "HTML receipt"],
    ["lib/print/receipt-canvas.ts", "thermal raster"],
  ])("%s prints a points line", (path) => {
    const src = read(path)
    expect(src).toContain("نقاط مستخدمة")
    expect(src).toContain("beansSpent")
    // And it must not print a negative «خصم إضافي» if the rate ever moves.
    expect(src).toMatch(/Math\.max\(0, discount - beansOff\)/)
  })
})

describe("every receipt gets the numbers", () => {
  it.each([
    "components/sales/sale-detail.tsx",
    "components/print/print-receipt-dialog.tsx",
    "app/(app)/pos/page.tsx",
    "app/(app)/live/page.tsx",
  ])("%s fills beansSpent on the ReceiptData it builds", (path) => {
    const src = read(path)
    expect(src).toContain("discountedTotal:")
    expect(src).toContain("beansSpent:")
  })
})

describe("the offline till agrees with the server", () => {
  const src = read("app/(app)/pos/page.tsx")

  it("nets the printed total against the points, not just the payload", () => {
    // The payload deliberately sends the PRE-points bill and lets the server
    // subtract; the snapshot is what prints, so it must subtract locally or an
    // offline receipt shows a total the synced sale disagrees with.
    expect(src).toContain("discountedTotal: Math.max(0, billed - beansWorth)")
  })

  it("clamps the same way the server clamps", () => {
    expect(src).toContain("pointsForBill(billed)")
  })
})

describe("the sales list", () => {
  it("flags an invoice that was part-paid in points", () => {
    const src = read("app/(app)/orders/page.tsx")
    expect(src).toContain("s.beans_spent")
    expect(src).toContain("نقطة")
  })
})
