import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/* The reports page is one question per tab, and the money screens are flat:
   no clay surfaces. These pin both so a later edit cannot quietly pile the
   tabs back into one long page or bring the soft shadows back. */
const ROOT = path.resolve(__dirname, "..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

describe("reports page", () => {
  it("has a tab per question", () => {
    const src = read("app/(app)/reports/page.tsx")
    for (const label of ["نظرة عامة", "الأرباح", "الأصناف", "الأوقات", "الورديات", "الزبائن", "المرتجعات"]) {
      expect(src).toContain(`"${label}"`)
    }
  })

  it("every drink has its own report, in the menu and in the reports", () => {
    expect(read("components/forms/drink-form.tsx")).toContain("<ItemReport")
    expect(read("app/(app)/reports/page.tsx")).toContain("<ItemReportSheet")
  })
})

describe("money screens are flat", () => {
  const files = [
    "app/(app)/reports/page.tsx",
    "app/(app)/stock/page.tsx",
    "app/(app)/expenses/page.tsx",
    "components/stock/forms.tsx",
    "components/stock/item-drawer.tsx",
    "components/finance/period-bar.tsx",
    "components/reports/kit.tsx",
    "components/reports/item-report.tsx",
    ...readdirSync(path.join(ROOT, "components/reports/tabs")).map((f) => `components/reports/tabs/${f}`),
  ]
  it.each(files)("%s uses no clay surface", (f) => {
    expect(read(f)).not.toMatch(/clay-(card|chip|well|btn)|SegmentedControl/)
  })
})

describe("recipes", () => {
  it("ingredients live in the drink form — the drink's and each option's — and the stock drawer has a statement", () => {
    const form = read("components/forms/drink-form.tsx")
    expect(form).toContain("<Ingredients")
    // one save for the drink, its options and every version's ingredients
    expect(form).toContain("saveRecipes(productId")
    // validated before anything is written
    expect(form.indexOf("draftProblem(baseLines")).toBeLessThan(form.indexOf("await upsert("))
    expect(read("components/stock/item-drawer.tsx")).toContain("<ItemLedger")
  })
  it("the statement shows quantities exactly, not rounded", () => {
    expect(read("components/stock/item-ledger.tsx")).toContain("formatQty(data.closing, unit, true)")
  })
  it("the inventory category is a dropdown, not free text", () => {
    expect(read("components/stock/item-drawer.tsx")).toContain("<PickOrCreate")
  })
})
