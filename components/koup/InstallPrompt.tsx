'use client'
/* ==========================================================================
   "Add كوب to your phone"

   Most people do not know what a PWA is and should never have to. On Android
   this is one tap — Chrome hands us the install prompt and we fire it. On iOS
   Apple gives no such API, so the honest thing is a short illustrated
   how-to rather than a button that pretends to work.

   There is no dismiss. The whole point of the loyalty app is that it lives on
   the home screen — a banner you can wave away once is a banner nobody ever
   acts on. It disappears on exactly one condition: the app is installed.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { SFX } from '@/lib/sfx'

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS predates the standard and uses its own flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export default function InstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(true)   // assume yes until we know
  const [howTo, setHowTo] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())

    /* Android/Chrome hands us the real prompt. When it does the button becomes
       one tap; until then the same row offers the how-to, so the invitation is
       there from the first frame instead of waiting on an event that may never
       fire (iOS, Firefox, an in-app browser). */
    const stash = () => (window as unknown as { __koupBIP?: InstallEvent }).__koupBIP
    if (stash()) setEvt(stash() as InstallEvent)      // it fired before hydration

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallEvent)
    }
    const onStashed = () => { const e = stash(); if (e) setEvt(e) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('koup:installable', onStashed)
    window.addEventListener('appinstalled', onInstalled)

    /* Installed in another tab, or launched from the home screen mid-session:
       both change display-mode, and neither fires `appinstalled` here. */
    const mq = window.matchMedia('(display-mode: standalone)')
    const onMode = (e: MediaQueryListEvent) => setInstalled(e.matches)
    mq.addEventListener('change', onMode)

    /* getInstalledRelatedApps() only reports apps declared in the manifest's
       `related_applications` — it does NOT tell you about the PWA the page
       itself installs, so it is no use here. What it costs us is real: with no
       way to see the install, a browser that has one silently stops firing
       `beforeinstallprompt`, and the row falls back to explaining a manual process
       to someone who already did it.

       So the rule is by capability, not by guesswork. Chromium hands us a
       prompt, and if it does not, this device either already has the app or
       cannot install it — a how-to helps in neither case. iOS is the one place
       where instructions ARE the install, because Apple ships no API at all. */

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('koup:installable', onStashed)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener('change', onMode)
    }
  }, [])

  if (installed) return null
  // No prompt, and not iOS: nothing here can install anything. Either this
  // device already has كوب or the browser has no install at all — a row of
  // Safari instructions on an Android phone is worse than no row.
  if (!evt && !isIOS()) return null

  async function install() {
    SFX.tap()
    if (!evt) { setHowTo(true); return }   // iOS only — see the guard above
    /* The saved event is single-use: burn it here so a second tap cannot throw
       on an already-consumed prompt. Chrome re-fires a fresh one on a later
       visit, and the listeners above pick that up. */
    delete (window as unknown as { __koupBIP?: InstallEvent }).__koupBIP
    await evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setEvt(null)
  }

  return (
    <div className="install">
      <div className="install-ic" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="2.5" width="12" height="19" rx="3" />
          <path d="M12 7.5v7M9 11.5l3 3 3-3" />
        </svg>
      </div>
      <div className="install-t">
        <b>حطّ كوب على شاشتك</b>
        <span>بيفتح زي أي تطبيق، وبيشتغل حتى بدون نت.</span>
      </div>
      <button className="install-go press" onClick={() => void install()}>
        {evt ? 'ثبّت' : 'كيف؟'}
      </button>

      {howTo && (
        <div className="install-how">
          <ol>
            <li>اضغط على زر <b>المشاركة</b> تحت بالمتصفح <span aria-hidden>􀈂</span></li>
            <li>انزل لتحت واختار <b>«إضافة إلى الشاشة الرئيسية»</b></li>
            <li>اضغط <b>إضافة</b> — وبيصير عندك أيقونة كوب</li>
          </ol>
          <button className="install-close" onClick={() => setHowTo(false)}>تمام</button>
        </div>
      )}
    </div>
  )
}
