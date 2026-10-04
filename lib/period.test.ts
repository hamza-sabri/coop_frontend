import { describe, expect, it } from "vitest"

import { businessToday, isCurrent, label, range, shift, weekStart } from "./period"

describe("period windows", () => {
  it("weeks start on Saturday", () => {
    // 2026-10-04 is a Sunday → the week began Saturday 3 October.
    expect(weekStart("2026-10-04")).toBe("2026-10-03")
    expect(weekStart("2026-10-03")).toBe("2026-10-03")
    expect(range("week", "2026-10-09")).toEqual({ start: "2026-10-03", end: "2026-10-09" })
  })

  it("months cover the whole month", () => {
    expect(range("month", "2026-02-14")).toEqual({ start: "2026-02-01", end: "2026-02-28" })
  })

  it("moves by one window", () => {
    expect(shift("month", "2026-03-31", -1)).toBe("2026-02-01")
    expect(shift("week", "2026-10-04", 1)).toBe("2026-10-11")
    expect(shift("day", "2026-01-01", -1)).toBe("2025-12-31")
  })

  it("labels with the app's month names", () => {
    expect(label("month", "2026-09-10")).toBe("سبتمبر 2026")
    expect(label("week", "2026-10-04")).toBe("3–9 أكتوبر")
  })

  it("01:30 still belongs to yesterday", () => {
    expect(businessToday(4, new Date(2026, 9, 5, 1, 30))).toBe("2026-10-04")
    expect(businessToday(4, new Date(2026, 9, 5, 9, 0))).toBe("2026-10-05")
  })

  it("knows when next would be the future", () => {
    expect(isCurrent("month", "2026-10-01", "2026-10-04")).toBe(true)
    expect(isCurrent("month", "2026-09-01", "2026-10-04")).toBe(false)
  })
})
