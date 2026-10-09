"use client"

import { useEffect } from "react"

import { UPDATING_KEY } from "@/components/offline/update-prompt"

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"

/**
 * Registers the offline app-shell service worker (public/sw.js). Production
 * only — in dev, HMR and a caching worker fight each other.
 *
 * `?v=BUILD_ID` changes on every deploy, so a page loaded from a new build
 * registers a new worker, which versions its caches by that id.
 *
 * The page NEVER reloads itself (a till could blank mid-sale). Two cases:
 *   - This page is ALREADY the new build (the cashier tapped «تحديث», or
 *     reloaded) and a worker for this build is waiting: let it take over
 *     quietly — the screen is already up to date, nothing to reload.
 *   - Otherwise the waiting worker waits for UpdatePrompt's button.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    try {
      sessionStorage.removeItem(UPDATING_KEY)
    } catch {
      /* ignore */
    }

    const mine = (w: ServiceWorker | null | undefined) => {
      try {
        return Boolean(w) && new URL(w!.scriptURL).searchParams.get("v") === BUILD_ID
      } catch {
        return false
      }
    }

    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${BUILD_ID}`, { updateViaCache: "none" })
        .then((reg) => {
          const adopt = () => {
            if (mine(reg.waiting)) reg.waiting!.postMessage({ type: "SKIP_WAITING" })
          }
          adopt()
          reg.addEventListener("updatefound", () => {
            reg.installing?.addEventListener("statechange", adopt)
          })
          void reg.update().catch(() => {})
        })
        .catch(() => {
          /* unsupported / blocked — the app still works online */
        })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])
  return null
}
