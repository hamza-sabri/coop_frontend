'use client'
/* Mounted only when a Clerk publishable key exists, so `useUser` is never
   called outside a ClerkProvider — which is the crash that would otherwise
   take the whole customer app down before the keys are set. */
import { useEffect, useRef } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import KoupApp from '@/components/KoupApp'
import SignInGate from '@/components/koup/SignInGate'
import AccountButton from '@/components/koup/AccountButton'
import PhonePrompt from '@/components/koup/PhonePrompt'
import InstallPrompt from '@/components/koup/InstallPrompt'
import { useShopMe } from '@/lib/koup-me'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export default function KoupAppAuthed() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const clerk = useClerk()
  const synced = useRef<string | null>(null)
  /* The home screen's numbers. Seeded from localStorage so a phone with no
     signal still shows the balance it last knew. */
  const { me, refresh: refreshMe } = useShopMe(user?.id, getToken)

  /* Tell Django who just walked in. The webhook is the durable path but it
     cannot reach a laptop without a tunnel, and in production it can land
     after the customer's first request — so the app says so itself, once per
     session. The upsert is idempotent, so the two racing is fine. */
  useEffect(() => {
    if (!isSignedIn || !user || synced.current === user.id) return
    synced.current = user.id
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        await fetch(`${API}/api/v1/clerk/sync/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: user.firstName ?? '',
            last_name: user.lastName ?? '',
            image_url: user.imageUrl ?? '',
            email: user.primaryEmailAddress?.emailAddress ?? '',
            phone: user.primaryPhoneNumber?.phoneNumber ?? '',
          }),
        })
      } catch {
        // Offline, or the backend is down. The webhook still covers it, and
        // the next launch tries again — never block the app on this.
      }
    })()
  }, [isSignedIn, user, getToken])

  return (
    <KoupApp
      auth={{
        locked: isLoaded && !isSignedIn,
        user: user ? { firstName: user.firstName, imageUrl: user.imageUrl } : null,
        Gate: SignInGate,
        openProfile: () => clerk.openUserProfile(),
        /* Only once someone is actually signed in. Mounting <UserButton>
           behind the sign-in gate makes clerk-js boot its whole UI layer —
           ~830KB of it — to render an avatar for a user who does not exist
           yet, on the one screen where the customer is already waiting. */
        Account: user ? AccountButton : undefined,
        Phone: PhonePrompt,
        Install: InstallPrompt,
        me,
        refreshMe,
      }}
    />
  )
}
