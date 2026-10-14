'use client'
/* The web page's own pieces: the visits list and the profile form.

   Everything the customer types here is saved to the shop's server (not to the
   phone) — the point of the page is that the shop learns who its regulars are:
   their number links their till visits to them, gender and birthday shape the
   offers they get. */
import { useEffect, useState } from 'react'
import { gsap } from 'gsap'
import type { ShopMe, ShopPurchase } from '@/lib/koup-me'
import { SFX, haptic } from '@/lib/sfx'

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' })
const money = (v: string | number) => {
  const n = Number(v)
  return `₪${n.toFixed(n % 1 ? 2 : 0)}`
}

export function ClubVisits({ purchases }: { purchases: ShopPurchase[] }) {
  if (!purchases.length) {
    return (
      <div className="club-card club-empty-card">
        <span className="club-empty-ic">☕</span>
        <p className="club-empty">
          لسا ما في زيارات مسجّلة باسمك. عند الكاشير قول رقمك — وكل كوب بيظهر هون مع نقاطه.
        </p>
      </div>
    )
  }
  return (
    <div className="club-visits">
      {purchases.map((p, i) => (
        <div className="club-visit" key={p.id} style={{ ['--i' as string]: i }}>
          <div className="club-visit-top">
            <div className="club-visit-when">
              <b>{fmtDay(p.at)}</b>
              <span className="num">{fmtTime(p.at)}</span>
            </div>
            <span className={`club-visit-total num ${p.is_return ? 'neg' : ''}`}>
              {p.is_return ? '−' : ''}{money(p.total)}
            </span>
          </div>
          <div className="club-visit-items">
            {p.items.map((it, k) => (
              <span key={k} className="club-chip">
                {it.name}{Number(it.qty) > 1 ? <b className="num"> ×{it.qty}</b> : null}
              </span>
            ))}
          </div>
          {(p.points_earned > 0 || p.points_spent > 0) && (
            <div className="club-visit-pts">
              {p.points_earned > 0 && <span className="pos num"><bdi dir="ltr">+{p.points_earned}</bdi> نقطة</span>}
              {p.points_spent > 0 && <span className="neg num"><bdi dir="ltr">−{p.points_spent}</bdi> نقطة</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

type Save = (d: Partial<{ name: string; gender: string; phone: string; birth_date: string }>)
  => Promise<{ ok: boolean; error?: string; field?: string }>

export function ClubProfile({
  me, email, fallbackName, fallbackAvatar, save, onSettings, onSignOut,
}: {
  me: ShopMe | null
  email: string
  fallbackName: string
  fallbackAvatar: string
  save: Save
  onSettings: () => void
  onSignOut: () => Promise<void>
}) {
  const p = me?.profile
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'' | 'male' | 'female'>('')
  const [phone, setPhone] = useState('')
  const [birth, setBirth] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)

  // Fill the form from the server once it answers — and again after a save.
  useEffect(() => {
    if (!p) return
    setName(p.name || fallbackName)
    setGender(p.gender)
    setPhone(p.phone)
    setBirth(p.birth_date)
  }, [p, fallbackName])

  useEffect(() => {
    gsap.fromTo('.club-profile > *', { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .05, ease: 'power3.out', clearProps: 'transform' })
  }, [])

  const dirty = Boolean(p) && (
    name.trim() !== (p!.name || '') || gender !== p!.gender ||
    phone.replace(/\D/g, '') !== (p!.phone || '') || birth !== (p!.birth_date || '')
  )

  async function submit() {
    if (!p || saving) return
    const data: Record<string, string> = {}
    if (name.trim() && name.trim() !== p.name) data.name = name.trim()
    if (gender && gender !== p.gender) data.gender = gender
    if (phone.trim() && phone.replace(/\D/g, '') !== p.phone) data.phone = phone
    if (birth !== p.birth_date) data.birth_date = birth
    if (!Object.keys(data).length) return
    setSaving(true); setMsg(null)
    const r = await save(data)
    setSaving(false)
    if (r.ok) {
      SFX.chime(); haptic([10, 50, 18])
      setMsg({ ok: true, text: 'انحفظ ✓' })
    } else {
      SFX.tap()
      setMsg({ ok: false, text: r.error ?? 'ما زبط الحفظ.', field: r.field })
    }
  }

  const avatar = p?.avatar || fallbackAvatar
  const since = p?.member_since
    ? new Date(p.member_since).toLocaleDateString('ar', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="club-profile">
      <div className="club-id">
        <div className="club-avatar">
          {avatar
            ? <img src={avatar} alt="" referrerPolicy="no-referrer" />
            : <span>{(name || fallbackName || 'ك')[0]}</span>}
        </div>
        <div className="club-id-t">
          <h2>{name || fallbackName}</h2>
          {email && <p dir="ltr">{email}</p>}
          {since && <p className="club-since">عضو منذ {since}</p>}
        </div>
      </div>

      {p && !p.complete && (
        <p className="club-hint">كمّل رقمك وجنسك — هيك بنربط زياراتك عند الكاشير بحسابك.</p>
      )}

      <label className="club-field">
        <span>الاسم</span>
        <input className="phoneask-in" value={name} maxLength={80}
          onChange={e => { setName(e.target.value); setMsg(null) }} />
      </label>

      <div className="club-field">
        <span>الجنس</span>
        <div className="club-seg" role="radiogroup">
          {([['male', 'ذكر'], ['female', 'أنثى']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={gender === v}
              className="press" onClick={() => { SFX.tap(); setGender(v); setMsg(null) }}>
              {l}
            </button>
          ))}
        </div>
        {msg?.field === 'gender' && <p className="phoneask-err">{msg.text}</p>}
      </div>

      <label className="club-field">
        <span>رقم الجوال</span>
        <input className="phoneask-in num" type="tel" inputMode="tel" dir="ltr"
          placeholder="059 000 0000" value={phone}
          onChange={e => { setPhone(e.target.value); setMsg(null) }} />
        {msg?.field === 'phone' && <p className="phoneask-err">{msg.text}</p>}
      </label>

      <label className="club-field">
        <span>تاريخ الميلاد <small>(اختياري — بنتذكرك بعيدك 🎂)</small></span>
        <input className="phoneask-in num" type="date" dir="ltr" value={birth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => { setBirth(e.target.value); setMsg(null) }} />
        {msg?.field === 'birth_date' && <p className="phoneask-err">{msg.text}</p>}
      </label>

      <button className="cta press club-save" disabled={!dirty || saving || !p} onClick={submit}>
        {saving ? 'لحظة…' : 'احفظ'}
      </button>
      {msg && !msg.field && (
        <p className={msg.ok ? 'club-ok' : 'phoneask-err'}>{msg.text}</p>
      )}

      <div className="club-actions">
        <button className="btn-ghost press" onClick={onSettings}>الإعدادات</button>
        <button className="btn-ghost press club-out" onClick={() => { SFX.tap(); void onSignOut() }}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
