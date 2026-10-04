import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The replay ORDER is the contract: a customer made at the counter while
 * offline must reach the server before the sale that names them, and a
 * return after the sale it hands back. Out of order, the server answers
 * "customer not synced yet" — correct, and useless at the counter.
 */

const calls: string[] = []

const store = vi.hoisted(() => ({
  outbox: [] as Array<Record<string, unknown>>,
  sales: [] as Array<Record<string, unknown>>,
}))

vi.mock("@/lib/offline/idb", () => ({
  STORE_OUTBOX: "outbox",
  STORE_PENDING_SALES: "pending_sales",
  idbGetAll: async (name: string) => (name === "outbox" ? [...store.outbox] : [...store.sales]),
  idbPut: async (name: string, v: Record<string, unknown>) => {
    const list = name === "outbox" ? store.outbox : store.sales
    const k = name === "outbox" ? "id" : "clientUuid"
    const i = list.findIndex((x) => x[k] === v[k])
    if (i >= 0) list[i] = v
    else list.push(v)
  },
  idbDelete: async (name: string, key: string) => {
    if (name === "outbox") store.outbox = store.outbox.filter((x) => x.id !== key)
    else store.sales = store.sales.filter((x) => x.clientUuid !== key)
  },
  idbCount: async (name: string) => (name === "outbox" ? store.outbox.length : store.sales.length),
}))

vi.mock("@/api/http", () => ({
  customFetch: vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    calls.push(url.includes("customers") ? `customer:${body.client_uuid}` : `return:${body.client_uuid}`)
    return { data: {} }
  }),
}))

vi.mock("@/api/sales", () => ({
  salesCreate: vi.fn(async (p: Record<string, unknown>) => {
    calls.push(`sale:${p.client_uuid}`)
    return { data: { id: 1 } }
  }),
}))

import { flushPendingSales } from "@/lib/offline/sync"

describe("offline replay order", () => {
  beforeEach(() => {
    calls.length = 0
    const old = Date.now() - 60_000
    // Deliberately stored in the WRONG order.
    store.outbox = [
      { id: "r1", kind: "return", url: "/api/v1/sales/1/returns/", method: "POST", body: { client_uuid: "r1" }, label: "", createdAt: old, attempts: 0 },
      { id: "c1", kind: "customer", url: "/api/v1/customers/", method: "POST", body: { client_uuid: "c1", name: "x" }, label: "", createdAt: old + 1, attempts: 0 },
    ]
    store.sales = [
      { clientUuid: "s1", payload: { client_uuid: "s1", customer_client_uuid: "c1" }, createdAt: old, attempts: 0 },
    ]
  })

  it("customers, then sales, then returns", async () => {
    const res = await flushPendingSales()
    expect(calls).toEqual(["customer:c1", "sale:s1", "return:r1"])
    expect(res.synced).toBe(3)
    expect(res.remaining).toBe(0)
  })

  it("a customer replay asks the server to adopt a known phone", async () => {
    const { customFetch } = await import("@/api/http")
    await flushPendingSales()
    const first = (customFetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find((c) =>
      c[0].includes("customers"),
    )!
    expect(JSON.parse(String(first[1].body)).merge_on_phone).toBe(true)
  })
})
