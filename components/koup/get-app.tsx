'use client'
/* "Get the app" — a nudge on the web app's home, for phones only, and only
   once the store page for THAT phone exists (/public/app-config/). Taps go to
   /get, which picks the right store. Dismissed for two weeks at a time. */
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
const KEY = 'koup.getapp.dismissed'
const QUIET_MS = 14 * 24 * 60 * 60 * 1000

export function GetAppBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/i.test(ua)
    const android = /Android/i.test(ua)
    if (!ios && !android) return
    try {
      const at = Number(localStorage.getItem(KEY) || 0)
      if (at && Date.now() - at < QUIET_MS) return
    } catch { /* storage blocked: still fine to show */ }
    let alive = true
    fetch(`${API}/api/v1/public/app-config/`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((c: { ios_url?: string; android_url?: string } | null) => {
        if (alive && c && (ios ? c.ios_url : c.android_url)) setShow(true)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!show) return null
  return (
    <div className="getapp">
      <a className="club-nudge press" href="/get">
        <span className="club-nudge-ic">📱</span>
        <span className="t">
          <b>حمّل تطبيق كوب</b>
          <span>أسرع، ويوصلك تنبيه طلبك حتى لو الجوال مقفول</span>
        </span>
        <span className="club-nudge-go">←</span>
      </a>
      <button
        className="getapp-x"
        aria-label="إخفاء"
        onClick={() => {
          try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
          setShow(false)
        }}>×</button>
    </div>
  )
}
