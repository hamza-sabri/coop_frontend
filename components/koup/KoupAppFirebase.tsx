'use client'
/* The customer's web page, signed in with Google through Firebase.

   The same screens as the app — the cup, the pour, the balance — narrowed to
   what the web is for: who you are, your points, your visits. Ordering and the
   menu belong to the Flutter app. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import KoupApp from '@/components/KoupApp'
import FirebaseGate from '@/components/koup/FirebaseGate'
import InstallPrompt from '@/components/koup/InstallPrompt'
import { clearShopMeCache, useShopMe } from '@/lib/koup-me'
import { firebaseAuth, linkPendingFacebook, signOutWeb } from '@/lib/firebase-web'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export default function KoupAppFirebase() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const synced = useRef<string | null>(null)

  useEffect(() => {
    let off: (() => void) | undefined
    void firebaseAuth().then(async (auth) => {
      const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')
      // Finishes a redirect sign-in (the popup-blocked fallback), if any.
      getRedirectResult(auth).catch(() => {})
      off = onAuthStateChanged(auth, (u) => {
        setUser(u); setReady(true)
        // Came in with Google after Facebook was refused for the same email:
        // attach Facebook now, so either button opens this account next time.
        if (u) void linkPendingFacebook()
      })
    }).catch(() => setReady(true))
    return () => off?.()
  }, [])

  const getToken = useCallback(async () => (user ? user.getIdToken() : null), [user])
  const { me, refresh: refreshMe } = useShopMe(user?.uid, user ? getToken : undefined)

  /* Tell the shop who walked in — once per sign-in. The upsert is idempotent,
     and the first /shop/me/ is re-read after it so a brand-new customer does
     not see "not synced" for a whole visit. */
  useEffect(() => {
    if (!user || synced.current === user.uid) return
    synced.current = user.uid
    void (async () => {
      try {
        const token = await user.getIdToken()
        await fetch(`${API}/api/v1/firebase/sync/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: user.displayName ?? '' }),
        })
        await refreshMe()
      } catch {
        /* offline — the next launch tries again */
      }
    })()
  }, [user, refreshMe])

  const saveProfile = useCallback(async (data: Record<string, string>) => {
    try {
      const token = await getToken()
      if (!token) return { ok: false, error: 'سجّل دخولك من جديد.' }
      const res = await fetch(`${API}/api/v1/shop/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body?.detail ?? 'ما زبط الحفظ.', field: body?.field }
      await refreshMe()
      return { ok: true }
    } catch {
      return { ok: false, error: 'ما في إنترنت — جرّب كمان شوي.' }
    }
  }, [getToken, refreshMe])

  const signOut = useCallback(async () => {
    clearShopMeCache()
    synced.current = null
    await signOutWeb()
  }, [])

  const profile = me?.profile
  return (
    <KoupApp
      auth={{
        locked: ready && !user,
        user: user
          ? {
              firstName: (profile?.name || user.displayName || '').split(' ')[0] || null,
              imageUrl: profile?.avatar || user.photoURL,
            }
          : null,
        Gate: FirebaseGate,
        Install: InstallPrompt,
        me,
        refreshMe,
        club: { saveProfile, signOut, email: user?.email },
      }}
    />
  )
}
