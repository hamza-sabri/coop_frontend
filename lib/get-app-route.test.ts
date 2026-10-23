import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { GET } from "@/app/get/route"

const cfg = { ios_url: "https://apps.apple.com/app/id123", android_url: "https://play.google.com/store/apps/details?id=x" }
const req = (ua: string) => new NextRequest("https://coop.example.com/get", { headers: { "user-agent": ua } })

afterEach(() => vi.unstubAllGlobals())

describe("/get picks the right store", () => {
  it("iPhone → App Store, Android → Play, desktop → the web app", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(cfg), { status: 200 })))
    expect((await GET(req("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)"))).headers.get("location")).toBe(cfg.ios_url)
    expect((await GET(req("Mozilla/5.0 (Linux; Android 14)"))).headers.get("location")).toBe(cfg.android_url)
    expect((await GET(req("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"))).headers.get("location")).toBe("https://coop.example.com/app")
  })

  it("no store page yet (or API down) → the web app", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down") }))
    expect((await GET(req("Mozilla/5.0 (iPhone)"))).headers.get("location")).toBe("https://coop.example.com/app")
  })
})
