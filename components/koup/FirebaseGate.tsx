'use client'
/* The door, Firebase edition. Same card, same entrance as the Clerk one —
   the page sits blurred behind it — with one button: Google. */
import { useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { signInError, signInWithGoogle } from '@/lib/firebase-web'

export default function FirebaseGate() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    gsap.fromTo('.gate-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: .7, ease: 'expo.out', delay: .2 })
    gsap.fromTo('.gate-card > *',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'power3.out', delay: .34 })
  }, [])

  async function go() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(signInError(e))
      // eslint-disable-next-line no-console
      console.error('[koup] sign-in failed:', e)
    } finally {
      setBusy(false)
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

        <div className="gate-actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="gate-btn gate-google" disabled={busy} onClick={go}>
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"/>
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"/>
              <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z"/>
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"/>
            </svg>
            <span>{busy ? 'لحظة…' : 'الدخول عبر Google'}</span>
          </button>
        </div>

        {error && <p className="gate-err">{error}</p>}

        <p className="gate-fine">
          بتسجيلك بتوافق على إننا نحفظ اسمك وصورتك ورقمك عشان نربط نقاطك وزياراتك بحسابك.
        </p>
      </div>
    </div>
  )
}
