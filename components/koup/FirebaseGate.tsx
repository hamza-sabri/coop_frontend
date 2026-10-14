'use client'
/* The door, Firebase edition. Same card, same entrance as the Clerk one —
   the page sits blurred behind it — with one button: Google. */
import { useEffect, useState } from 'react'
import { gsap } from 'gsap'
import {
  FACEBOOK_ON, completeFacebookReturn, firebaseAuth, inAppBrowser, signInError, signInWithFacebook, signInWithGoogle,
} from '@/lib/firebase-web'

export default function FirebaseGate() {
  const [busy, setBusy] = useState<'' | 'google' | 'facebook'>('')
  const [error, setError] = useState<string | null>(null)
  const [inApp, setInApp] = useState(false)
  useEffect(() => {
    setInApp(inAppBrowser())
    // Back from a sign-in that left the page (Facebook on a phone, or a
    // redirect): finish it, or say why it failed instead of silently showing
    // the door again.
    void (async () => {
      try {
        if (await completeFacebookReturn()) {
          setBusy('facebook')
          return
        }
        const { getRedirectResult } = await import('firebase/auth')
        await getRedirectResult(await firebaseAuth())
      } catch (e) {
        setBusy('')
        setError(signInError(e))
      }
    })()
  }, [])

  useEffect(() => {
    gsap.fromTo('.gate-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: .7, ease: 'expo.out', delay: .2 })
    gsap.fromTo('.gate-card > *',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'power3.out', delay: .34 })
  }, [])

  async function go(which: 'google' | 'facebook') {
    if (busy) return
    setBusy(which); setError(null)
    try {
      await (which === 'facebook' ? signInWithFacebook() : signInWithGoogle())
    } catch (e) {
      setError(signInError(e))
      // eslint-disable-next-line no-console
      console.error('[koup] sign-in failed:', e)
    } finally {
      setBusy('')
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
          سجّل دخولك وشوف نقاطك وزياراتك — كل كوب بيقرّبك من كوب مجاني.
        </p>

        <p className="gate-via">ادخل بحسابك على</p>
        <div className="gate-actions gate-actions-2" style={FACEBOOK_ON ? undefined : { gridTemplateColumns: "1fr" }}>
          {FACEBOOK_ON && (
            <button className="gate-btn gate-facebook" disabled={Boolean(busy)} onClick={() => go('facebook')}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="#fff" />
                <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>
              </svg>
              <span>{busy === 'facebook' ? 'لحظة…' : 'فيسبوك'}</span>
            </button>
          )}
          <button className="gate-btn gate-google" disabled={Boolean(busy)} onClick={() => go('google')}>
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"/>
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"/>
              <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z"/>
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"/>
            </svg>
            <span>{busy === 'google' ? 'لحظة…' : 'Google'}</span>
          </button>
        </div>

        {error && <p className="gate-err">{error}</p>}

        {inApp && (
          <p className="gate-fine gate-inapp">
            {FACEBOOK_ON ? 'إذا ما زبط Google: ' : ''}افتح الصفحة في المتصفح — اضغط ⋯ فوق واختر «فتح في المتصفح» (Chrome أو Safari).
          </p>
        )}

        <p className="gate-fine">
          بتسجيلك بتوافق على إننا نحفظ اسمك وصورتك ورقمك عشان نربط نقاطك وزياراتك بحسابك.
        </p>
      </div>
    </div>
  )
}
