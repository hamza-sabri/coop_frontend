"use client"
/* Web Push for the customer app: "your order is ready" on the lock screen.

   The browser's own push (no Firebase): the API hands out the platform's
   public VAPID key, the service worker (public/sw.js) subscribes with it, and
   the API keeps one subscription per shop. On iPhone this works once the app
   is added to the home screen (iOS 16.4+); in a Safari tab it is not offered.

   The SOUND is the shop's (API: /shop/push/ → sound) and is played in the
   app when an order moves; lock-screen notifications use the phone's own
   sound — browsers do not let a website choose it. */
import { useCallback, useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export type PushState = "unsupported" | "denied" | "off" | "on" | "needs-install"

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

function isIos(): boolean {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function standalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    // getRegistration, not .ready: .ready never settles where no worker is
    // registered (development), and a tap must never hang on it.
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

export function useKoupPush(token: string | null | undefined) {
  const [state, setState] = useState<PushState>("unsupported")
  const [key, setKey] = useState("")
  const [sound, setSound] = useState<string>("coop")

  // The shop's key and sound.
  useEffect(() => {
    if (!token) return
    let alive = true
    fetch(`${API}/api/v1/shop/push/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { key?: string; enabled?: boolean; sound?: string } | null) => {
        if (!alive || !j) return
        setKey(j.enabled && j.key ? j.key : "")
        if (j.sound) setSound(j.sound)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [token])

  // Where this browser stands.
  useEffect(() => {
    let alive = true
    void (async () => {
      if (!supported()) {
        if (alive) setState(isIos() && !standalone() ? "needs-install" : "unsupported")
        return
      }
      if (!key) { if (alive) setState("unsupported"); return }
      if (Notification.permission === "denied") { if (alive) setState("denied"); return }
      const reg = await registration()
      const sub = await reg?.pushManager.getSubscription().catch(() => null)
      if (alive) setState(sub && Notification.permission === "granted" ? "on" : "off")
      // Already allowed: make sure the API has this subscription for THIS shop.
      if (sub && token && Notification.permission === "granted") void send(token, sub)
    })()
    return () => { alive = false }
  }, [key, token])

  /** Ask (must be called from a tap). */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported() || !key || !token) return false
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return false }
      const reg = await registration()
      if (!reg) return false
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(key) as unknown as BufferSource,
        })
      }
      const ok = await send(token, sub)
      setState(ok ? "on" : "off")
      return ok
    } catch {
      setState("off")
      return false
    }
  }, [key, token])

  return { state, enable, sound }
}

async function send(token: string, sub: PushSubscription): Promise<boolean> {
  try {
    const r = await fetch(`${API}/api/v1/shop/push/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub.toJSON()),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Messages from the service worker ("an order moved") → a callback. */
export function useSwMessages(onOrder: (orderId: number | null) => void) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    const h = (e: MessageEvent) => {
      const d = e.data as { type?: string; orderId?: number | string | null } | null
      if (d && d.type === "sijilli:push") onOrder(d.orderId != null ? Number(d.orderId) : null)
    }
    navigator.serviceWorker.addEventListener("message", h)
    return () => navigator.serviceWorker.removeEventListener("message", h)
  }, [onOrder])
}
