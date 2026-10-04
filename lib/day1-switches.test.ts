/* Day-one switches for the كوب handover week.

   Each of these is a thing that is OFF on purpose, and each one fails
   silently if it quietly comes back on: an order nobody is watching for, a
   camera that opens by itself at the till, a password in the address bar.
   Source assertions, because the failure is a line of code changing, and a
   render test would pass with the guard deleted. */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "")

describe("online ordering is switched off end to end", () => {
  it("the board's nav item belongs to the ordering module, not the till", () => {
    const nav = code(read("components/nav-config.ts"))
    const live = nav.slice(nav.indexOf('href: "/live"'), nav.indexOf('href: "/orders"'))
    expect(live).toContain('module: "online_orders"')
  })

  it("is absent from both navs, not shown as a locked upsell", () => {
    // The first version of this switch left الطلبات in the rail and the
    // bottom bar with a padlock — found only by looking at a screenshot.
    expect(code(read("components/nav-config.ts"))).toContain("hideWhenLocked: true")
    expect(code(read("lib/modules.ts"))).toContain("!(locked && item.hideWhenLocked)")
  })

  it("the poller does not run without the module, nor before /auth/me answers", () => {
    const src = code(read("components/orders/orders-live.tsx"))
    expect(src).toContain('!modulesLoading && hasModule(modules, "online_orders")')
    expect(src).toContain("enabled: ordersOn")
  })

  it("the customer shop asks the server before showing a cart", () => {
    const page = code(read("app/(shop)/app/page.tsx"))
    expect(page).toContain("<OrderingGate>")
  })

  it("the gate treats an unreachable server as closed", () => {
    // A page that cannot confirm ordering is open must not let anyone order.
    const gate = code(read("components/koup/ordering-gate.tsx"))
    expect(gate).toContain(".catch(() => alive && setOpen(false))")
  })
})

describe("the camera scanner is off unless a device turns it on", () => {
  it("defaults to off", () => {
    const pref = code(read("lib/scanner-pref.ts"))
    expect(pref).toContain('=== "on"')
    expect(pref).toContain("useState(false)")
  })

  it("the bottom nav shows no scan button by default", () => {
    expect(code(read("components/bottom-nav.tsx"))).toContain("{scannerOn && (")
  })

  it("the mobile cart no longer opens with the camera running", () => {
    const pos = code(read("app/(app)/pos/page.tsx"))
    expect(pos).not.toContain("setSheetScan(true)")
    expect(pos).toContain("setSheetScan(scannerOn)")
    expect(pos).toContain("onScanCode={scannerOn ? handleScan : undefined}")
  })

  it("can be switched back on from settings", () => {
    expect(read("app/(app)/settings/page.tsx")).toContain("<ScannerSection />")
  })
})

describe("the login form never submits a password as a GET", () => {
  it('is method="post", so a pre-hydration submit keeps it out of the URL', () => {
    expect(read("app/login/page.tsx")).toMatch(/<form\s+method="post"/)
  })
})

describe("settings are tabbed, al-rahmah style", () => {
  const src = code(read("app/(app)/settings/page.tsx"))
  it("opens on this device", () => {
    expect(src).toContain('useState("device")')
  })
  it("hides owner tabs from employees and re-checks before rendering", () => {
    expect(src).toContain("!t.ownerOnly || isOwner")
    expect(src).toContain('tab === "brand" && isOwner')
  })
})
