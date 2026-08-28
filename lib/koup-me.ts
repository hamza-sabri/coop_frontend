"use client"
/* The signed-in customer's own standing — points, tier, streak, history.
 *
 * This replaces four literals that used to sit in KoupApp: START_BEANS = 248
 * and the three numbers in the stats strip. They rendered identically for
 * every customer, which is worse than showing nothing: a loyalty app whose
 * headline number is fiction is not a loyalty app.
 *
 * Cached in localStorage, deliberately. The home screen's whole job is to
 * show a number, and a café has patchy signal; a slightly stale balance is
 * useful, a spinner is not. The cache is per Clerk user id so that signing
 * out and back in as someone else can never show the previous person's
 * points for even one frame.
 */
import { useCallback, useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const KEY = "koup.me.v1"

export type ShopActivity = {
  delta: number
  reason: string
  note: string
  balance_after: number
  at: string
}

export type ShopMe = {
  synced: boolean
  name?: string
  beans: number
  tier?: "single" | "double" | "triple"
  multiplier?: string
  streak_weeks?: number
  visits_this_month?: number
  cups_this_year?: number
  free_cups?: number
  reward_cost?: number
  to_next_reward?: number
  activity?: ShopActivity[]
}

type Cached = { uid: string; at: number; me: ShopMe }

function readCache(uid: string): ShopMe | null {
  if (typeof window === "undefined" || !uid) return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cached
    // Another account's cache is not a cache, it is a leak.
    return c && c.uid === uid && c.me ? c.me : null
  } catch {
    return null
  }
}

function writeCache(uid: string, me: ShopMe) {
  if (typeof window === "undefined" || !uid) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ uid, at: Date.now(), me }))
  } catch {
    /* private mode, quota — the app still works, it just re-fetches */
  }
}

/** Wipe the cached balance. Call on sign-out. */
export function clearShopMeCache() {
  try { window.localStorage.removeItem(KEY) } catch { /* fine */ }
}

/**
 * @param uid      Clerk user id — the cache key, and the "is anyone here" flag.
 * @param getToken Clerk's token getter. Returns null when signed out.
 */
export function useShopMe(
  uid: string | null | undefined,
  getToken: (() => Promise<string | null>) | undefined,
) {
  const [me, setMe] = useState<ShopMe | null>(null)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)

  // Paint the cached number before the network is even asked.
  useEffect(() => {
    if (!uid) { setMe(null); return }
    const cached = readCache(uid)
    if (cached) setMe(cached)
  }, [uid])

  const refresh = useCallback(async () => {
    if (!uid || !getToken) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${API}/api/v1/shop/me/`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (!res.ok) { setOffline(true); return }
      const data = (await res.json()) as ShopMe
      setMe(data)
      setOffline(false)
      if (data.synced) writeCache(uid, data)
    } catch {
      // No signal. Whatever is on screen came from the cache and stays.
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [uid, getToken])

  useEffect(() => { void refresh() }, [refresh])

  // Coming back to the app is the moment the number is most likely stale —
  // the customer has just been to the counter.
  useEffect(() => {
    if (!uid) return
    const onVisible = () => { if (!document.hidden) void refresh() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onVisible)
    }
  }, [uid, refresh])

  return { me, loading, offline, refresh }
}
