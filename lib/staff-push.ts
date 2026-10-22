"use client"
/* "New order" on an EMPLOYEE's phone even when the admin is closed or the
   phone is locked — Web Push through the browser's own push service.

   Limits worth knowing (they are the platform's, not ours):
   - The lock-screen alert uses the phone's notification sound, once; a web
     page cannot loop a ringtone while it is closed. The loud looping alarm
     still plays whenever the admin is open on screen.
   - iPhone: only after the admin is added to the home screen (iOS 16.4+) and
     opened from there. Android Chrome and desktop browsers: works as is. */
import { useCallback, useEffect, useState } from "react"

import { customFetch } from "@/api/http"

export type StaffPushState = "unsupported" | "needs-install" | "denied" | "off" | "on" | "not-employee"

type Info = { key: string; enabled: boolean; eligible: boolean }

const URL_ = "/api/v1/store/staff-push/"

function bytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
const ios = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
const standalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

async function reg(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

async function save(sub: PushSubscription): Promise<boolean> {
  try {
    await customFetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    })
    return true
  } catch {
    return false
  }
}

export function useStaffPush() {
  const [state, setState] = useState<StaffPushState>("unsupported")
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    let alive = true
    customFetch<{ data: Info }>(URL_)
      .then((r) => { if (alive) setInfo(r.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      if (!info) return
      if (!info.eligible) return alive && setState("not-employee")
      if (!supported()) return alive && setState(ios() && !standalone() ? "needs-install" : "unsupported")
      if (!info.enabled || !info.key) return alive && setState("unsupported")
      if (Notification.permission === "denied") return alive && setState("denied")
      const r = await reg()
      const sub = await r?.pushManager.getSubscription().catch(() => null)
      const on = Boolean(sub) && Notification.permission === "granted"
      if (alive) setState(on ? "on" : "off")
      // Keep the server's copy fresh (and tied to whoever is signed in now).
      if (on && sub) void save(sub)
    })()
    return () => { alive = false }
  }, [info])

  /** From a tap only. */
  const enable = useCallback(async () => {
    if (!info?.key || !supported()) return false
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return false }
      const r = await reg()
      if (!r) return false
      const sub = (await r.pushManager.getSubscription())
        ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(info.key) as unknown as BufferSource }))
      const ok = await save(sub)
      setState(ok ? "on" : "off")
      return ok
    } catch {
      setState("off")
      return false
    }
  }, [info])

  return { state, enable }
}
