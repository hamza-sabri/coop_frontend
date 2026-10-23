/* /get — the one link for "download the app" (SMS, QR codes, the web app's
   banner). iPhones go to the App Store, Android phones to Google Play, and
   anything else — or a store page not set yet — to the web app.

   The store addresses come from the API (/public/app-config/, set in Dokploy
   as APP_IOS_URL / APP_ANDROID_URL), so nothing here changes when the iPhone
   app's page goes live: set the env var and every printed QR follows. */
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

type Cfg = { ios_url?: string; android_url?: string }

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") || ""
  let cfg: Cfg = {}
  try {
    const r = await fetch(`${API}/api/v1/public/app-config/`, { next: { revalidate: 300 } })
    if (r.ok) cfg = (await r.json()) as Cfg
  } catch {
    /* the web app is still a fine answer */
  }
  const ios = /iPhone|iPad|iPod/i.test(ua)
  const android = /Android/i.test(ua)
  const target =
    ios && cfg.ios_url ? cfg.ios_url
    : android && cfg.android_url ? cfg.android_url
    : new URL("/app", req.url).toString()
  return NextResponse.redirect(target, 302)
}
