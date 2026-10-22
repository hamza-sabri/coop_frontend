'use client'
/* The web page's own pieces: the visits list and the profile form.

   Everything the customer types here is saved to the shop's server (not to the
   phone) — the point of the page is that the shop learns who its regulars are:
   their number links their till visits to them, gender and birthday shape the
   offers they get. */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import type { ShopMe, ShopPurchase } from '@/lib/koup-me'
import { SFX, haptic } from '@/lib/sfx'
import { BlurImg } from "@/components/blur-img"

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
  return <VisitsGrid purchases={purchases} />
}

function VisitsGrid({ purchases }: { purchases: ShopPurchase[] }) {
  const [open, setOpen] = useState<ShopPurchase | null>(null)
  return (
    <>
      <div className="club-visits">
        {purchases.map((p, i) => (
          <VisitCard key={p.id} p={p} i={i} onOpen={() => { SFX.tap(); haptic(8); setOpen(p) }} />
        ))}
      </div>
      {open && <VisitSheet p={open} onClose={() => setOpen(null)} />}
    </>
  )
}

const relDay = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff === 0) return 'اليوم'
  if (diff === 1) return 'أمس'
  return d.toLocaleDateString('ar', { weekday: 'long' })
}
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long' })

/* One visit, in the menu's own card: tall, the drink's photo filling it,
   the details on a frosted banner at the bottom. More than one drink → the
   first is the picture and the rest sit as small thumbs on the banner. */
function VisitCard({ p, i, onOpen }: { p: ShopPurchase; i: number; onOpen: () => void }) {
  const free = Number(p.total) === 0 && p.points_spent > 0
  const cups = p.items.reduce((n, it) => n + (Number(it.qty) || 0), 0)
  const lead = p.items.find((it) => it.image) ?? p.items[0]
  const [bad, setBad] = useState(false)
  const img = lead?.image && !bad ? lead.image : ''
  const rest = p.items.filter((it) => it !== lead)
  const title = lead
    ? `${lead.name}${Number(lead.qty) > 1 ? ` ×${lead.qty}` : ''}`
    : 'زيارة'
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      aria-label={`تفاصيل زيارة ${relDay(p.at)}`}
      className={`pcard vcard ${p.is_return ? 'vcard-return' : ''}`}
      data-img={img ? '1' : '0'}
      style={{
        ['--i' as string]: i, ['--c' as string]: '#DDBC8A', ['--c0' as string]: '#3A4C8F',
        ...(img ? { ['--img' as string]: `url("${img}")` } : {}),
      }}
    >
      <div className="pcard-bg" />
      {/* preload to catch a dead link and fall back to the drawn ground */}
      {lead?.image && !bad && <img src={lead.image} alt="" hidden onError={() => setBad(true)} />}
      {!img && <span className="vcard-ph" aria-hidden>☕</span>}

      <div className="vcard-top">
        <span className="vcard-day">{relDay(p.at)}</span>
        {free
          ? <span className="vcard-chip vcard-free">مجاناً</span>
          : <span className="vcard-chip num">{p.is_return ? '−' : ''}{money(p.total)}</span>}
      </div>

      <div className="pcard-banner vcard-banner">
        <h4>{title}</h4>
        <p className="num">
          {p.is_return ? 'إرجاع · ' : rest.length ? `+${rest.length} ${rest.length === 1 ? 'صنف' : 'أصناف'} · ` : ''}
          {dayMonth(p.at)} · {fmtTime(p.at)}
        </p>
        {rest.length > 0 && (
          <div className="vcard-thumbs">
            {rest.slice(0, 4).map((it, k) => (
              <span key={k} className="vcard-thumb" title={it.name}>
                {it.image ? <BlurImg src={it.image} alt={it.name} loading="lazy" /> : '☕'}
              </span>
            ))}
            {rest.length > 4 && <span className="vcard-thumb vcard-more num">+{rest.length - 4}</span>}
          </div>
        )}
        <div className="vcard-pts">
          {p.points_earned > 0 && <span className="cv-pill cv-pill-earn num">✦ <bdi dir="ltr">+{p.points_earned}</bdi></span>}
          {p.points_spent > 0 && <span className="cv-pill cv-pill-spend num"><bdi dir="ltr">−{p.points_spent}</bdi> نقطة</span>}
          {!p.points_earned && !p.points_spent && <span className="vcard-cups num">{cups} {cups === 1 ? 'صنف' : 'أصناف'}</span>}
        </div>
      </div>
    </article>
  )
}

/* The whole visit: every drink with its picture, quantity and price, then the
   bill — before discount, the discount, points used, what was paid, and the
   points it earned. A bottom sheet, like the menu's drink sheet. */
function VisitSheet({ p, onClose }: { p: ShopPurchase; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('.koup') ?? document.body), [])
  useEffect(() => {
    if (!host) return
    gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: .25 })
    gsap.fromTo(body.current, { yPercent: 101 }, { yPercent: 0, duration: .5, ease: 'expo.out' })
    gsap.fromTo('.vs-line', { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: .4, stagger: .04, delay: .12, ease: 'power3.out' })
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])
  function close() {
    gsap.to(scrim.current, { opacity: 0, duration: .2 })
    gsap.to(body.current, { yPercent: 101, duration: .28, ease: 'power2.in', onComplete: onClose })
  }
  if (!host) return null

  const n = (v?: string) => Number(v ?? 0) || 0
  const subtotal = n(p.subtotal) || p.items.reduce((a, it) => a + n(it.line_total), 0)
  const paid = n(p.total)
  const pointsValue = n(p.points_value)
  const discount = Math.max(0, subtotal - paid - pointsValue)
  const cups = p.items.reduce((a, it) => a + (Number(it.qty) || 0), 0)
  const pay = p.payment === 'card' ? 'بطاقة' : p.payment === 'debt' ? 'على الحساب' : 'نقداً'

  return createPortal(
    <div className="vsheet" role="dialog" aria-modal="true" aria-label="تفاصيل الزيارة">
      <div ref={scrim} className="vsheet-scrim" onClick={close} />
      <div ref={body} className="vsheet-body">
        <div className="grab" />
        <header className="vs-head">
          <div>
            <h3>{p.is_return ? 'إرجاع' : 'زيارتك'} · {relDay(p.at)}</h3>
            <p className="num">{dayMonth(p.at)} · {fmtTime(p.at)}{p.code ? <> · <bdi dir="ltr">#{p.code}</bdi></> : null}</p>
          </div>
          <button className="vs-x press" onClick={close} aria-label="إغلاق">✕</button>
        </header>

        <ul className="vs-items">
          {p.items.map((it, k) => (
            <li key={k} className="vs-line">
              <span className="vs-img">
                {it.image ? <BlurImg src={it.image} alt="" loading="lazy" /> : '☕'}
              </span>
              <span className="vs-name">
                <b>{it.name}</b>
                <small className="num">
                  {Number(it.qty) > 1 ? <><bdi dir="ltr">{it.qty}×</bdi> {it.price ? money(it.price) : ''}</> : it.price ? money(it.price) : ''}
                </small>
              </span>
              <span className="vs-amt num">{it.line_total ? money(it.line_total) : ''}</span>
            </li>
          ))}
        </ul>

        <dl className="vs-bill num">
          <div className="vs-line"><dt>{cups} {cups === 1 ? 'صنف' : 'أصناف'}</dt><dd>{money(subtotal)}</dd></div>
          {discount > 0.004 && <div className="vs-line vs-save"><dt>خصم</dt><dd><bdi dir="ltr">−{money(discount)}</bdi></dd></div>}
          {p.points_spent > 0 && (
            <div className="vs-line vs-save">
              <dt>نقاط مستعملة <bdi dir="ltr">({p.points_spent})</bdi></dt>
              <dd>{pointsValue > 0 ? <bdi dir="ltr">−{money(pointsValue)}</bdi> : ''}</dd>
            </div>
          )}
          <div className="vs-line vs-total">
            <dt>{p.is_return ? 'المُعاد' : `المدفوع${paid > 0 ? ` · ${pay}` : ''}`}</dt>
            <dd>{paid === 0 && p.points_spent > 0 ? 'مجاناً بالنقاط' : money(paid)}</dd>
          </div>
          {p.points_earned > 0 && (
            <div className="vs-line vs-earn"><dt>كسبت</dt><dd>✦ <bdi dir="ltr">+{p.points_earned}</bdi> نقطة</dd></div>
          )}
        </dl>
      </div>
    </div>,
    host,
  )
}

type Save = (d: Partial<{ name: string; gender: string; phone: string; birth_date: string }>)
  => Promise<{ ok: boolean; error?: string; field?: string }>

export function ClubProfile({
  me, email, fallbackName, fallbackAvatar, save, onSettings, onSignOut, onDelete,
}: {
  me: ShopMe | null
  email: string
  fallbackName: string
  fallbackAvatar: string
  save: Save
  onSettings: () => void
  onSignOut: () => Promise<void>
  /** Delete the account (App Store / Play rule; offered on the web too). */
  onDelete?: () => Promise<boolean>
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
            ? <BlurImg src={avatar} alt="" referrerPolicy="no-referrer" />
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
      {onDelete && (
        <button
          className="club-delete"
          onClick={async () => {
            SFX.tap()
            if (!window.confirm('حذف حسابك نهائياً؟ تُمسح بياناتك ونقاطك ولا يمكن التراجع.')) return
            const ok = await onDelete()
            if (!ok) window.alert('ما زبط الحذف — جرّب كمان شوي.')
          }}
        >
          حذف حسابي
        </button>
      )}
    </div>
  )
}
