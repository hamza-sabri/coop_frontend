import { beforeEach, describe, expect, it } from "vitest"

import { clearSession, loadSession, normalisePhone, saveSession } from "@/lib/customer-session"

describe("customer phone sign-in", () => {
  beforeEach(() => window.localStorage.clear())

  it("accepts the ways people type a mobile number", () => {
    expect(normalisePhone("0599123456")).toBe("0599123456")
    expect(normalisePhone("+970 599 123 456")).toBe("0599123456")
    expect(normalisePhone("00972-52-123-4567")).toBe("0521234567")
    expect(normalisePhone("599123456")).toBe("0599123456")
    expect(normalisePhone("12345")).toBeNull()
  })

  it("keeps one session per store, and drops an expired one", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    saveSession({ token: "cs_a", store: "coop", expires_at: future, customer: { id: 1, name: "a", phone: "0599" } })
    saveSession({ token: "cs_b", store: "burger", expires_at: future, customer: { id: 2, name: "b", phone: "0599" } })
    expect(loadSession("coop")?.token).toBe("cs_a")
    expect(loadSession("burger")?.token).toBe("cs_b")
    clearSession("coop")
    expect(loadSession("coop")).toBeNull()
    expect(loadSession("burger")?.token).toBe("cs_b")
    saveSession({ token: "cs_old", store: "coop", expires_at: new Date(Date.now() - 1000).toISOString(), customer: { id: 1, name: "a", phone: "0" } })
    expect(loadSession("coop")).toBeNull()
  })
})
