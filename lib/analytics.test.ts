import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

import { analyticsEnabled, routeTemplate, track, identify, trackPage } from "@/lib/analytics"

const SRC = readFileSync(path.resolve(__dirname, "analytics.ts"), "utf8")

describe("analytics", () => {
  it("is off without a token, and every call is a harmless no-op", () => {
    expect(analyticsEnabled).toBe(false)
    expect(() => {
      track("Sale Completed", { payment: "cash" })
      identify({ userId: 1, store: "coop", role: "owner" })
      trackPage("/customers/12", "الزبائن")
    }).not.toThrow()
  })

  it("collapses ids so one page is one row in the dashboard", () => {
    expect(routeTemplate("/customers/123")).toBe("/customers/:id")
    expect(routeTemplate("/cash-drawer/7")).toBe("/cash-drawer/:id")
    expect(routeTemplate("/pos")).toBe("/pos")
    expect(routeTemplate("")).toBe("/")
  })

  it("never captures element text, the real URL or the IP", () => {
    // A button can hold a customer's name; a URL can hold ?search=<name>.
    expect(SRC).toContain("capture_text_content: false")
    expect(SRC).toContain('"$current_url"')
    expect(SRC).toContain("ip: false")
    expect(SRC).toContain("input: false")
  })

  it("is wired into the build and the admin", () => {
    const docker = readFileSync(path.resolve(__dirname, "..", "Dockerfile"), "utf8")
    expect(docker).toContain("ARG NEXT_PUBLIC_MIXPANEL_TOKEN=")
    const layout = readFileSync(path.resolve(__dirname, "..", "app", "(app)", "layout.tsx"), "utf8")
    expect(layout).toContain("<AnalyticsTracker />")
  })
})
