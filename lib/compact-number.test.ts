import { describe, expect, it } from "vitest"
import { compact } from "./compact-number"

describe("compact", () => {
  it("shortens thousands the way the app shows them", () => {
    expect(compact(505)).toBe("505")
    expect(compact(999)).toBe("999")
    expect(compact(1000)).toBe("1K")
    expect(compact(1105)).toBe("1.1K")
    expect(compact(1500)).toBe("1.5K")
    expect(compact(1999)).toBe("1.9K")
    expect(compact(2000)).toBe("2K")
    expect(compact(12500)).toBe("12.5K")
    expect(compact(125400)).toBe("125K")
    expect(compact(1250000)).toBe("1.2M")
    expect(compact("1105")).toBe("1.1K")
  })
})
