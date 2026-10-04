import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { NAV_ITEMS } from "@/components/nav-config"

/* Money is the owner's. The server refuses it to employees; these pin the UI
   side so an employee is never shown a door that only says "forbidden". */
const ROOT = path.resolve(__dirname, "..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

describe("owner-only money", () => {
  it("reports and expenses are owner-only nav items", () => {
    for (const href of ["/reports", "/expenses"]) {
      expect(NAV_ITEMS.find((i) => i.href === href)?.ownerOnly).toBe(true)
    }
  })

  it("owner-only items are hidden, not locked, for employees", () => {
    expect(read("lib/modules.ts")).toContain("!(item.ownerOnly && !isOwner)")
  })

  it("the invoices page does not fetch period totals for employees", () => {
    const src = read("app/(app)/orders/page.tsx")
    expect(src).toContain("enabled: isOwner")
    // The filtered total is drawn only for the owner (the server omits it too).
    expect(src).toContain("isOwner && summary.data?.total != null")
  })

  it("the stock badge is gone from the till and the menu", () => {
    expect(read("app/(app)/pos/page.tsx")).not.toMatch(/pill-danger" : stock <= 5/)
    expect(read("app/(app)/menu/page.tsx")).not.toContain("مخزون {formatNumber(stock)}")
  })

  it("cost is only sent by the owner from the drink editor", () => {
    const src = read("components/forms/drink-form.tsx")
    expect(src).toContain("...(isOwner ? { cost:")
  })
})
