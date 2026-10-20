"use client"
/* The customer app's sign-in, by phone (apps/store/app_auth.py on the server).

   The session token lives in localStorage, keyed by store, so a customer is
   asked for an SMS code once per device — every code is a paid SMS. Two cafés
   on two subdomains are two origins and never see each other's session.

   Three ways in, all ending in saveSession():
     - the link staff texted (/app/i/<token>)  → redeemLink
     - a code by SMS                           → requestOtp + verifyOtp
     - iPhone home-screen app: a code shown in Safari (no SMS) → redeemHandoff */
import { getPharmacySlug } from "@/lib/site"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export type CustomerSession = {
  token: string
  store: string
  expires_at: string
  customer: { id: number; name: string; phone: string }
}

export class AuthError extends Error {
  status: number
  code?: string
  retryAfter?: number
  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export function storeSlug(): string {
  return getPharmacySlug() || process.env.NEXT_PUBLIC_PHARMACY_SLUG || ""
}

const key = (store = storeSlug()) => `sijilli.customer.session.${store}`

export function loadSession(store = storeSlug()): CustomerSession | null {
  try {
    const raw = window.localStorage.getItem(key(store))
    if (!raw) return null
    const s = JSON.parse(raw) as CustomerSession
    if (!s?.token || new Date(s.expires_at).getTime() < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function saveSession(s: CustomerSession) {
  try {
    window.localStorage.setItem(key(s.store), JSON.stringify(s))
    window.dispatchEvent(new Event("sijilli:session"))
  } catch {
    /* private mode: signed in for this visit only */
  }
}

export function clearSession(store = storeSlug()) {
  try {
    window.localStorage.removeItem(key(store))
    window.dispatchEvent(new Event("sijilli:session"))
  } catch {
    /* fine */
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/api/v1/shop/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new AuthError("ما في إنترنت — جرّب كمان شوي", 0)
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new AuthError(
      String(data.detail || "صار خطأ، جرّب مرة ثانية"),
      res.status,
      data.code ? String(data.code) : undefined,
      typeof data.retry_after === "number" ? data.retry_after : undefined,
    )
  }
  return data as T
}

/** Local form 05XXXXXXXX, or null. Accepts +970 / +972 / spaces / dashes. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "")
  const local = digits.replace(/^(?:00)?9(?:70|72)0?/, "0").replace(/^(5\d{8})$/, "0$1")
  return /^05\d{8}$/.test(local) ? local : null
}

export const requestOtp = (phone: string) =>
  post<{ sent: boolean; expires_in: number; debug_code?: string }>("otp/request/", {
    store: storeSlug(),
    phone,
  })

export async function verifyOtp(phone: string, code: string, name = "") {
  const s = await post<CustomerSession>("otp/verify/", { store: storeSlug(), phone, code, name })
  saveSession(s)
  return s
}

export async function redeemLink(token: string) {
  const s = await post<CustomerSession>("link/", { store: storeSlug(), token })
  saveSession(s)
  return s
}

export const createHandoff = (token: string) =>
  post<{ code: string; expires_in: number }>("handoff/", {}, token)

export async function redeemHandoff(phone: string, code: string) {
  const s = await post<CustomerSession>("handoff/redeem/", { store: storeSlug(), phone, code })
  saveSession(s)
  return s
}

export async function logoutSession() {
  const s = loadSession()
  if (s) {
    try {
      await post("logout/", {}, s.token)
    } catch {
      /* offline: forget it locally anyway */
    }
  }
  clearSession()
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
