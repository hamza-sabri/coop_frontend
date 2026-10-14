"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"
/** Set just before a reload the cashier asked for (see SwRegister). */
export const UPDATING_KEY = "coop_updating"

/** Reload into the new build: let any waiting worker take over first, then load. */
async function applyUpdate(waiting?: ServiceWorker | null) {
  try {
    sessionStorage.setItem(UPDATING_KEY, "1")
    sessionStorage.setItem(LAST_AUTO_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  if (waiting && "serviceWorker" in navigator) {
    waiting.postMessage({ type: "SKIP_WAITING" })
    await new Promise<void>((done) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => done(), { once: true })
      window.setTimeout(done, 1200)
    })
  }
  window.location.reload()
}

const LAST_AUTO_KEY = "coop_update_auto_at"
/** Never auto-reload twice within this window — a loop guard if a stale copy
 *  were ever served after the reload. */
const AUTO_GAP_MS = 5 * 60_000
const recentlyAuto = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(LAST_AUTO_KEY) || 0) < AUTO_GAP_MS
  } catch {
    return true
  }
}
/** The customers' page: no till, nothing to lose — update it silently. */
const isCustomerPage = () => /^\/(app|privacy)(\/|$)/.test(window.location.pathname)
const typing = () => {
  const el = document.activeElement as HTMLElement | null
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
}

/**
 * «يوجد تحديث جديد — اضغط للتحديث» — now mostly invisible.
 *
 * Only a NEW DEPLOY counts (GET /version answers a different build id). A
 * waiting service worker no longer does: right after reloading into the new
 * build, that build's own worker sits "waiting" for a moment until SwRegister
 * adopts it — which re-showed the banner on a page that was already up to
 * date, so tapping it seemed to do nothing.
 *
 * When there IS a new build:
 *   - the customers' page reloads itself (unless they are typing);
 *   - the staff app reloads itself the moment the tab is hidden or the app is
 *     put in the background (nobody is looking — and carts are saved);
 *   - until then the button stays, and it always works.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false)
  const [reloading, setReloading] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || BUILD_ID === "dev") return
    let cancelled = false
    let isNew = false

    const autoApply = () => {
      if (!isNew || recentlyAuto()) return
      void applyUpdate(waitingRef.current)
    }

    const checkVersion = async () => {
      try {
        const res = await fetch("/version", { cache: "no-store" })
        if (!res.ok) return // deploying, or down: say nothing
        const body = (await res.json()) as { build?: string }
        if (cancelled || !body.build || body.build === BUILD_ID) return
        isNew = true
        setReady(true)
        if (isCustomerPage() && !typing()) autoApply()
        else if (document.visibilityState === "hidden") autoApply()
      } catch {
        /* offline or restarting — not an update */
      }
    }

    let reg: ServiceWorkerRegistration | null = null
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((r) => {
          if (cancelled) return
          reg = r
          // Remembered only so the reload can hand over to it — never a reason
          // on its own to show the banner.
          const note = () => {
            if (r.waiting && !r.waiting.scriptURL.includes(`v=${BUILD_ID}`)) waitingRef.current = r.waiting
          }
          note()
          r.addEventListener("updatefound", () => {
            r.installing?.addEventListener("statechange", note)
          })
        })
        .catch(() => {})
    }

    const check = () => {
      void checkVersion()
      void reg?.update().catch(() => {})
    }
    check()
    const timer = window.setInterval(check, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") check()
      else autoApply() // put away → safe moment to update
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  if (!ready) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed inset-x-0 bottom-4 z-[90] mx-auto w-fit px-4 duration-300">
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true)
          void applyUpdate(waitingRef.current)
        }}
        className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110 active:scale-95 disabled:opacity-70"
      >
        <RefreshCw className={reloading ? "size-4 animate-spin" : "size-4"} />
        {reloading ? "جارٍ التحديث…" : "يوجد تحديث جديد — اضغط للتحديث"}
      </button>
    </div>
  )
}
