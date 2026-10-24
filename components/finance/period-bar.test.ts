import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

import { customQuery } from "@/components/finance/period-bar"

// «فترة» on the reports: any start and end, to the minute (owner, 24 Oct).
describe("custom report range", () => {
  it("sends exact moments, the end minute included", () => {
    expect(customQuery({ from: "2026-10-24", to: "2026-10-24", fromTime: "18:00", toTime: "21:30" })).toEqual({
      start: "2026-10-24T18:00",
      end: "2026-10-24T21:31",
    })
  })
  it("until 23:59 runs to midnight, across the month end too", () => {
    expect(customQuery({ from: "2026-10-01", to: "2026-10-31", fromTime: "00:00", toTime: "23:59" }).end).toBe(
      "2026-11-01T00:00",
    )
  })
  it("the reports page offers it, and the payment filter with the apps switched off", () => {
    const src = readFileSync("app/(app)/reports/page.tsx", "utf8")
    expect(src).toContain("allowCustom")
    expect(src).toContain('{ value: "cash", label: "نقدي" }')
    expect(src).toContain('{ value: "card", label: "بطاقة" }')
    expect(src).toContain('const SOON = ["هات", "ويلز"]')
  })
  it("every report query is keyed by the range and the payment filter", () => {
    for (const f of ["overview", "items", "times", "shifts", "customers", "returns", "profit"]) {
      const src = readFileSync(`components/reports/tabs/${f}.tsx`, "utf8")
      expect(src, f).toContain("q.start, q.end, q.pay")
    }
  })
})
