"use client"
/* Product analytics (Mixpanel): which pages, features and reports the staff
   actually use, so we know what to improve and what needs a tutorial.

   What is sent, and what never is:
   - Sent: the page (as a route template, /customers/:id), which button or tab
     (by its aria-label / data-tour / data-track), named feature events, and
     context — store slug, vertical, role, device, installed app or browser.
   - Never: customer names or phones, typed text, amounts, search terms, the
     real URL (it can carry ?search=…), or the IP. Element text is NOT captured
     (`capture_text_content: false`): a button can hold a customer's name.

   Off unless NEXT_PUBLIC_MIXPANEL_TOKEN is baked into the build (Dockerfile
   build arg). Every call is a no-op until init succeeds, and no analytics
   failure may ever reach a sale: everything here swallows its own errors. */
import type { OverridedMixpanel } from "mixpanel-browser"

import { getPharmacySlug } from "@/lib/site"

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? ""

let mp: OverridedMixpanel | null = null
let starting: Promise<OverridedMixpanel | null> | null = null
const queue: Array<(m: OverridedMixpanel) => void> = []

export const analyticsEnabled = Boolean(TOKEN)

/** Load and configure Mixpanel once. Safe to call many times. */
export function initAnalytics(): Promise<OverridedMixpanel | null> {
  if (!TOKEN || typeof window === "undefined") return Promise.resolve(null)
  if (mp) return Promise.resolve(mp)
  if (starting) return starting
  starting = import("mixpanel-browser")
    .then(({ default: mixpanel }) => {
      mixpanel.init(TOKEN, {
        // Our own "Page Viewed" carries a route template instead of a URL.
        track_pageview: false,
        persistence: "localStorage",
        ip: false,
        // The real URL and referrers can carry search terms and names.
        property_blacklist: [
          "$current_url",
          "$referrer",
          "$initial_referrer",
          "$referring_domain",
          "$initial_referring_domain",
          "$search_engine",
        ],
        // Recordings already come from Clarity (masked there); none here.
        record_sessions_percent: 0,
        // Mixpanel's own autocapture did its work INSIDE every tap and was
        // felt on the till (measured ~15–25 ms per tap on a slow phone). Clicks
        // are recorded by our own listener instead (startClickTracking), after
        // the screen has updated.
        autocapture: false,
      })
      // Context known before sign-in finishes, so the first page view of a
      // session is already filed under its store.
      mixpanel.register({
        store: getPharmacySlug() || "central",
        app: "admin",
        vertical: process.env.NEXT_PUBLIC_VERTICAL || "",
        device: deviceKind(),
        display: displayMode(),
      })
      mp = mixpanel
      for (const fn of queue.splice(0)) safe(() => fn(mixpanel))
      return mixpanel
    })
    .catch(() => null)
  return starting
}

function safe(fn: () => void) {
  try {
    fn()
  } catch {
    /* analytics must never break the app */
  }
}

/** Run after the browser has painted and is idle, never inside a tap. */
function later(fn: () => void) {
  if (typeof window === "undefined") return
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (ric) ric(fn, { timeout: 2000 })
  else window.setTimeout(fn, 200)
}

function withMp(fn: (m: OverridedMixpanel) => void) {
  if (!TOKEN) return
  if (mp) later(() => safe(() => fn(mp!)))
  else {
    if (queue.length < 200) queue.push(fn)
    void initAnalytics()
  }
}

export type AnalyticsContext = {
  userId: string | number
  store: string
  role: string
  vertical?: string
}

/** Who and where — attached to every later event. No name, no phone. */
export function identify(ctx: AnalyticsContext) {
  withMp((m) => {
    m.identify(`${ctx.store}:${ctx.userId}`)
    m.register({
      store: ctx.store,
      role: ctx.role,
      vertical: ctx.vertical || process.env.NEXT_PUBLIC_VERTICAL || "",
      app: "admin",
      device: deviceKind(),
      display: displayMode(),
    })
  })
}

/** Forget the user on sign-out, so the next person on this till starts fresh. */
export function resetAnalytics() {
  withMp((m) => m.reset())
}

/** A named feature event. Keep props to choices and counts, never money or names. */
export function track(event: string, props?: Record<string, string | number | boolean | null | undefined>) {
  withMp((m) => {
    m.track(event, {
      ...props,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
    })
  })
}

/** /customers/123/edit → /customers/:id/edit — ids would split one page into thousands. */
export function routeTemplate(pathname: string): string {
  return (
    pathname
      .split("/")
      .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) ? ":id" : seg))
      .join("/") || "/"
  )
}

export function trackPage(pathname: string, pageName: string) {
  const path = routeTemplate(pathname)
  withMp((m) => {
    m.register({ page: pageName, path })
    m.track("Page Viewed", { page: pageName, path })
  })
}

export function deviceKind(): "phone" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop"
  const w = Math.min(window.screen?.width || window.innerWidth, window.innerWidth || 9999)
  const coarse = window.matchMedia?.("(pointer: coarse)").matches
  if (coarse && w < 640) return "phone"
  if (coarse) return "tablet"
  return "desktop"
}

export function displayMode(): "installed" | "browser" {
  if (typeof window === "undefined") return "browser"
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone ? "installed" : "browser"
}

// ---------------------------------------------------------------------------
// Clicks: what staff tap, named by aria-label / data-track / data-tour / title,
// or a link's route. Never the element's text (it can be a customer's name).

const CLICKABLE = 'button,a[href],[role="tab"],[role="menuitem"],[role="option"],[role="switch"],[data-track]'
let clicksOn = false
let lastLabel = ""
let streak: number[] = []

function clickLabel(el: Element): { label: string; kind: string } {
  const attr = (n: string) => (el.getAttribute(n) || "").trim()
  const kind = el.getAttribute("role") || el.tagName.toLowerCase()
  const named = attr("data-track") || attr("aria-label") || attr("data-tour") || attr("title")
  if (named) return { label: named.slice(0, 60), kind }
  if (el instanceof HTMLAnchorElement) {
    try {
      return { label: routeTemplate(new URL(el.href).pathname), kind: "link" }
    } catch {
      /* fall through */
    }
  }
  return { label: "(unlabelled)", kind }
}

/** One passive listener for the whole admin. Does nothing until the browser is idle. */
export function startClickTracking() {
  if (!TOKEN || clicksOn || typeof document === "undefined") return
  clicksOn = true
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target instanceof Element ? e.target.closest(CLICKABLE) : null
      if (!target || target.closest("[data-mp-block]")) return
      const { label, kind } = clickLabel(target)
      // Rage click: the same control 3 times within a second — something
      // did not respond the way the person expected. Worth a tutorial or a fix.
      // Not on the till: tapping "+" three times for three lattes is the job.
      const onTill = window.location.pathname.startsWith("/pos")
      const now = Date.now()
      streak = label === lastLabel ? [...streak.filter((t) => now - t < 1000), now] : [now]
      lastLabel = label
      const rage = !onTill && streak.length === 3
      track("Click", { label, kind })
      if (rage) track("Rage Click", { label, kind })
    },
    { capture: true, passive: true },
  )
}
