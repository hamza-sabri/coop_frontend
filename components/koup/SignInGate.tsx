'use client'
/* ==========================================================================
   The door.

   Nobody sees كوب without signing in — but they do get to see it. The app
   renders behind, lightly blurred and inert, so the first thing a new customer
   meets is their cup and their menu rather than an empty login form. It is the
   shop window, and it is the reason to sign in.

   Google and Facebook only. No password to invent, no email to verify, no
   phone number: SMS to +970 through Clerk is an unresolved question (their
   allowlist is US/CA by default) and a broken OTP at the counter is worse
   than no OTP at all.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { useClerk, useSignIn } from '@clerk/nextjs'
import { gsap } from 'gsap'

type Provider = 'oauth_google' | 'oauth_facebook'

/* Facebook is off unless it is explicitly switched on.
   Clerk's development instances sign in through Clerk's OWN shared Facebook
   app, and Meta currently has that app deactivated — every tap returns
   Facebook's "App not active" page, for us and for every other Clerk dev
   instance. Google's shared app is fine, which is why only Facebook fails.
   The fix is custom credentials: create a Facebook app, put its App ID and
   secret into Clerk's Facebook connection, then set
   NEXT_PUBLIC_KOUP_FACEBOOK=on. Until then, showing a button that cannot
   possibly work costs more trust than the missing provider does. */
const FACEBOOK_ON = process.env.NEXT_PUBLIC_KOUP_FACEBOOK === 'on'

export default function SignInGate() {
  /* Readiness comes from the Clerk instance, NOT from useSignIn().isLoaded.
     That flag can sit false while Clerk is perfectly loaded and the signIn
     resource exists — which showed a "cannot reach Clerk" warning over a
     working sign-in, and is exactly the kind of lie that costs an evening. */
  const clerk = useClerk()
  const { signIn } = useSignIn()
  const isLoaded = Boolean(clerk?.loaded)
  const [busy, setBusy] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    gsap.fromTo('.gate-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: .7, ease: 'expo.out', delay: .2 })
    gsap.fromTo('.gate-card > *',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'power3.out', delay: .34 })
  }, [])

  /* Clerk never finishing its handshake is the failure that looks like nothing
     at all: the buttons sit there disabled and no click does anything. Say so
     rather than leaving someone tapping a dead card. */
  useEffect(() => {
    if (isLoaded) { setStalled(false); return }
    const t = setTimeout(() => setStalled(true), 4000)
    return () => clearTimeout(t)
  }, [isLoaded])

  async function go(strategy: Provider) {
    if (busy) return
    /* Resolve a REAL SignIn resource.

       `useSignIn()` returns `signIn: undefined` whenever its own `isLoaded` is
       false — and that flag can sit false while Clerk is fully loaded. The
       Clerk object from `useClerk()` is an isomorphic wrapper whose `.client`
       does not carry the resource methods, which is why reaching through it
       threw "authenticateWithRedirect is not a function".

       So: take the first candidate that actually HAS the method. */
    const candidates = [
      signIn,
      (clerk as unknown as { client?: { signIn?: unknown } })?.client?.signIn,
      (globalThis as unknown as { Clerk?: { client?: { signIn?: unknown } } })
        ?.Clerk?.client?.signIn,
    ]
    const attempt = candidates.find(
      (c): c is NonNullable<typeof signIn> =>
        typeof (c as { authenticateWithRedirect?: unknown })
          ?.authenticateWithRedirect === 'function',
    )
    if (!attempt) {
      setError('لسا عم نحمّل صفحة الدخول… جرّب بعد ثانية.')
      return
    }
    setBusy(strategy); setError(null)
    let popup: Window | null = null
    try {
      /* Popup, not redirect. A redirect unloads the page: the splash, the
         pour, the whole opening replays before you are back — for something
         that took two seconds. The popup leaves the app running and the
         session simply appears when it closes. Redirect stays as the fallback
         for browsers that block the popup. */
      /* Absolute, not relative. The redirect flow resolves a bare path against
         the origin for you; the popup flow does not — it hands the value
         straight to `new URL()` with no base, which throws "Invalid URL" and
         the sign-in dies on the first click. */
      const back = new URL('/app/sso-callback', window.location.origin).toString()
      const done = new URL('/app', window.location.origin).toString()

      const withPopup = attempt as unknown as {
        authenticateWithPopup?: (p: Record<string, unknown>) => Promise<void>
      }
      if (typeof withPopup.authenticateWithPopup === 'function') {
        /* Opened inside the click so the browser counts it as user-initiated.
           If the flow then fails we have to close it ourselves — a dead blank
           window left on screen reads as a broken app. */
        popup = window.open('', '_blank', 'width=520,height=680')
        if (popup) {
          await withPopup.authenticateWithPopup({
            strategy, redirectUrl: back, redirectUrlComplete: done, popup,
          })
          setBusy(null)
          return
        }
      }
      /* Same story as the popup: the resource we picked is the one that
         actually carries this method, but the union's typed arm no longer
         declares it. The runtime check above is the real guard. */
      await (attempt as unknown as {
        authenticateWithRedirect: (p: Record<string, unknown>) => Promise<void>
      }).authenticateWithRedirect({
        strategy, redirectUrl: back, redirectUrlComplete: done,
      })
    } catch (e) {
      setBusy(null)
      try { popup?.close() } catch { /* already gone */ }
      // Surface the real reason — an unconfigured provider and a network
      // failure look identical from the outside, and guessing wastes an hour.
      const msg =
        (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0]
          ?.longMessage ??
        (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        (e as Error)?.message ??
        'تعذّر فتح صفحة الدخول.'
      setError(msg)
      // eslint-disable-next-line no-console
      console.error('[koup] sign-in failed:', e)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-lockup">
          <div className="gate-word">كوب</div>
          <div className="gate-rule" />
        </div>

        <h2 className="gate-h">أهلاً فيك</h2>
        <p className="gate-p">
          سجّل دخولك وابدأ تجمع نقاطك — كل كوب بيقرّبك من كوب مجاني.
        </p>

        <div className="gate-actions">
          <button className="gate-btn gate-google" disabled={busy !== null}
            onClick={() => go('oauth_google')}>
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"/>
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"/>
              <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z"/>
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"/>
            </svg>
            <span>{busy === 'oauth_google' ? 'لحظة…' : 'Google'}</span>
          </button>

          {FACEBOOK_ON && (
          <button className="gate-btn gate-fb" disabled={busy !== null}
            onClick={() => go('oauth_facebook')}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff" aria-hidden>
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>
            </svg>
            <span>{busy === 'oauth_facebook' ? 'لحظة…' : 'Facebook'}</span>
          </button>
          )}
        </div>

        {error && <p className="gate-err">{error}</p>}
        {stalled && !error && (
          <p className="gate-err">
            ما قدرنا نوصل لـ Clerk — غالباً مفتاح السيرفر ناقص بملف البيئة.
            {/* A shell path inside RTL text gets torn apart by the bidi
                algorithm — "./set-clerk-secret.sh" renders as "set-/.".
                Isolate it so it stays a command. */}
            <bdi dir="ltr" className="gate-cmd">./set-clerk-secret.sh sk_test_…</bdi>
          </p>
        )}

        {/* Clerk mounts its Smart CAPTCHA here on custom flows. Without the
            element it warns and silently drops to the invisible widget, which
            is weaker bot protection than the one we asked for. */}
        <div id="clerk-captcha" className="gate-captcha" />

        <p className="gate-fine">
          بتسجيلك بتوافق على إننا نحفظ اسمك وصورتك عشان نربط نقاطك بحسابك.
        </p>
      </div>
    </div>
  )
}
