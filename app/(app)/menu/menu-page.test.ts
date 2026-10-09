import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The café menu: a photo, a name, a price — and, for the owner, what a cup
 * earns, said in money. The pharmacy's boxes, barcodes, expiry badges and
 * "delete every product" are gone; sizes and flavours live in the drink drawer.
 */
const PAGE = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")

describe("the menu page", () => {
  it("says what a cup earns, never a margin percentage", () => {
    expect(PAGE).toContain("يربح ${formatMoney(profit)}")
    expect(PAGE).not.toContain("هامش")
  })

  it("shows the profit to the owner only", () => {
    expect(PAGE).toContain("isOwner && cost > 0 && price > 0")
  })

  it("keeps no pharmacy leftovers", () => {
    for (const gone of ["PackagePlus", "PrintLabelDialog", "bulkDeleteMedications", "expiry_status", "VariantsManager"]) {
      expect(PAGE).not.toContain(gone)
    }
  })

  it("opens the drink drawer for adding and editing", () => {
    expect(PAGE).toContain("<DrinkForm\n        open={formOpen}")
  })
})
