import { afterEach, describe, expect, it } from "vitest"

import { pointsForBill, pointsValue, setPointsPerIls, spendablePoints, wholePoints } from "./points"

afterEach(() => setPointsPerIls(10))

describe("points rate", () => {
  it("spends whole shekels only", () => {
    expect(wholePoints(55)).toBe(50)
    expect(spendablePoints(175, 12)).toBe(120)
    expect(spendablePoints(175, 7.5)).toBe(70)
    expect(pointsForBill(12.99)).toBe(120)
  })
  it("follows the shop's rate", () => {
    setPointsPerIls(50)
    expect(pointsValue(150)).toBe(3)
    expect(wholePoints(149)).toBe(100)
    expect(spendablePoints(1000, 4.2)).toBe(200)
  })
  it("ignores nonsense rates", () => {
    setPointsPerIls(0)
    setPointsPerIls(3.5)
    expect(pointsValue(10)).toBe(1)
  })
})
