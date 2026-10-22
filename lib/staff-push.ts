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

function bytes(raw: string): Uint8Array {
  const b64 = raw.trim().replace(/^["']|["']$/g, "")
  const pad = "=".repeat((4 - (b64.length % 4)) % 4)
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
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

/** The app's service worker, ACTIVE (subscribing needs an active one). Just
 *  after a deploy or on a first visit it may still be installing: wait for it
 *  a little, never forever (.ready alone hangs where nothing registers). */
async function reg(wait = 0): Promise<ServiceWorkerRegistration | null> {
  try {
    const r = await navigator.serviceWorker.getRegistration()
    if (r?.active || !wait) return r ?? null
    const timeout = new Promise<null>((ok) => setTimeout(() => ok(null), wait))
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } catch {
    return null
  }
}

async function save(sub: PushSubscription): Promise<{ ok: boolean; error?: string }> {
  try {
    await customFetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || "خطأ غير معروف" }
  }
}

/** The browser's subscription for this site, made with THIS server key. A
 *  subscription left over from an older key (keys regenerated) cannot be
 *  reused — the push service would reject every message — so it is replaced. */
async function subscribeWith(r: ServiceWorkerRegistration, key: string): Promise<PushSubscription> {
  const want = bytes(key)
  const existing = await r.pushManager.getSubscription()
  if (existing) {
    const have = existing.options?.applicationServerKey
    const same = have ? sameBytes(new Uint8Array(have), want) : true
    if (same) return existing
    await existing.unsubscribe().catch(() => {})
  }
  return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want as unknown as BufferSource })
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
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

  /** From a tap only. Resolves { ok, error } — the error says WHICH step
   *  failed, so "it won't turn on" can be diagnosed from the phone itself. */
  const enable = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!info?.key) return { ok: false, error: "مفتاح الإشعارات غير مضبوط على السيرفر" }
    if (!supported()) return { ok: false, error: "هذا المتصفح لا يدعم الإشعارات" }
    const perm = await Notification.requestPermission().catch(() => "default" as NotificationPermission)
    if (perm !== "granted") {
      setState(perm === "denied" ? "denied" : "off")
      return { ok: false, error: "الإشعارات غير مسموحة لهذا الموقع في المتصفح" }
    }
    const r = await reg(8000)
    if (!r) return { ok: false, error: "التطبيق لم يجهز بعد — حدّث الصفحة وجرّب مرة ثانية" }
    let sub: PushSubscription | null
    try {
      sub = await subscribeWith(r, info.key)
    } catch (e) {
      setState("off")
      const name = (e as Error)?.name || ""
      const msg = (e as Error)?.message || String(e)
      return {
        ok: false,
        error: name === "AbortError" || /push service/i.test(msg)
          ? "خدمة الإشعارات في المتصفح مطفأة (في Brave: الإعدادات ← الخصوصية ← تفعيل خدمات Google للإشعارات)"
          : `تعذّر الاشتراك: ${name} ${msg}`.trim(),
      }
    }
    if (!sub) return { ok: false, error: "تعذّر الاشتراك" }
    const saved = await save(sub)
    setState(saved.ok ? "on" : "off")
    return saved.ok ? { ok: true } : { ok: false, error: `السيرفر رفض الاشتراك: ${saved.error}` }
  }, [info])

  return { state, enable }
}
