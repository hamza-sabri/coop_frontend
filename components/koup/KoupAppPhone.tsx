'use client'
/* The customer app, signed in by phone (lib/customer-session.ts).

   The same screens as before — points, visits, profile — now with a real
   sign-in behind them that works for any café on the platform: the session
   names its own store, so the server answers with THIS shop's customer. */
import { useCallback, useEffect, useState } from 'react'
import KoupApp from '@/components/KoupApp'
import PhoneSignIn from '@/components/koup/PhoneSignIn'
import InstallPrompt from '@/components/koup/InstallPrompt'
import HandoffCode from '@/components/koup/HandoffCode'
import { clearShopMeCache, useShopMe } from '@/lib/koup-me'
import { clearSession, loadSession, logoutSession, storeSlug, type CustomerSession } from '@/lib/customer-session'
import { useKoupOrders } from '@/lib/koup-orders'
import { publicOrdering } from '@/api/public'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

function InstallWithHandoff() {
  return (<><InstallPrompt /><HandoffCode /></>)
}

export default function KoupAppPhone() {
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setSession(loadSession())
    sync()
    setReady(true)
    window.addEventListener('sijilli:session', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sijilli:session', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const uid = session ? `${session.store}:${session.customer.id}` : undefined
  const getToken = useCallback(async () => session?.token ?? null, [session])
  const { me, refresh: refreshMe } = useShopMe(uid, session ? getToken : undefined)

  /* The menu is always there to browse. Ordering only while the shop takes
     online orders — asked fresh on every visit (the switch is server-side),
     and "closed" when the answer cannot be had: never take an order nobody
     is watching for. */
  const [ordering, setOrdering] = useState(false)
  useEffect(() => {
    let alive = true
    publicOrdering(session?.store || storeSlug())
      .then(r => { if (alive) setOrdering(Boolean(r.open)) })
      .catch(() => { if (alive) setOrdering(false) })
    return () => { alive = false }
  }, [session?.store])
  const { orders, live: liveOrder, past: pastOrders, place: placeOrder, refresh: refreshOrders } =
    useKoupOrders(ordering ? uid : undefined, session ? getToken : undefined)

  /* A session the server no longer accepts (signed out elsewhere, expired,
     revoked) must drop back to the door instead of showing stale numbers. */
  useEffect(() => {
    if (!session) return
    fetch(`${API}/api/v1/shop/me/`, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store' })
      .then(r => { if (r.status === 401) { clearShopMeCache(); clearSession() } })
      .catch(() => { /* offline: keep the session */ })
  }, [session])

  const saveProfile = useCallback(async (data: Record<string, string>) => {
    if (!session) return { ok: false, error: 'سجّل دخولك من جديد.' }
    try {
      const res = await fetch(`${API}/api/v1/shop/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body?.detail ?? 'ما زبط الحفظ.', field: body?.field }
      await refreshMe()
      return { ok: true }
    } catch {
      return { ok: false, error: 'ما في إنترنت — جرّب كمان شوي.' }
    }
  }, [session, refreshMe])

  const signOut = useCallback(async () => {
    clearShopMeCache()
    await logoutSession()
  }, [])

  const profile = me?.profile
  return (
    <KoupApp
      auth={{
        locked: ready && !session,
        user: session
          ? { firstName: (profile?.name || session.customer.name || '').split(' ')[0] || null,
              imageUrl: profile?.avatar || null }
          : null,
        Gate: PhoneSignIn,
        Install: InstallWithHandoff,
        me,
        refreshMe,
        hasPhone: true,
        club: { saveProfile, signOut, email: null },
        menu: { canOrder: ordering && Boolean(session) },
        ...(ordering ? { orders, liveOrder, pastOrders, placeOrder, refreshOrders } : {}),
      }}
    />
  )
}
