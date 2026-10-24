import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Orders are priced on the server by product id. A menu item without its id
// gets every order refused ("الطلب قديم") — this was the bug when ordering was
// first switched on for the phone app.
describe("customer menu", () => {
  it("keeps the product id from the API", () => {
    const src = readFileSync("lib/koup-menu.ts", "utf8")
    expect(src).toMatch(/\n\s*id: r\.id,/)
  })
  it("phone app shows the menu, and the basket only while ordering is open", () => {
    const src = readFileSync("components/koup/KoupAppPhone.tsx", "utf8")
    expect(src).toContain("menu: { canOrder: ordering && Boolean(session) }")
    expect(src).toContain("publicOrdering(")
  })
  // Two drinks can share a name (بطيخ is a smoothie AND a mojito). Keyed by
  // name, React kept the wrong card when a category chip was tapped, so the
  // web menu showed items from the previous category.
  it("menu cards are keyed by product id, not by name", () => {
    const src = readFileSync("components/KoupApp.tsx", "utf8")
    expect(src).not.toMatch(/key=\{m\.en\}/)
  })
})
