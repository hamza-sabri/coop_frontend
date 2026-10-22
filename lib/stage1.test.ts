import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"


const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8")

describe("stage 1 wiring", () => {
  it("the alarm rings until seen, has its own mute, and only for employees", () => {
    const live = read("components/orders/orders-live.tsx")
    expect(live).toContain("startAlarm()")
    expect(live).toContain('const alertMe = useOwnerState() === "employee"')
    expect(live).toContain("const unseen = alertMe ?")
    expect(live).toContain("OrderAlarmBanner")
    expect(read("lib/order-alarm.ts")).toContain('const MUTE_KEY = "sijilli.alarm.muted"')
  })
  it("employees are never sent the invoice count", () => {
    expect(read("app/(app)/orders/page.tsx")).toContain('!isOwner ? "الفواتير"')
  })
  it("the service worker shows pushes and tells open windows", () => {
    const sw = read("public/sw.js")
    expect(sw).toContain('self.addEventListener("push"')
    expect(sw).toContain('self.addEventListener("notificationclick"')
    expect(sw).toContain('type: "sijilli:push"')
  })
  it("the customer bar is home · new order · profile, fixed right-to-left", () => {
    const app = read("components/KoupApp.tsx")
    const nav = app.slice(app.indexOf('<nav className="tabs tabs-3" dir="rtl">'))
    const home = nav.indexOf("go('home')"), menu = nav.indexOf("newOrder()"), me = nav.indexOf("go('profile')")
    expect(home).toBeGreaterThan(0)
    expect(home).toBeLessThan(menu)
    expect(menu).toBeLessThan(me)
  })
  it("the basket never shows a bin icon — minus removes at one", () => {
    expect(read("components/KoupApp.tsx")).not.toContain("🗑")
  })
  it("employees can get new orders on a locked phone", () => {
    expect(read("lib/staff-push.ts")).toContain("/api/v1/store/staff-push/")
    expect(read("app/(app)/live/page.tsx")).toContain("<StaffPushCard />")
    expect(read("public/sw.js")).toContain("requireInteraction: Boolean(msg.requireInteraction)")
  })
})
