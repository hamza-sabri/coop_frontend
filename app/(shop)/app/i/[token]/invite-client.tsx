'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import HandoffCode from '@/components/koup/HandoffCode'
import { AuthError, isIOS, isStandalone, loadSession, redeemLink } from '@/lib/customer-session'

type State = 'working' | 'ios-install' | 'expired' | 'error'

export default function InviteClient({ token }: { token: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('working')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const next = () => {
      // iPhone in Safari: the home-screen app will not share this sign-in, so
      // say how to install it and offer the free transfer code first.
      if (isIOS() && !isStandalone()) setState('ios-install')
      else router.replace('/app')
    }
    // Already signed in on this phone (the link opened twice): just go in.
    if (loadSession()) { next(); return }
    redeemLink(token)
      .then(next)
      .catch((e) => {
        if (e instanceof AuthError && e.status === 410) setState('expired')
        else { setState('error'); setMsg(e instanceof AuthError ? e.message : '') }
      })
  }, [token, router])

  return (
    <main dir="rtl" className="koup" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center',
      background: '#131C3D', color: '#F7F1E8', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center', display: 'grid', gap: 14 }}>
        {state === 'working' && <p>لحظة، عم نفتح حسابك…</p>}
        {state === 'ios-install' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>أهلاً! دخلت حسابك ✓</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, opacity: .85 }}>
            لتضيف التطبيق: اضغط زر المشاركة <b>⬆︎</b> بالأسفل، ثم <b>&quot;إضافة إلى الشاشة الرئيسية&quot;</b>.
          </p>
          <HandoffCode />
          <button className="press" style={{ marginTop: 6, color: '#DDBC8A' }} onClick={() => router.replace('/app')}>
            تابع في المتصفح ←
          </button>
        </>)}
        {state === 'expired' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>الرابط انتهى أو استُخدم</h1>
          <p style={{ fontSize: 14, opacity: .85 }}>ولا يهمك — ادخل برقم جوالك وبنبعتلك رمز.</p>
          <button className="press" style={{ padding: '14px', borderRadius: 16, background: '#DDBC8A', color: '#241804', fontWeight: 700 }}
            onClick={() => router.replace('/app')}>ادخل برقم جوالك</button>
        </>)}
        {state === 'error' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>ما زبط الدخول</h1>
          <p style={{ fontSize: 14, opacity: .85 }}>{msg || 'تأكد من الإنترنت وجرّب مرة ثانية.'}</p>
          <button className="press" style={{ color: '#DDBC8A' }} onClick={() => window.location.reload()}>جرّب مرة ثانية</button>
        </>)}
      </div>
    </main>
  )
}
