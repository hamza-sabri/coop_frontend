"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"
/** Set just before a reload the cashier asked for (see SwRegister). */
export const UPDATING_KEY = "coop_updating"

/**
 * «يوجد تحديث جديد — اضغط للتحديث»
 *
 * The app never reloads itself: on a till that means the screen can blank
 * mid-sale with a customer standing there. Instead it asks, and the cashier
 * taps when they are free.
 *
 * Two ways to learn a new version is out, either is enough:
 *   - GET /version answers with a different build id than the one this page
 *     was loaded from. It only answers once the new deploy is actually up, so
 *     a deploy that is still starting — or failed — is never offered.
 *   - the service worker has a newer version waiting.
 * Checked every minute and whenever the tab is looked at again.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || BUILD_ID === "dev") return
    let cancelled = false

    const checkVersion = async () => {
      try {
        const res = await fetch("/version", { cache: "no-store" })
        if (!res.ok) return // deploying, or down: say nothing
        const body = (await res.json()) as { build?: string }
        if (!cancelled && body.build && body.build !== BUILD_ID) setReady(true)
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
          if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting)
          r.addEventListener("updatefound", () => {
            const fresh = r.installing
            fresh?.addEventListener("statechange", () => {
              if (fresh.state === "installed" && navigator.serviceWorker.controller) setWaiting(fresh)
            })
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
    const onVisible = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  if (!ready && !waiting) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed inset-x-0 bottom-4 z-[90] mx-auto w-fit px-4 duration-300">
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true)
          try {
            sessionStorage.setItem(UPDATING_KEY, "1")
          } catch {
            /* ignore */
          }
          // Let a waiting worker take over; either way, load the new version.
          waiting?.postMessage({ type: "SKIP_WAITING" })
          window.setTimeout(() => window.location.reload(), waiting ? 600 : 50)
        }}
        className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110 active:scale-95 disabled:opacity-70"
      >
        <RefreshCw className={reloading ? "size-4 animate-spin" : "size-4"} />
        {reloading ? "جارٍ التحديث…" : "يوجد تحديث جديد — اضغط للتحديث"}
      </button>
    </div>
  )
}
