import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * "What did we take between these two dates?"
 *
 * This used to be a panel: period chips over one wide card reading
 * «إجمالي المبيعات», above six period cards that already said اليوم, أمس,
 * آخر ٧ أيام, هذا الشهر, الشهر الماضي and الإجمالي. Three of the chips
 * duplicated three of the cards; the جوال/دخان groups were kiosk categories a
 * café has none of, so the grid rendered one lonely card. Two rows of chrome
 * for a number already on screen.
 *
 * The hand-picked range was the only part not duplicated, so it is the only
 * part left — as one more card in the same row.
 */
const CARD = readFileSync(path.resolve(__dirname, "range-card.tsx"), "utf8")
const PAGE = readFileSync(
  path.resolve(__dirname, "../../app/(app)/orders/page.tsx"),
  "utf8",
)

describe("where the period boundary is decided", () => {
  it("comes from the server, never computed on the till", () => {
    // A till with a wrong clock or timezone would otherwise report a different
    // window than the owner's books, silently. The trading day rolls over on
    // the shop's cutover hour, and only the server knows it.
    expect(CARD).toContain("salesDaySummary({ from, to })")
    expect(CARD).not.toMatch(/new Date\(/)
    expect(CARD).not.toContain("setHours")
  })

  it("asks for nothing until both ends are picked", () => {
    // A half-filled picker would fall back to "today" while the field on
    // screen said otherwise.
    expect(CARD).toContain("const ranged = Boolean(from && to)")
    expect(CARD).toContain("enabled: ranged")
  })

  it("keeps each range's figures under their own cache key", () => {
    expect(CARD).toContain('queryKey: ["sales-day-summary", `${from}:${to}`]')
  })

  it("offers the range as ONE field", () => {
    // Two native date boxes let a cashier set an end before a start, or set
    // one and wonder why nothing changed — and they render in the browser's
    // locale rather than the shop's.
    expect(CARD).toContain("<DateRangePicker")
    expect(CARD).not.toContain('type="date"')
  })
})

describe("it looks like the cards beside it", () => {
  it("wears the same skin", () => {
    expect(CARD).toContain("sale-stat clay-card")
  })

  it("says something before a range is chosen", () => {
    // An empty card in a row of six full ones reads as a loading failure.
    expect(CARD).toContain("اختر تاريخين")
  })
})

describe("the range picker itself", () => {
  const PICKER = readFileSync(
    path.resolve(__dirname, "../ui/date-range-picker.tsx"),
    "utf8",
  )

  it("reports a range only once BOTH ends are chosen", () => {
    // A half-made range must never be mistaken for a filter.
    expect(PICKER).toContain("if (!anchor) {")
    expect(PICKER).toContain("onChange({ from, to })")
  })

  it("reads a backwards pick the way round it was plainly meant", () => {
    expect(PICKER).toContain("anchor <= day ? [anchor, day] : [day, anchor]")
  })

  it("abandons a half-pick when the popover closes", () => {
    // Otherwise a dangling start silently changes what the next click means.
    expect(PICKER).toContain("if (!o) setAnchor(null)")
  })

  it("adds no date library — the RTL calendar is already here", () => {
    // The comment explains the choice; strip comments before judging imports.
    const code = PICKER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(code).not.toContain("react-day-picker")
    expect(code).toContain("AR_MONTHS")
  })
})

describe("the orders page", () => {
  it("keeps the totals to a single row of cards", () => {
    // The regression this guards: a second summary block creeping back above
    // the row, saying the same numbers in a different shape.
    expect(PAGE).not.toContain("<DaySummaryCards")
    expect(PAGE).toContain("<CustomRangeCard />")
    const grids = PAGE.match(/lg:grid-cols-7/g) ?? []
    expect(grids.length).toBe(2) // the skeleton and the real row
  })

  it("puts the totals above everything else", () => {
    const totals = PAGE.indexOf("{/* Period totals")
    const table = PAGE.indexOf("<TableHeader>")
    expect(totals).toBeGreaterThan(-1)
    expect(totals).toBeLessThan(table)
  })

  it("collapses the 30-day analytics the owner does not read", () => {
    // They pushed the numbers he DOES read below the fold.
    expect(PAGE).toContain("تحليلات آخر ٣٠ يوماً")
    expect(PAGE).toContain("<details className=\"group mb-5\">")
  })
})
