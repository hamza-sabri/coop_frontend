import { describe, expect, it } from "vitest"

import { chain, pointsFor, problem, rateFor } from "./points-bands"

const LADDER = [
  { min_total: "0", max_total: "20", rate_percent: "1" },
  { min_total: "20", max_total: "50", rate_percent: "2" },
  { min_total: "50", max_total: "100", rate_percent: "5" },
  { min_total: "100", max_total: null, rate_percent: "5" },
]

describe("points ladder (preview must match the server)", () => {
  it("picks the band for the whole receipt", () => {
    expect(rateFor(LADDER, 19.99)).toBe(1)
    expect(rateFor(LADDER, 20)).toBe(2)
    expect(rateFor(LADDER, 250)).toBe(5)
  })
  it("floors once", () => {
    expect(pointsFor(LADDER, 55)).toBe(27) // 27.5
    expect(pointsFor(LADDER, 35)).toBe(7)
    expect(pointsFor([], 17.5)).toBe(3) // flat 2%
  })
  it("chains bands end to start", () => {
    const c = chain([
      { min_total: "x", max_total: "30", rate_percent: "1" },
      { min_total: "y", max_total: "80", rate_percent: "3" },
    ])
    expect(c).toEqual([
      { min_total: "0", max_total: "30", rate_percent: "1" },
      { min_total: "30", max_total: null, rate_percent: "3" },
    ])
  })
  it("explains a broken ladder", () => {
    expect(problem([{ min_total: "0", max_total: "0", rate_percent: "1" }, { min_total: "0", max_total: null, rate_percent: "2" }])).toMatch(/الشريحة 1/)
    expect(problem(LADDER)).toBeNull()
  })
})
