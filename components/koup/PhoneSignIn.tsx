'use client'
/* The door: sign in with your mobile number.

   Number → 6-digit SMS code → in, and remembered on this phone (an SMS costs
   the shop money, so nobody is asked twice on the same device).

   On an iPhone home-screen app there is a second, free door: Safari does not
   share its sign-in with the installed app, so a customer who signed in from
   the SMS link in Safari gets a short code there and types it here. */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  AuthError, isIOS, isStandalone, normalisePhone, redeemHandoff, requestOtp, storeSlug, verifyOtp,
} from '@/lib/customer-session'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

type Step = 'phone' | 'code' | 'handoff'

export default function PhoneSignIn() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [shop, setShop] = useState('')
  const [iosApp, setIosApp] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    gsap.fromTo('.gate-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'expo.out', delay: .15 })
    setIosApp(isIOS() && isStandalone())
    const slug = storeSlug()
    if (!slug) return
    fetch(`${API}/api/v1/public/branding/?store=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (b?.name) setShop(String(b.name)) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait(w => w - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  // Android Chrome can read the SMS for us (WebOTP): the code fills itself in.
  useEffect(() => {
    if (step !== 'code' || typeof window === 'undefined' || !('OTPCredential' in window)) return
    const ac = new AbortController()
    ;(navigator.credentials as unknown as {
      get: (o: unknown) => Promise<{ code?: string } | null>
    }).get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then(c => { if (c?.code) { setCode(c.code); void submitCode(c.code) } })
      .catch(() => {})
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const local = normalisePhone(phone)

  function fail(e: unknown) {
    if (e instanceof AuthError) {
      setErr(e.message)
      if (e.retryAfter) setWait(e.retryAfter)
    } else setErr('صار خطأ، جرّب مرة ثانية')
  }

  async function sendCode() {
    if (!local) { setErr('رقم جوال غير صحيح — مثال: 0599123456'); return }
    setBusy(true); setErr(null)
    try {
      const r = await requestOtp(local)
      if (r.debug_code) setCode(r.debug_code) // local testing only
      setStep('code'); setWait(60)
      window.setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  async function submitCode(value = code) {
    if (!local || !/^\d{6}$/.test(value)) { setErr('اكتب الرمز من 6 أرقام'); return }
    setBusy(true); setErr(null)
    try {
      if (step === 'handoff') await redeemHandoff(local, value)
      else await verifyOtp(local, value, name.trim())
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-lockup">
          <div className="gate-word">{shop || ' '}</div>
          <div className="gate-rule" />
        </div>

        {step === 'phone' && (<>
          <h2 className="gate-h">نقاطك برقم جوالك</h2>
          <p className="gate-p">بنبعتلك رمز برسالة SMS — مرة وحدة على هالجهاز.</p>
          <label className="club-field">
            <span>رقم الجوال</span>
            <input className="phoneask-in num" type="tel" inputMode="tel" dir="ltr" autoComplete="tel"
              placeholder="059 000 0000" value={phone}
              onChange={e => { setPhone(e.target.value); setErr(null) }}
              onKeyDown={e => { if (e.key === 'Enter') void sendCode() }} />
          </label>
          <label className="club-field">
            <span>اسمك <small>(اختياري)</small></span>
            <input className="phoneask-in" value={name} maxLength={80} autoComplete="name"
              onChange={e => setName(e.target.value)} />
          </label>
          {err && <p className="phoneask-err">{err}</p>}
          <button className="gate-btn club-save" disabled={busy || wait > 0} onClick={() => void sendCode()}>
            {busy ? '...' : wait > 0 ? `انتظر ${wait} ث` : 'أرسل الرمز'}
          </button>
          {iosApp && (
            <button className="gate-btn" style={{ background: 'transparent', color: 'var(--app-ink2)' }}
              onClick={() => { setStep('handoff'); setErr(null); setCode('') }}>
              عندي رمز من Safari
            </button>
          )}
        </>)}

        {(step === 'code' || step === 'handoff') && (<>
          <h2 className="gate-h">{step === 'handoff' ? 'الرمز من Safari' : 'اكتب الرمز'}</h2>
          <p className="gate-p">
            {step === 'handoff'
              ? 'افتح الرابط في Safari، واضغط "رمز النقل"، واكتبه هون مع رقمك.'
              : <>بعتنا رمز من 6 أرقام على <b className="num" dir="ltr">{local}</b></>}
          </p>
          {step === 'handoff' && (
            <label className="club-field">
              <span>رقم الجوال</span>
              <input className="phoneask-in num" type="tel" inputMode="tel" dir="ltr"
                placeholder="059 000 0000" value={phone}
                onChange={e => { setPhone(e.target.value); setErr(null) }} />
            </label>
          )}
          <input ref={codeRef} className="phoneask-in num" dir="ltr" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} placeholder="••••••"
            style={{ textAlign: 'center', letterSpacing: '.4em', fontSize: 22 }}
            value={code}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCode(v); setErr(null)
              if (v.length === 6) void submitCode(v)
            }} />
          {err && <p className="phoneask-err">{err}</p>}
          <button className="gate-btn club-save" disabled={busy} onClick={() => void submitCode()}>
            {busy ? '...' : 'دخول'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <button className="press" style={{ color: 'var(--app-ink2)' }}
              onClick={() => { setStep('phone'); setCode(''); setErr(null) }}>
              تغيير الرقم
            </button>
            {step === 'code' && (
              <button className="press" style={{ color: wait > 0 ? 'var(--app-ink3)' : 'var(--app-gold)' }}
                disabled={wait > 0 || busy} onClick={() => void sendCode()}>
                {wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : 'أرسل الرمز مرة ثانية'}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  )
}
