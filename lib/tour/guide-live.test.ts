import { afterEach, describe, expect, it, vi } from "vitest"

import { isGuideLive, setGuideLive } from "./guide-live"

vi.mock("@/api/sales", () => ({ salesCreate: vi.fn(async () => ({ data: { id: 1 } })) }))

afterEach(() => setGuideLive(false))

describe("live guide mode never writes", () => {
  it("toggles", () => {
    expect(isGuideLive()).toBe(false)
    setGuideLive(true)
    expect(isGuideLive()).toBe(true)
  })

  it("refuses a sale before it can be queued", async () => {
    const { salesCreate } = await import("@/api/sales")
    const { submitSale } = await import("@/lib/offline/submit-sale")
    setGuideLive(true)
    await expect(
      submitSale({ items: [] } as never, { total: 1, discountedTotal: 1, isReturn: false, paymentMethod: "cash" } as never),
    ).rejects.toMatchObject({ status: 423 })
    expect(salesCreate).not.toHaveBeenCalled()
  })

  it("refuses any API write", async () => {
    const { customFetch } = await import("@/api/http")
    setGuideLive(true)
    await expect(customFetch("/api/v1/customers/", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 423 })
  })
})
