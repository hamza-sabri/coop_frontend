'use client'
/* ==========================================================================
   "What's your number?"

   Google gives us a name, a photo and an email — never a phone. But the phone
   is what the counter knows a regular by, and it is how a walk-in record and
   an app account turn out to be the same person. So we ask once, gently, and
   never block the app on it.

   Asked once, right after an order — the only moment the number is obviously
   useful to THEM ("so the barista knows it's you"), rather than a form standing
   between someone and the menu.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { SFX } from '@/lib/sfx'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
const DISMISSED = 'koup.phone.dismissed'

/** Palestinian mobiles are 059/056 + 7 digits; accept +970/+972 forms too. */
function normalise(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '')
  const local = d.replace(/^(\+?9(?:70|72))/, '0')
  return /^05\d{8}$/.test(local) ? local : null
}

export default function PhonePrompt({ armed = false }: { armed?: boolean }) {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [value, setValue] = useState('')
  const [state, setState] = useState<'ask' | 'saving' | 'done' | 'hidden'>('hidden')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!armed || !user) return
    if (user.primaryPhoneNumber?.phoneNumber) { setState('hidden'); return }
    try {
      if (localStorage.getItem(DISMISSED) === '1') { setState('hidden'); return }
    } catch { /* private window — just ask */ }
    setState('ask')
  }, [armed, user])

  if (state === 'hidden' || state === 'done') return null

  async function save() {
    const phone = normalise(value)
    if (!phone) { setError('رقم غير صحيح — مثال: 0597020201'); return }
    setState('saving'); setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/v1/clerk/sync/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone,
          first_name: user?.firstName ?? '',
          last_name: user?.lastName ?? '',
          image_url: user?.imageUrl ?? '',
          email: user?.primaryEmailAddress?.emailAddress ?? '',
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      SFX.chime()
      setState('done')
    } catch {
      setState('ask')
      setError('ما زبطت. جرّب كمان شوي.')
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISSED, '1') } catch { /* fine */ }
    setState('hidden')
  }

  return (
    <div className="phoneask">
      <div className="phoneask-t">
        <b>رقمك؟</b>
        <span>عشان نعرفك عالكاشير ونربط نقاطك حتى لو نسيت الجوال.</span>
      </div>
      <div className="phoneask-row">
        <input
          className="phoneask-in num"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          placeholder="059 000 0000"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
          disabled={state === 'saving'}
        />
        <button className="phoneask-go press" onClick={() => void save()}
          disabled={state === 'saving' || !value.trim()}>
          {state === 'saving' ? '…' : 'احفظ'}
        </button>
      </div>
      {error && <p className="phoneask-err">{error}</p>}
      <button className="phoneask-skip" onClick={dismiss}>مش هلق</button>
    </div>
  )
}
