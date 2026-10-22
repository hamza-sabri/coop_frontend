import { describe, expect, it } from "vitest"

import { isLiveOrder } from "./koup-orders"

const now = Date.parse("2026-10-22T18:00:00Z")
const at = (h: number) => new Date(now - h * 3600_000).toISOString()

describe("isLiveOrder", () => {
  it("a moving order from today is live", () => {
    expect(isLiveOrder({ status: "accepted", created_at: at(1) }, now)).toBe(true)
  })
  it("an accepted order left days ago is history, not live", () => {
    expect(isLiveOrder({ status: "accepted", created_at: at(30) }, now)).toBe(false)
  })
  it("finished orders are never live", () => {
    expect(isLiveOrder({ status: "collected", created_at: at(0) }, now)).toBe(false)
  })
})
