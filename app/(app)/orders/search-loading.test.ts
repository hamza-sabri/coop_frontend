import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

/**
 * Scanning a receipt must LOOK like it did something.
 *
 * React Query keeps the previous page while a refetch is in flight, so a scan
 * left the old sales on screen with no spinner. The cashier could not tell
 * whether the scan had registered, or whether those rows were the answer.
 * The rows have to disappear the moment a term is entered — including during
 * the debounce window, before the request has even been sent.
 */
const PAGES = ["components/print/print-receipt-dialog.tsx"]

describe("the sales search hides stale rows", () => {
  it.each(PAGES)("%s computes a `searching` flag from all three states", (f) => {
    const src = readFileSync(f, "utf8")
    const line = src.match(/const searching =[\s\S]{0,160}/)?.[0] ?? ""
    expect(line).toContain("isLoading")
    expect(line).toContain("isFetching")
    // the debounce window: a term typed but not yet sent
    expect(line).toMatch(/trim\(\) !==/)
  })

  it.each(PAGES)("%s gates the rows on `searching`, not `isLoading`", (f) => {
    const src = readFileSync(f, "utf8")
    // No row-rendering branch may still key off isLoading alone.
    expect(src).not.toMatch(/\{!isLoading && !isError/)
    expect(src).toMatch(/\{searching && \(/)
  })
})

describe("the invoices table hides stale rows without blinking", () => {
  const src = readFileSync("app/(app)/orders/page.tsx", "utf8")
  it("counts a typed-but-unsent term and a still-loading filter as searching", () => {
    const line = src.match(/const searching =[\s\S]{0,160}/)?.[0] ?? ""
    expect(line).toContain("isLoading")
    expect(line).toContain("isPlaceholderData")
    expect(line).toMatch(/trim\(\) !==/)
  })
  it("a background poll does not blank the table", () => {
    // isFetching is true on every 15-second poll; it must not hide the rows.
    const line = src.match(/const searching =[^\n]*/)?.[0] ?? ""
    expect(line).not.toContain("isFetching")
  })
  it("the table gets no rows while searching", () => {
    expect(src).toContain("rows={searching ? [] : results}")
  })
})
