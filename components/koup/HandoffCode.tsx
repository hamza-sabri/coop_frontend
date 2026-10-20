'use client'
/* iPhone only, in Safari, signed in: a free code to sign in the home-screen app.

   Apple keeps a home-screen web app's storage apart from Safari's, so after
   "Add to Home Screen" the installed app starts signed out. Instead of a
   second paid SMS, Safari shows a 6-digit code (10 minutes, single use) and
   the installed app asks for it. Renders nothing anywhere else. */
import { useEffect, useState } from 'react'
import { AuthError, createHandoff, isIOS, isStandalone, loadSession } from '@/lib/customer-session'

export default function HandoffCode() {
  const [show, setShow] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setShow(isIOS() && !isStandalone() && Boolean(loadSession())) }, [])
  if (!show) return null

  async function make() {
    const s = loadSession()
    if (!s) return
    setBusy(true); setErr(null)
    try {
      const r = await createHandoff(s.token)
      setCode(r.code)
    } catch (e) {
      setErr(e instanceof AuthError ? e.message : 'صار خطأ، جرّب مرة ثانية')
    } finally { setBusy(false) }
  }

  return (
    <div className="club-field" style={{ marginTop: 10, padding: '12px 14px', borderRadius: 18,
      background: 'rgba(221,188,138,.08)', border: '1px solid rgba(221,188,138,.22)' }}>
      <span>بعد ما تضيف التطبيق للشاشة الرئيسية</span>
      {code ? (
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>
          افتح التطبيق من الشاشة الرئيسية واختر "عندي رمز من Safari"، واكتب:
          <b className="num" dir="ltr" style={{ display: 'block', fontSize: 28, letterSpacing: '.3em', textAlign: 'center', margin: '6px 0' }}>{code}</b>
          <small>صالح لمدة 10 دقائق، ولمرة وحدة.</small>
        </p>
      ) : (
        <button className="gate-btn club-save" disabled={busy} onClick={() => void make()}>
          {busy ? '...' : 'رمز النقل للتطبيق'}
        </button>
      )}
      {err && <p className="phoneask-err">{err}</p>}
    </div>
  )
}
