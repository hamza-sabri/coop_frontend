import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The "send the app link by SMS" switch must be on BOTH the customers page and
// the till (which opens the form in offline-capable mode).
describe("customer form: app link switch", () => {
  const src = readFileSync("components/forms/customer-form.tsx", "utf8")
  it("is not hidden in offline (till) mode", () => {
    expect(src).not.toMatch(/!customer && !offline \? \(/)
  })
  it("is sent on both the online and the queued path", () => {
    expect(src.match(/send_app_link: sendLink && Boolean\(v\.phone\.trim\(\)\)/g)?.length).toBe(2)
  })
})
