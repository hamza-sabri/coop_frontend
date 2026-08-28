'use client'
/* ==========================================================================
   كوب — the customer app.

   This is a mobile PWA and nothing else: it takes the whole viewport, there is
   no admin chrome and no device frame. On a desktop it just centres itself at
   phone width, because that is the only shape it was designed for.

   Menu data still comes from lib/menu.ts, which mirrors what `seed_koup` puts
   in Postgres. Swapping it for the API is the next step — see TODO(api).
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KoupAuth } from '@/components/koup/auth'
import { gsap } from 'gsap'
import { Cup } from '@/lib/cup'
import { SFX, haptic } from '@/lib/sfx'
import { readPrefs, writePrefs } from '@/lib/koup-prefs'
import { usePullToRefresh } from '@/lib/use-pull-to-refresh'
import { lowPower } from '@/lib/device'
import { CATS as FALLBACK_CATS, TAGS, T, type Item } from '@/lib/menu'
import { useKoupMenu } from '@/lib/koup-menu'

type Lang = 'ar' | 'en' | 'he'
type Screen = 'home' | 'menu' | 'cart' | 'track' | 'wallet' | 'rewards'

const FILL = 0.76
const START_BEANS = 248

/* ── tiny helpers ────────────────────────────────────────────────────────── */
const nm = (o: any, l: Lang) => o[l] ?? o.en
const dsc = (o: any, l: Lang) => o['d' + l] ?? o.den

function useT(lang: Lang) {
  return useCallback(
    (key: string, fallbackAr: string) => (lang === 'ar' ? fallbackAr : T[lang]?.[key] ?? fallbackAr),
    [lang],
  )
}

const Bean = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
    <ellipse cx="12" cy="12" rx="7.4" ry="9.6" transform="rotate(28 12 12)" fill="currentColor" />
    <path d="M8.2 5.4c2.4 3.4 2.6 9.4 .5 13.3" stroke="rgba(255,255,255,.55)" strokeWidth="1.7"
      fill="none" strokeLinecap="round" />
  </svg>
)

const Icon = ({ d, s = 21, fill = 'none' }: { d: string; s?: number; fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const P = {
  home: 'M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.2v-5.6H9.2v5.6H6A1.5 1.5 0 0 1 4.5 19v-8.5Z',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  bag: 'M5 7.5h14l-1 12.5H6L5 7.5Z M9 9.5V6.2a3 3 0 0 1 6 0v3.3',
  gift: 'M4 11h16v9H4z M3 7.5h18V11H3zM12 7.5V20',
  cup: 'M5.5 6h13l-1.3 12.4A2 2 0 0 1 15.2 20H8.8a2 2 0 0 1-2-1.6L5.5 6Z M4.4 6h15.2',
  plus: 'M12 6v12M6 12h12',
  clock: 'M12 7.4V12l3 1.8',
  bike: 'M8.6 17h5.2l2.6-8H14M11 9h4.5',
  store: 'M4 9.5V20h16V9.5 M3 9.5 5 4h14l2 5.5',
  table: 'M3 8.5h18M6.5 8.5 5 20M17.5 8.5 19 20M12 8.5V14M4 5.5h16',
  target: 'M12 3.7a8.3 8.3 0 1 0 0 16.6 8.3 8.3 0 0 0 0-16.6Zm0 3.9a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Z',
  qr: 'M4 8.5V4h4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5',
  phone: 'M6.4 3.5h3l1.6 4-2 1.3a11 11 0 0 0 5.4 5.4l1.3-2 4 1.6v3a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.4 5.7a2 2 0 0 1 2-2.2Z',
  check: 'm5 12.5 4.6 4.6L19 7.5',
  flame: 'M12.8 2.4c.4 3 2 4 3.6 5.9 1.6 1.9 2.6 3.7 2.6 6.1A7 7 0 0 1 5 14.4c0-2.5 1.2-4 2.4-5.6.3 1 .9 1.8 1.8 2.2.4-3.6 1.9-6.6 3.6-8.6Z',
}

/* A product card where the picture IS the card: art to the corners, the name
   on a frosted banner over it, and the object floating above the surface so it
   reads as a thing on a stage rather than a thumbnail in a box. */
const FOOD = new Set(['breakfast', 'dessert'])
const EMOJI: Record<string, string> = {
  coffee: '☕', smoothie: '🥤', protein: '💪', breakfast: '🥐', dessert: '🍰',
}

function CupArt({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 120 118" className="pcard-obj" aria-hidden>
      <ellipse cx="60" cy="104" rx="29" ry="6.5" fill="rgba(0,0,0,.45)" />
      <path d="M33 33h54l-7 62a6 6 0 0 1-6 5.4H46a6 6 0 0 1-6-5.4L33 33Z" fill="#1F2C5E" />
      <path d="M37 37c1.5 22 3 44 4 60" stroke="rgba(255,255,255,.16)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="34" rx="26.5" ry="7.6" fill={c} />
      <ellipse cx="60" cy="32" rx="26.5" ry="7.6" fill="rgba(255,255,255,.20)" />
      <ellipse cx="60" cy="33" rx="29" ry="8.4" fill="none" stroke="#F1E9DC" strokeWidth="4.6" />
    </svg>
  )
}
function PlateArt({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 120 118" className="pcard-obj" aria-hidden>
      <ellipse cx="60" cy="99" rx="34" ry="7.5" fill="rgba(0,0,0,.45)" />
      <ellipse cx="60" cy="88" rx="36" ry="11" fill="#1F2C5E" />
      <ellipse cx="60" cy="85" rx="36" ry="11" fill="#2A3A72" />
      <rect x="34" y="52" width="52" height="34" rx="11" fill={c} />
      <rect x="34" y="49" width="52" height="34" rx="11" fill="rgba(255,255,255,.16)" />
      <rect x="40" y="43" width="40" height="26" rx="9" fill={c} />
      <ellipse cx="60" cy="43" rx="20" ry="6" fill="rgba(255,255,255,.22)" />
    </svg>
  )
}

function ProductCard({ m, i, lang, onOpen }:
  { m: Item; i: number; lang: Lang; onOpen: () => void }) {
  const img = (m as any).image as string | undefined
  return (
    <article className="pcard" onClick={onOpen} data-img={img ? '1' : '0'}
      style={{ ['--c' as any]: m.g[1], ['--c0' as any]: m.g[0], ['--i' as any]: i,
               ...(img ? { ['--img' as any]: `url(${img})` } : {}) }}>
      <div className="pcard-bg" />
      <div className="pcard-glow" />
      {/* A specular sweep tied to scroll position: the card catches the light
          at a different angle as it travels up the screen, which is what makes
          a flat rectangle read as a physical thing you could pick up. */}
      <div className="pcard-gloss" />
      {/* The drawn cup is a STAND-IN for a photo, not decoration to put on top
          of one. It was invented when the menu had no pictures; now that the
          real shots are in, it only appears for items that still lack one. */}
      {!img && (FOOD.has(m.c) ? <PlateArt c={m.g[1]} /> : <CupArt c={m.g[1]} />)}
      <span className="pcard-emoji">{EMOJI[m.c] ?? '☕'}</span>
      <div className="pcard-tags">
        {m.t.map(tag => TAGS[tag] && (
          <span key={tag} className={`tg ${tag}`}>{TAGS[tag][lang] ?? TAGS[tag].en}</span>
        ))}
      </div>
      <div className="pcard-banner">
        <h4>{nm(m, lang)}</h4>
        <p>{dsc(m, lang)}</p>
        <div className="pcard-price">
          <span className="ils">₪{m.p}</span><i className="divdot" />
          <span className="beanp"><Bean />{m.b}</span>
        </div>
      </div>
    </article>
  )
}

/* ── the app ─────────────────────────────────────────────────────────────── */
export default function KoupApp({ auth }: { auth: KoupAuth }) {
  /* Arabic is the default for a shop in Qalqilya, and it is also what the
     server renders. The stored choice is applied on mount instead of in the
     initial state so the server HTML and the first client render agree —
     reading localStorage during render is the classic hydration mismatch. */
  const [lang, setLangState] = useState<Lang>('ar')
  useEffect(() => {
    const saved = readPrefs().lang
    if (saved) setLangState(saved)
  }, [])
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    writePrefs({ lang: next })
  }, [])
  const [screen, setScreen] = useState<Screen>('home')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState<'grid' | 'carpet'>('grid')
  const [sheetItem, setSheetItem] = useState<Item | null>(null)
  const [qty, setQty] = useState(1)
  /* Which option of this drink is being ordered. Reset every time the sheet
     opens, or the last drink's flavour follows the next one in. */
  const [pickedVariant, setPickedVariant] =
    useState<{ id: number; label: string; price: number } | null>(null)
  const [beansSpent, setBeansSpent] = useState(0)
  const [orderType, setOrderType] = useState<'pickup' | 'dinein' | 'delivery'>('pickup')
  /* The icon must show what SFX actually is, not a fresh `true`: the mute
     flag is restored from localStorage inside lib/sfx, so on a reload the
     button would otherwise draw 🔊 over a silenced app. Synced on mount for
     the same hydration reason as the language above. */
  const [sound, setSound] = useState(true)
  useEffect(() => { setSound(SFX.enabled()) }, [])
  const [splashUp, setSplashUp] = useState(true)
  const [topBar, setTopBar] = useState(false)
  // The gate waits for the opening to finish. Blurring the app while the cup
  // is still pouring hides the very thing that earns the sign-up.
  const [introDone, setIntroDone] = useState(false)
  // Flipped by placing an order — the moment a phone number is worth asking for.
  const [ordered, setOrdered] = useState(false)
  /* How many drinks are in the cart, and a counter that only exists to replay
     the jump. Bumping a key is the cheapest way to restart a CSS animation —
     toggling a class means clearing it again a frame later and racing yourself
     when someone taps twice quickly. */
  /* The menu is the shop's, not the bundle's. Falls back to the built-in list
     until the server answers, so an offline first launch still has something
     to show. */
  const { items: MENU, cats: LIVE_CATS, live: menuLive } = useKoupMenu()
  const CATS = menuLive
    ? [{ k: 'all', ar: 'الكل', en: 'All', he: 'הכל' }, ...LIVE_CATS]
    : FALLBACK_CATS
  const [cartCount, setCartCount] = useState(0)
  const [cartBump, setCartBump] = useState(0)
  // Everything here works offline except placing an order — the menu, the
  // points, the profile all come from cache. Ordering needs the shop.
  const [online, setOnline] = useState(true)

  const balRef = useRef<HTMLSpanElement>(null)
  const topBalRef = useRef<HTMLSpanElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gapRef = useRef<HTMLElement | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const walletHeroRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const beansRef = useRef(START_BEANS)
  const gapValRef = useRef(12)
  // The opening may only tear itself down once, whichever clock gets there first.
  const introRef = useRef(false)

  const t = useT(lang)
  const rtl = lang !== 'en'

  /* No app without an account. The screens still render underneath — blurred
     and inert — so the first thing someone sees is the shop, not a form.
     Auth arrives as a prop so this component never depends on Clerk being
     configured: with no keys the app simply runs open, which is what keeps
     local development working before the keys land. */
  const { locked: authLocked, user, Gate, openProfile, Account, Phone, Install, me, refreshMe } = auth

  /* The real numbers. `me` is null while signed out, and briefly on a cold
     first launch before the cache or the network answers — so every read
     falls back to 0 rather than to a flattering invention. START_BEANS
     survives only as the number the DRAWN cup fills to in the signed-out
     teaser, where it is decoration, not a claim about anyone. */
  const beans = me?.beans ?? 0
  const toNext = me?.to_next_reward ?? 0
  const streakWeeks = me?.streak_weeks ?? 0
  const cupsThisYear = me?.cups_this_year ?? 0
  const freeCups = me?.free_cups ?? 0

  /* Decided once on mount — matchMedia and hardwareConcurrency are stable for
     the life of the page, and re-reading them per render would only add work
     to the thing we are trying to make cheaper. */
  const [lite, setLite] = useState(false)
  useEffect(() => { setLite(lowPower()) }, [])

  /* Pull down to refresh. The customer has just been to the counter and wants
     to watch the number move; making them kill the app to see it is the kind
     of small betrayal that gets a loyalty app deleted. */
  const doRefresh = useCallback(async () => {
    haptic([8])
    await refreshMe?.()
  }, [refreshMe])
  const { pull, busy: refreshing, ready: pullReady } =
    usePullToRefresh(scrollRef, doRefresh, !authLocked)

  const locked = authLocked && introDone
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* The moving highlight. Each card's sheen is angled by where the card sits
     in the viewport, so scrolling sweeps the light across the grid. Driven
     from JS, not `animation-timeline: view()`, because Safari has none and
     this is an iPhone-first app — the effect would not exist for most
     customers. Called from the scroll handlers below, not from a listener
     bound in an effect: scroll events do not propagate out of these
     containers, so the listener version painted once and then sat frozen. */
  const glossRaf = useRef(0)
  function paintGloss(now = false) {
    if (reduced) return
    /* The first paint is synchronous. requestAnimationFrame does not run in a
       background tab, so scheduling it there left every card at the flat CSS
       default until the tab was touched — cards that were already on screen
       when you came back had no highlight at all. */
    if (now) { glossPaint(); return }
    if (glossRaf.current) return
    glossRaf.current = requestAnimationFrame(() => { glossRaf.current = 0; glossPaint() })
  }
  /* Where the browser can drive the sheen from a view() timeline it does, on
     the compositor, and this never runs. See koup.css. */
  const CSS_GLOSS = typeof CSS !== 'undefined'
    && CSS.supports?.('animation-timeline: view()')

  function glossPaint() {
    if (CSS_GLOSS) return
    const root = rootRef.current
    if (!root) return
    const cards = root.querySelectorAll<HTMLElement>('.pcard')
    /* READ everything first, THEN write. Interleaving them — measure a card,
       style it, measure the next — invalidates layout on every write and
       forces the browser to recompute it on the very next read, once per
       card, per frame. Splitting the phases is the whole fix. */
    const n = cards.length
    const sheens: (HTMLElement | null)[] = new Array(n)
    const pos: number[] = new Array(n)
    const vh = window.innerHeight, vw = window.innerWidth
    for (let i = 0; i < n; i++) {
      const card = cards[i]
      const r = card.getBoundingClientRect()
      const carpet = !!card.closest('.pcarpet')
      const span = carpet ? vw : vh
      const centre = carpet ? r.left + r.width / 2 : r.top + r.height / 2
      pos[i] = Math.max(0, Math.min(1, centre / Math.max(1, span)))
      sheens[i] = card.querySelector<HTMLElement>('.pcard-gloss')
    }
    for (let i = 0; i < n; i++) {
      const sheen = sheens[i]
      if (sheen) sheen.style.backgroundPosition = `${(132 - 164 * pos[i]).toFixed(1)}% 0`
    }
  }
  useEffect(() => {
    paintGloss(true)
    const onResize = () => paintGloss()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, view, cat])

  /* ── boot: start WebGL, run the opening ─────────────────────────────────── */
  useEffect(() => {
    const started = Cup.start()
    const mount = () => Cup.mountTo(screen === 'wallet' ? walletHeroRef.current : heroRef.current)
    const onResize = () => Cup.resize()
    window.addEventListener('resize', onResize)
    /* Not `once`, and in the CAPTURE phase. A single bubbling one-shot
       listener is exactly how audio ended up working "sometimes": any child
       that called stopPropagation ate the one gesture we were given, and
       there was no second chance. This re-arms until the context is really
       running, then takes itself off. */
    const unlock = () => {
      SFX.resume()
      if (SFX.running?.()) {
        for (const ev of ['pointerdown', 'touchend', 'click'] as const)
          window.removeEventListener(ev, unlock, true)
      }
    }
    for (const ev of ['pointerdown', 'touchend', 'click'] as const)
      window.addEventListener(ev, unlock, true)

    /* Nothing may depend on an animation callback firing. The splash is a
       full-screen z-90 cover: if its timeline stalls — a background tab, a
       throttled ticker, a Fast Refresh mid-flight — the whole app including
       the sign-in sits underneath it, invisible. So the teardown runs on
       whichever clock gets there first, and only once. */
    const finish = () => {
      if (introRef.current) return
      introRef.current = true
      setSplashUp(false); setIntroDone(true)
      mount()
      if (readPrefs().seenIntro === true) {
        // Seen the pour before: hand over a full cup and the real balance.
        restState()
      } else {
        writePrefs({ seenIntro: true })
        playIntro()
      }
    }

    /* The opening is a WELCOME, so it only earns its four seconds when there
       is someone to welcome and only the first time.
         · signed out → skip it: the sign-in gate is what this visitor needs,
           and OAuth reloads the page, so the intro still plays on the way
           back in with an account.
         · already seen → skip it: on the second launch a four-second lockout
           in front of your own points is not delight, it is a loading screen. */
    /* The lockup plays every launch — it is three seconds of brand and it is
       the point of opening the app. What must NOT repeat is the POUR: the cup
       filling from empty is a first-run story, and on the fiftieth launch it
       is a wait between you and your balance. So the splash is gated only on
       being signed in; the pour is gated on having seen it (see finish). */
    if (!started || reduced || authLocked) {
      introRef.current = true
      setSplashUp(false); setIntroDone(true); restState(); mount(); return
    }

    /* Big, then a small settle, then it blooms open into the app. The settle is
       what makes the bloom read as deliberate rather than as a zoom. */
    const tl = gsap.timeline({ onComplete: finish })
    tl.add(() => SFX.whoosh(), 0)
      .fromTo('.koup-lockup',
        { scale: 1.34, opacity: 0, filter: 'blur(14px)' },
        { scale: 1.34, opacity: 1, filter: 'blur(0px)', duration: .62, ease: 'power2.out' })
      .to('.koup-rule', { scaleX: 1, duration: .5, ease: 'power3.out' }, '-=0.24')
      .to('.koup-sub', { opacity: 1, duration: .4, ease: 'power2.out' }, '-=0.32')
      .to('.koup-lockup', { scale: .92, duration: .5, ease: 'power3.inOut' }, '-=0.1')
      .add(() => SFX.tick())
      .to('.koup-lockup', { scale: 1.62, opacity: 0, filter: 'blur(10px)',
        duration: .66, ease: 'power2.in' }, '+=0.22')
      .to('.splash', { opacity: 0, duration: .38 }, '-=0.34')

    /* setTimeout keeps running when requestAnimationFrame does not. */
    const floor = window.setTimeout(finish, 4800)

    return () => {
      window.clearTimeout(floor); tl.kill()
      window.removeEventListener('resize', onResize)
      for (const ev of ['pointerdown', 'touchend', 'click'] as const)
        window.removeEventListener(ev, unlock, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* The sheet's open/close is a GSAP timeline, not a CSS class: the ported
     stylesheet only carries `pointer-events` on .on — the scrim opacity and the
     panel transform were always animated. Toggling the class alone left it
     invisible and 101% off-screen, which is why tapping a card did nothing. */
  useEffect(() => {
    if (!sheetItem) return
    if (reduced) {
      gsap.set('.koup .scrim', { opacity: 1 })
      gsap.set('.koup .sheet-body', { y: '0%' })
      return
    }
    const tl = gsap.timeline()
    tl.to('.koup .scrim', { opacity: 1, duration: .28, ease: 'power2.out' })
      .fromTo('.koup .sheet-body', { y: '101%' }, { y: '0%', duration: .52, ease: 'expo.out' }, '<')
      .fromTo('.koup .sheet-body > *', { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: .42, stagger: .038, ease: 'power3.out', clearProps: 'all' }, '-=0.3')
    return () => { tl.kill() }
  }, [sheetItem, reduced])

  function closeSheet() {
    if (reduced) { setSheetItem(null); return }
    gsap.timeline({ onComplete: () => setSheetItem(null) })
      .to('.koup .sheet-body', { y: '101%', duration: .24, ease: 'power3.in' })
      .to('.koup .scrim', { opacity: 0, duration: .2 }, '<')
  }

  /* the cup follows whichever hero is on screen */
  useEffect(() => {
    if (!Cup.ok() || splashUp) return
    const target = screen === 'wallet' ? walletHeroRef.current
      : screen === 'home' ? heroRef.current : null
    /* mountTo(null) used to be a no-op — it returns early on a falsy element —
       so on the menu, cart and rewards screens the canvas stayed attached to
       the last hero and kept rendering behind them. Unmounting explicitly is
       what actually stops the work; the render loop then ends itself on the
       next frame. */
    if (target) Cup.mountTo(target)
    else Cup.unmount()
  }, [screen, splashUp])

  /* The drawn cup fills to the customer's REAL balance. beansRef started at
     the 248 literal, so the cup poured to a stranger's number. */
  useEffect(() => {
    if (!me) return
    beansRef.current = me.beans
    setBalance(me.beans)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.beans])

  function restState() {
    Cup.setFill(FILL); Cup.ringTo(FILL, 0); Cup.steamTo(0.85, 0); Cup.streamTo(0, 0); Cup.beansIn()
    setBalance(beansRef.current)
  }

  /* One number, two places. The hero shows it big; the top bar keeps it on
     screen everywhere else, so the balance is never more than a glance away. */
  function setBalance(v: number) {
    const t = String(Math.round(v))
    if (balRef.current) balRef.current.textContent = t
    if (topBalRef.current) topBalRef.current.textContent = t
  }

  /* On home the big number owns the screen until you scroll past the cup —
     then it hands over to the top bar. Everywhere else the bar is just there. */
  useEffect(() => {
    if (screen !== 'home') { setTopBar(true); return }
    setTopBar(false)
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setTopBar(el.scrollTop > 150)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [screen, splashUp])

  /* The opening. Beats, in seconds:
       0.00 cup rises and settles (no free-fall)   0.70 thud + haptic
       0.95 pour starts                            2.05 stream retracts
       2.16 steam                                  2.20 ring, points, counter, droplet
       3.05 chime
                                                                                  */
  function playIntro() {
    if (!Cup.ok() || reduced) { restState(); return }
    const e = Cup.entryGroup()
    Cup.ringTo(0, 0); Cup.steamTo(0, 0); Cup.streamTo(0, 0); Cup.setFill(0)
    gsap.set(e.scale, { x: .6, y: .6, z: .6 }); gsap.set(e.position, { y: -1.25 })
    const bal = { v: 0 }
    setBalance(0)

    gsap.timeline()
      .add(() => SFX.whoosh(), 0)
      .to(e.scale, { x: 1, y: 1, z: 1, duration: .9, ease: 'expo.out' }, 0)
      .to(e.position, { y: 0, duration: 1.0, ease: 'elastic.out(1, .78)' }, 0)
      .add(() => { SFX.settle(); haptic(16) }, .70)
      .add(() => { Cup.streamTo(1, .18); SFX.pour(1.3); haptic([8, 70, 8]) }, .95)
      .add(() => Cup.fillTo(FILL, 1.18, 'power1.inOut'), 1.0)
      .add(() => Cup.splash(.45), 1.45)
      .add(() => { Cup.streamTo(0, .3); Cup.splash(.95); haptic(12) }, 2.05)
      .add(() => Cup.steamTo(.85, 1.5), 2.16)
      .add(() => Cup.droplet(() => { SFX.drop(); haptic(8) }), 2.20)
      .add(() => { Cup.ringTo(FILL, .9, 'power3.out'); SFX.sweep() }, 2.20)
      .add(() => Cup.beansIn(), 2.30)
      .to(bal, {
        v: beansRef.current, duration: 1.0, ease: 'power2.out',
        onUpdate() { setBalance(bal.v) },
      }, 2.24)
      .add(() => { SFX.chime(); haptic([10, 50, 18]) }, 3.05)

    /* The page is NOT held back for the cup. Chrome, panel, menu, everything
       lands in the first ~400ms and is readable and tappable immediately; only
       the cup card runs the long sequence. Waiting 2.5s to show the app is a
       loading screen wearing an animation's clothes. */
    gsap.fromTo('.hero-top > *', { y: -14, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'power3.out', delay: .05 })
    gsap.fromTo('.panel', { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: .5, ease: 'power3.out', delay: .12 })
    gsap.fromTo('.panel > *', { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: .42, stagger: .035, ease: 'power3.out',
        delay: .18, clearProps: 'transform' })
    /* The balance is the one thing that waits — it is counting up to a number
       the cup has not poured yet, so it arrives with the pour. */
    gsap.fromTo('.hero-bottom > *', { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: .5, stagger: .08, ease: 'power3.out', delay: 1.9 })
  }

  /* points fly from the scan button into the cup */
  function beanBurst(n: number, from?: HTMLElement | null) {
    const root = rootRef.current, cp = Cup.screenPos()
    beansRef.current += n
    gapValRef.current = Math.max(0, gapValRef.current - n)
    if (!root || !cp || reduced) {
      setBalance(beansRef.current)
      Cup.setFill(Math.min(1, Cup.getFill() + .03)); return
    }
    const rb = root.getBoundingClientRect()
    const a = (from ?? root).getBoundingClientRect()
    const x0 = a.left - rb.left + a.width / 2, y0 = a.top - rb.top + a.height / 2
    const x1 = cp.x - rb.left, y1 = cp.y - rb.top
    const vis = Math.min(8, n)
    for (let i = 0; i < vis; i++) {
      const el = document.createElement('div')
      el.className = 'fly'
      el.innerHTML = '<svg viewBox="0 0 24 24" style="color:#DDBC8A;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))"><ellipse cx="12" cy="12" rx="7.4" ry="9.6" transform="rotate(28 12 12)" fill="currentColor"/></svg>'
      root.appendChild(el)
      const cx = (x0 + x1) / 2 + Math.sin(i * 1.9) * 76, cy = Math.min(y0, y1) - 96 - i * 9
      const o = { t: 0 }
      gsap.to(o, {
        t: 1, duration: .56, delay: i * .062, ease: 'power2.inOut',
        onUpdate() {
          const e = o.t, u = 1 - e
          const x = u * u * x0 + 2 * u * e * cx + e * e * x1
          const y = u * u * y0 + 2 * u * e * cy + e * e * y1
          el.style.transform = `translate(${x - 10}px,${y - 10}px) scale(${1 - e * .45}) rotate(${e * 260}deg)`
          el.style.opacity = e > .9 ? String(1 - (e - .9) / .1) : '1'
        },
        onComplete() {
          el.remove(); Cup.pop(); Cup.splash(.5); SFX.point(i)
          Cup.setFill(Math.min(1, Cup.getFill() + (n / vis) * 0.028))
          const b = { v: Number(balRef.current?.textContent ?? 0) }
          gsap.to(b, { v: beansRef.current, duration: .38, onUpdate() { setBalance(b.v) } })
          gsap.fromTo('.koup-topbar .tb-n', { scale: 1 },
            { scale: 1.22, duration: .18, yoyo: true, repeat: 1, ease: 'power2.out' })
          if (gapRef.current) gapRef.current.textContent = String(gapValRef.current)
        },
      })
    }
  }

  /* A new order clears whatever was half-chosen and drops you in the menu.
     Anything else — landing on an old cart, or on the home screen — makes the
     brightest control on the bar the one that does the least. */
  /* The sheet closing was the only sign that anything happened, which reads as
     "did that work?" — so the add now answers in three channels at once: the
     count moves, the tab jumps, and it makes a noise you can feel. */
  useEffect(() => {
    if (!sheetItem) { setPickedVariant(null); return }
    const vs = sheetItem.v ?? []
    setPickedVariant(vs.length === 1 ? vs[0] : null)
  }, [sheetItem])

  function addToCart() {
    setCartCount(n => n + qty)
    setCartBump(b => b + 1)
    setOrdered(true)
    SFX.added()
    haptic([12, 40, 18])
  }

  /* "New order" opens the menu. It used to CLEAR the cart first, which meant
     the brightest control on the bar was also the one that could silently
     throw away what someone had spent five taps choosing. Starting an order
     and abandoning one are different intentions and should not share a
     button — the cart has its own empty control. */
  function newOrder() {
    setSheetItem(null)
    setQty(1)
    go('menu')
  }

  function go(s: Screen) {
    if (s === screen) return
    SFX.tap()
    setScreen(s)
    if (!reduced) {
      requestAnimationFrame(() => {
        gsap.fromTo('.koup-scroll > *, .panel > *', { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: .5, stagger: .04, ease: 'power3.out', clearProps: 'transform' })
      })
    }
  }

  const itemTotal = sheetItem
    ? (pickedVariant?.price ?? sheetItem.p) * qty
    : 0
  const cartSub = 72
  const beanDiscount = Math.round(beansSpent / 3.33)
  const cartTotal = Math.max(0, cartSub - beanDiscount)

  const list = MENU.filter(m => cat === 'all' || m.c === cat)

  return (
    <div className="koup" dir={rtl ? 'rtl' : 'ltr'} data-lang={lang} ref={rootRef}
      /* Lite mode. Everything expensive in this stylesheet — eleven
         backdrop-filters, a blurred glow behind every menu card, three
         infinite per-card animations — is switched off from one attribute
         instead of being sprinkled through the components. On a capable
         phone nothing changes. */
      data-lite={lite ? 'true' : 'false'}
      data-locked={locked ? 'true' : 'false'}>
      <div className="koup-inner">

        {/* Always-on balance. It is the whole point of the app, so it never
            scrolls away — on home it fades in as the hero number leaves. */}
        <header className="koup-topbar" data-show={topBar && !authLocked}>
          <svg viewBox="0 0 64 64" width="22" height="22" fill="none" aria-hidden>
            <path d="M6 30c8-14 18-18 26-12 6 4.5 4 12-2 12-4 0-6-3-4.5-6" stroke="#F7F1E8" strokeWidth="5" strokeLinecap="round"/>
            <path d="M34 30c6 0 10-3 13-8" stroke="#F7F1E8" strokeWidth="5" strokeLinecap="round"/>
            <circle cx="49" cy="19" r="3" fill="#DDBC8A"/>
          </svg>
          <span className="tb-point"><Bean s={15} /></span>
          <span className="tb-n num" ref={topBalRef}>{beans}</span>
          <span className="tb-u">{t('unit.points', 'نقطة')}</span>
        </header>

        {/* language + sound, top corner — dev affordances, not product chrome */}
        <div className="koup-chrome">
          <button className="koup-sfx" aria-pressed={sound}
            onClick={() => { setSound(SFX.toggle()); SFX.tap() }} aria-label="Sound">
            {sound ? '🔊' : '🔇'}
          </button>
          {(['ar', 'en', 'he'] as Lang[]).map(l => (
            <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); SFX.tap() }}>
              {l === 'ar' ? 'ع' : l === 'en' ? 'EN' : 'עב'}
            </button>
          ))}
        </div>

        {/* ── HOME ─────────────────────────────────────────────────────── */}
        {screen === 'home' && (
          <div className="app-scroll hero-mode koup-scroll" ref={scrollRef} onScroll={() => paintGloss()}
            style={pull ? { transform: `translateY(${pull}px)`, transition: refreshing ? 'none' : undefined } : undefined}>
            {pull > 0 && (
              <div className="ptr" data-ready={pullReady ? 'true' : 'false'}
                style={{ height: pull, opacity: Math.min(1, pull / 48) }}>
                <span className={refreshing ? 'ptr-dot spin' : 'ptr-dot'} />
              </div>
            )}
            <div className="hero3d" ref={heroRef}
              onClick={() => { SFX.resume(); Cup.pop(); Cup.splash(.7) }}>
              <div className="topfade" />
              <div className="hero-ui">
                <div className="hero-top">
                  <div className="greet">
                    <div>
                      <h2>{user?.firstName
                        ? `${t('home.hiPrefix', 'صباح الخير،')} ${user.firstName} ☕`
                        : t('home.hiAnon', 'أهلاً فيك بكوب ☕')}</h2>
                      <p>{authLocked
                        ? t('home.subAnon', 'سجّل دخولك وابدأ تجمع نقاطك')
                        : t('home.sub', 'مكانك التاني جاهز لك')}</p>
                    </div>
                    {Account ? (
                      <div className="avatar avatar-slot">
                        <Account />
                      </div>
                    ) : (
                      <button className="avatar press" aria-label={t('home.account', 'حسابي')}
                        onClick={() => { SFX.tap(); openProfile?.() }}>
                        {user?.imageUrl
                          ? <img src={user.imageUrl} alt="" width={44} height={44}
                              style={{ borderRadius: '50%', display: 'block' }} />
                          : t('home.initial', 'ح')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="hero-bottom">
                  {authLocked ? (
                    /* Signed out: showing someone else's 248 is a lie dressed
                       as a teaser. Say what the number is FOR instead. */
                    <p className="tonext tonext-anon">
                      {t('home.anonPitch', 'كل كوب بيجيبلك نقاط — والنقاط بتشتري كوب.')}
                    </p>
                  ) : (
                  <div className="balance">
                    <span className="n num" ref={balRef}>{beans}</span>
                    <span className="u">{t('unit.points', 'نقطة')}</span>
                  </div>
                  )}
                  {!authLocked && (
                    <p className="tonext">
                      {rtl ? 'باقي ' : ''}<b className="num" ref={gapRef as any}>{toNext}</b>
                      {t('home.tonextTail', ' نقطة وكوب علينا 🎉')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="panel" ref={panelRef}>
              {Install ? <Install /> : null}
              <div className="cupcta">
                <button className="btn-gold press"
                  onClick={e => { SFX.resume(); beanBurst(9, e.currentTarget) }}>
                  {t('home.scan', 'امسح عند الكاشير')}
                </button>
                <button className="btn-ghost press" onClick={() => go('wallet')}>
                  {t('home.wallet', 'نقاطي')}
                </button>
              </div>

              {!authLocked && (
              <div className="strip">
                <div className="stat"><div className="v">
                  <svg width="15" height="15" className="flame" viewBox="0 0 24 24" fill="currentColor"><path d={P.flame} /></svg>
                  <span className="num">{streakWeeks}</span></div>
                  <div className="k">{t('stat.streak', 'أسابيع متتالية')}</div></div>
                <div className="stat"><div className="v num">{cupsThisYear}</div>
                  <div className="k">{t('stat.cups', 'كوب هالسنة')}</div></div>
                <div className="stat"><div className="v num">{freeCups}</div>
                  <div className="k">{t('stat.free', 'كاسات مجانية')}</div></div>
              </div>
              )}

              <div className="sechead"><h3>{t('home.live', 'طلبك الحالي')}</h3></div>
              <div className="livecard press" onClick={() => go('track')}>
                <div className="pulse"><Icon d={P.cup} s={19} /></div>
                <div className="t">
                  <b>{t('home.liveT', 'آيس لاتيه كراميل + فرنش توست')}</b>
                  <span>{t('home.liveS', 'قيد التحضير · طلب #١٠٤٢')}</span>
                </div>
                <span className="eta">{t('home.eta', '٣ دقائق')}</span>
              </div>

              <div className="sechead">
                <h3>{t('home.forYou', 'مختارة لك')}</h3>
                <a onClick={() => go('menu')}>{t('common.all', 'المنيو كامل')}</a>
              </div>
              <div className="pcarpet">
                {MENU.slice(0, 6).map((m, i) => (
                  <ProductCard key={m.en} m={m} i={i} lang={lang}
                    onOpen={() => { SFX.tap(); setSheetItem(m) }} />
                ))}
              </div>

              <div className="sechead"><h3>{t('home.challenges', 'تحدّيات هالأسبوع')}</h3></div>
              <div className="chal">
                <div className="chal-top">
                  <div className="chal-ic"><Icon d={P.target} s={19} /></div>
                  <div className="t"><b>{t('ch1.t', '٣ زيارات هالأسبوع')}</b>
                    <span>{t('ch1.s', 'زيارتين من ٣')}</span></div>
                  <span className="reward">{t('ch1.r', '+٢٠')}</span>
                </div>
                <div className="mini"><i style={{ width: '66%' }} /></div>
                <div className="chal-foot"><span>{t('ch1.a', '٢ / ٣')}</span>
                  <span className="urgent">{t('ch1.b', 'باقي يومين')}</span></div>
              </div>
              <div className="chal">
                <div className="chal-top">
                  <div className="chal-ic"><Icon d={P.cup} s={19} /></div>
                  <div className="t"><b>{t('ch2.t', 'جرّب مشروب جديد')}</b>
                    <span>{t('ch2.s', 'أي صنف ما طلبته قبل')}</span></div>
                  <span className="reward">{t('ch2.r', '+١٥')}</span>
                </div>
                <div className="mini"><i style={{ width: '0%' }} /></div>
                <div className="chal-foot"><span>{t('ch2.a', '٠ / ١')}</span>
                  <span>{t('ch2.b', 'باقي ٥ أيام')}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── MENU ─────────────────────────────────────────────────────── */}
        {screen === 'menu' && (
          <div className="app-scroll koup-scroll" onScroll={() => paintGloss()}>
            <div className="greet"><div>
              <h2>{t('menu.h', 'المنيو')}</h2>
              <p>{t('menu.sub', 'كل صنف بسعرين: شيكل أو نقاط')}</p>
            </div></div>
            <div className="searchbar">
              <Icon d="M11 4.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8Zm9 15.4-4.4-4.4" s={17} />
              <span>{t('menu.search', 'دوّر على مشروب أو صنف…')}</span>
            </div>
            <div className="cats">
              {CATS.map(c => (
                <button key={c.k} className="cat press" aria-pressed={cat === c.k}
                  onClick={() => { SFX.tap(); setCat(c.k) }}>{nm(c, lang)}</button>
              ))}
            </div>
            <div className="sechead" style={{ marginTop: 4 }}>
              <h3>{list.length} {t('menu.count', 'صنف')}</h3>
              <div className="viewtoggle">
                <button aria-pressed={view === 'grid'} aria-label="grid"
                  onClick={() => { SFX.tap(); setView('grid') }}>
                  <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" s={15} />
                </button>
                <button aria-pressed={view === 'carpet'} aria-label="carousel"
                  onClick={() => { SFX.tap(); setView('carpet') }}>
                  <Icon d="M8 5h8v14H8zM3.5 8v8M20.5 8v8" s={15} />
                </button>
              </div>
            </div>
            <div className={view === 'grid' ? 'pgrid' : 'pcarpet'}
              onScroll={() => paintGloss()}>
              {list.map((m, i) => (
                <ProductCard key={m.en} m={m} i={i} lang={lang}
                  onOpen={() => { SFX.tap(); setSheetItem(m) }} />
              ))}
            </div>
          </div>
        )}

        {/* ── CART ─────────────────────────────────────────────────────── */}
        {screen === 'cart' && (
          <div className="app-scroll koup-scroll" onScroll={() => paintGloss()}>
            <div className="greet"><div>
              <h2>{t('cart.h', 'سلّتك')}</h2>
              <p>{t('cart.sub', '٣ أصناف · كوب — شارع ٢٢')}</p>
            </div></div>
            <div className="otypes">
              {([['pickup', P.store, 'استلام'], ['dinein', P.table, 'على الطاولة'], ['delivery', P.bike, 'توصيل']] as const)
                .map(([k, d, ar]) => (
                  <button key={k} className="otype" aria-pressed={orderType === k}
                    onClick={() => { SFX.tap(); setOrderType(k) }}>
                    <Icon d={d} s={21} /><span>{t(`cart.${k}`, ar)}</span>
                  </button>
                ))}
            </div>

            {[['آيس لاتيه كراميل', 'كبير · حليب لوز · شوت إضافي', 22],
              ['فرنش توست بالقرفة', 'مع آيس كريم', 28],
              ['مشروب الجوافة', 'بدون سكر مضاف', 22]].map(([n, m, p], i) => (
              <div className="line" key={i}>
                <span className="qbadge num">1</span>
                <div className="t"><h4>{t(`ci${i + 1}.n`, n as string)}</h4><p>{t(`ci${i + 1}.m`, m as string)}</p></div>
                <span className="p num">₪{p}</span>
              </div>
            ))}

            <div className="beanpay">
              <div className="beanpay-h">
                <b><Bean s={17} />{t('cart.pay', 'ادفع بنقاطك')}</b>
                <span className="avail">{t('cart.avail', 'عندك')} <span className="num">{beansRef.current}</span></span>
              </div>
              <input className="slider" type="range" min={0} max={240} step={10} value={beansSpent}
                style={{ ['--fill' as any]: `${(beansSpent / 240) * 100}%` }}
                onChange={e => setBeansSpent(Number(e.target.value))} aria-label="points" />
              <div className="beanpay-f">
                <span className="used"><span className="num">{beansSpent}</span></span>
                <span className="save">{t('cart.saved', 'وفّرت')} ₪<span className="num">{beanDiscount}</span></span>
              </div>
            </div>

            <div className="totals">
              <div><span>{t('cart.sub2', 'المجموع')}</span><span className="n">₪{cartSub}</span></div>
              <div><span>{t('cart.disc', 'خصم النقاط')}</span>
                <span className="n" style={{ color: 'var(--app-gold)' }}>−₪{beanDiscount}</span></div>
              <div><span>{t('cart.fee', 'رسوم')}</span><span className="n">₪0</span></div>
              <div className="grand"><span>{t('cart.total', 'الإجمالي')}</span><span>₪{cartTotal}</span></div>
            </div>
            <div className="willearn">
              <Bean s={17} />{t('cart.earn', 'رح تكسب')}&nbsp;
              <b className="num">{Math.round((cartTotal / 5) * 1.25)}</b>&nbsp;
              <span>{t('unit.points2', 'نقطة من هالطلب')}</span>
            </div>
            <div className="sheet-foot" style={{ borderTop: 0, marginTop: 18 }}>
              <button className="cta press" disabled={!online} onClick={() => {
                SFX.chime(); haptic([10, 50, 18]); setOrdered(true); go('track')
              }}>
                <span>{t('cart.confirm', 'أكّد الطلب')}</span> · <span className="price">₪{cartTotal}</span>
              </button>
            </div>
            <p style={{ fontSize: 11.5, textAlign: 'center', marginTop: 10,
              color: online ? 'var(--app-ink3)' : 'var(--app-rust)' }}>
              {online
                ? t('cart.cash', 'الدفع كاش عند الاستلام · النقاط بتزيد فوراً')
                : t('cart.offline', 'ما في نت — تقدر تتصفّح، بس الطلب بدّه اتصال.')}
            </p>
          </div>
        )}

        {/* ── TRACK ────────────────────────────────────────────────────── */}
        {screen === 'track' && (
          <div className="app-scroll koup-scroll" onScroll={() => paintGloss()}>
            <div className="greet"><div>
              <h2>{t('tr.h', 'طلب #١٠٤٢')}</h2><p>{t('tr.sub', 'توصيل · شارع ٢٢، قلقيلية')}</p>
            </div></div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(127,209,174,.1)',
              border: '1px solid rgba(127,209,174,.26)', borderRadius: 16, padding: '13px 15px', marginBottom: 22,
            }}>
              <span style={{ color: 'var(--app-mint)' }}><Icon d={P.clock} s={19} /></span>
              <b style={{ fontSize: 14, color: 'var(--app-mint)' }}>{t('tr.eta', 'جاهز خلال ٣ دقائق تقريباً')}</b>
            </div>
            <div className="steps">
              <div className="fillline" style={{ height: 132 }} />
              {([['done', 'tr.s1', 'تم استلام الطلب', '9:38'],
                 ['done', 'tr.s2', 'الباريستا بدأ يحضّرلك', '9:40'],
                 ['active', 'tr.s3', 'في الطريق إلك', 'محمود طلع من المحل'],
                 ['pending', 'tr.s4', 'تم التسليم', '—']] as const).map(([st, k, ar, sub], i) => (
                <div className={`step ${st}`} key={k}>
                  <div className="node">
                    {st === 'active' ? <Icon d={P.bike} s={16} /> : <Icon d={P.check} s={15} />}
                  </div>
                  <h4>{t(k, ar)}</h4><p>{t(`${k}t`, sub)}</p>
                </div>
              ))}
            </div>
            <div className="sechead"><h3>{t('tr.driver', 'السائق')}</h3></div>
            <div className="drivercard">
              <div className="dphoto">م</div>
              <div className="t">
                <b>{t('dr.name', 'محمود أبو زيد')}</b>
                <div className="stars"><span className="s">★★★★★</span>
                  <span className="num">4.9</span> · <span className="num">312</span> {t('dr.deliv', 'توصيلة')}</div>
              </div>
              <button className="callbtn press" aria-label="call"><Icon d={P.phone} s={18} /></button>
            </div>
            <div className="willearn" style={{ marginTop: 22 }}>
              <Bean s={17} />{t('tr.pending', '١٨ نقطة محجوزة لك — بتنزل بالكوب لما يوصل الطلب')}
            </div>
          </div>
        )}

        {/* ── WALLET ───────────────────────────────────────────────────── */}
        {screen === 'wallet' && (
          <div className="app-scroll hero-mode koup-scroll" ref={scrollRef} onScroll={() => paintGloss()}>
            <div className="hero3d wallet3d" ref={walletHeroRef}>
              <div className="topfade" />
              <div className="hero-ui">
                <div className="hero-top"><div className="greet"><div>
                  <h2>{t('w.h', 'نقاطي')}</h2><p>{t('w.sub', 'عملة وحدة — ولا عملية حساب')}</p>
                </div></div></div>
                <div className="hero-bottom">
                  <div className="balance">
                    <span className="n num">{beansRef.current}</span>
                    <span className="u">{t('unit.points', 'نقطة')}</span>
                  </div>
                  <p className="tonext">{t('w.worth', 'تساوي تقريباً ₪٧٥ من المنيو')}</p>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="cupcta">
                <button className="btn-gold press">{t('w.redeem', 'اصرف نقاطك')}</button>
                <button className="btn-ghost press" onClick={() => { SFX.tap(); go('home') }}>
                  {t('w.qr', 'كودي')}
                </button>
              </div>
              <div className="sechead"><h3>{t('w.can', 'بتقدر تاخد هلق')}</h3></div>
              <div className="redeemgrid">
                {MENU.slice(0, 4).map((m, i) => (
                  <div key={m.en} className={`rd press ${m.b <= beansRef.current ? 'can' : 'cant'}`}>
                    <div className="rdart" style={{ ['--c' as any]: m.g[1], ['--c0' as any]: m.g[0],
                      ['--i' as any]: i, position: 'relative', overflow: 'hidden' }}>
                      <div className="pcard-bg" />
                      {FOOD.has(m.c) ? <PlateArt c={m.g[1]} /> : <CupArt c={m.g[1]} />}
                    </div>
                    <h4>{nm(m, lang)}</h4>
                    <div className="c">
                      <span className="beanp"><Bean />{m.b}</span>
                      {m.b <= beansRef.current
                        ? <span style={{ fontSize: 11, color: 'var(--app-mint)' }}>✓</span>
                        : <span className="need">+{m.b - beansRef.current}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="sechead"><h3>{t('w.hist', 'الحركات')}</h3></div>
              <div className="ledger">
                {([['earn', P.plus, 'l1.t', 'طلب #١٠٤٢ · توصيل', 'اليوم ٩:٣٨', '+18', 'pos'],
                   ['spend', P.cup, 'l2.t', 'آيس لاتيه بندق — مجاناً', 'أمس ١٦:٢٠', '−60', 'neg'],
                   ['earn', P.target, 'l3.t', 'تحدّي: ٣ زيارات', '١٨ آب', '+20', 'pos'],
                   ['earn', P.qr, 'l4.t', 'مسح عند الكاشير · كاش', '١٧ آب', '+9', 'pos'],
                   ['exp', P.clock, 'l5.t', '٤٠ نقطة بتنتهي بعد ٣٠ يوم', 'تنبيه', '40', 'exp']] as const)
                  .map(([ic, d, k, ar, when, amt, cls]) => (
                    <div className="led" key={k}>
                      <div className={`ledic ${ic}`}><Icon d={d} s={16} /></div>
                      <div className="t"><b>{t(k, ar)}</b><span>{t(`${k}d`, when)}</span></div>
                      <span className={`d ${cls} num`}>{amt}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* المكافآت, folded into this page. Two tabs for "your
                points" and "what points get you" was one idea split
                across two taps — the ladder and the rewards are the
                reason the balance above matters. */}
            <div className="greet"><div>
              <h2>{t('r.h', 'المكافآت')}</h2><p>{t('r.sub', 'كل ما تزيد زياراتك، بتزيد نقاطك')}</p>
            </div></div>
            <div className="sechead" style={{ marginTop: 4 }}><h3>{t('r.tiers', 'مستواك')}</h3></div>
            <div className="ladder">
              {([['done', 1, 't1.n', 'سنجل', 't1.d', 'نقطة البداية · ١.٠×', '١.٠×'],
                 ['now', 2, 't2.n', 'دوبل — مستواك الحالي', 't2.d', '١٠ زيارات بالشهر · بيضل ٣ شهور', '١.٢٥×'],
                 ['', 3, 't3.n', 'تريبل', 't3.d', '٢٥٠٠ نقطة بالسنة · نقاطك ما بتنتهي أبداً', '١.٥×']] as const)
                .map(([cls, shots, nk, nAr, dk, dAr, mult]) => (
                  <div className={`rung ${cls}`} key={nk}>
                    <div className="shots">
                      {[0, 1, 2].slice(0, shots).map(i => <span className="shot on" key={i} />)}
                    </div>
                    <div className="t"><b>{t(nk, nAr)}</b><span>{t(dk, dAr)}</span></div>
                    <span className="mult">{t(`${nk}x`, mult)}</span>
                  </div>
                ))}
            </div>
            <div className="mini" style={{ marginTop: 12 }}><i style={{ width: '38%' }} /></div>
            <p style={{ fontSize: 11.5, color: 'var(--app-ink3)', marginTop: 7 }}>
              {t('r.next', 'باقي ١٥٥٠ نقطة لتوصل تريبل')}
            </p>

            <div className="sechead"><h3>{t('r.streak', 'سلسلتك')}</h3></div>
            <div className="chal">
              <div className="chal-top">
                <div className="chal-ic" style={{ background: 'rgba(217,124,103,.14)', color: 'var(--app-rust)' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d={P.flame} /></svg>
                </div>
                <div className="t"><b>{t('r.streakT', '٦ أسابيع متتالية')}</b>
                  <span>{t('r.streakS', 'زورنا قبل الأحد وبتصير ٧')}</span></div>
                <span className="reward">{t('r.streakR', '+٢٥')}</span>
              </div>
              <div className="mini"><i style={{ width: '85%' }} /></div>
              <div className="chal-foot"><span>{t('r.saver', 'عندك «منقذ سلسلة» واحد هالشهر')}</span></div>
            </div>

            <div className="sechead"><h3>{t('r.badges', 'شاراتك')}</h3></div>
            <div className="badgewrap">
              {([['🧊', 'b1', '٥ مشروبات باردة', 0], ['🥐', 'b2', 'فطور كوب ×٣', 0],
                 ['⚽', 'b3', 'ليلة ماتش', 0], ['🔒', 'b4', 'بوكس كوب', 1],
                 ['💪', 'b5', 'بروتين شيك', 0], ['🔒', 'b6', '١٠٠ كوب', 1],
                 ['🔒', 'b7', 'فزّورة رمضان', 1], ['🔒', 'b8', 'ادعي ٣ أصحاب', 1]] as const)
                .map(([e, k, ar, locked]) => (
                  <div className={`bdg ${locked ? 'locked' : ''}`} key={k}>{e}
                    <small>{t(k, ar)}</small></div>
                ))}
            </div>

            <div className="sechead" style={{ marginTop: 34 }}><h3>{t('r.ref', 'ادعي صاحبك')}</h3></div>
            <div className="chal">
              <div className="chal-top">
                <div className="chal-ic"><Icon d={P.gift} s={19} /></div>
                <div className="t">
                  <b style={{ fontFamily: 'var(--koup-fs-dis)', letterSpacing: '.06em' }}>HAMZA-KOUP</b>
                  <span>{t('r.refS', 'إنت وهو بتاخدوا ٣٠ نقطة بعد أول طلب إله')}</span>
                </div>
                <span className="reward">{t('r.refR', '+٣٠')}</span>
              </div>
            </div>
          </div>
        )}


        {/* ── item sheet ───────────────────────────────────────────────── */}
        <div className={`sheet ${sheetItem ? 'on' : ''}`}>
          <div className="scrim" onClick={closeSheet} />
          <div className="sheet-body">
            <div className="grab" />
            {sheetItem && (<>
              <h3>{nm(sheetItem, lang)}</h3>
              <p className="sub">{dsc(sheetItem, lang)}</p>
              {/* The options this drink is really sold in. The الحجم / الحليب
                  groups that used to sit here were prototype furniture from
                  before the menu existed — كوب has no sizes at all, and the
                  choice on almost every line is a flavour. */}
              {sheetItem.v && sheetItem.v.length > 0 && (
                <div className="optgrp">
                  <div className="lbl"><span>{t('it.pick', 'اختر النوع')}</span></div>
                  <div className="opts">
                    {sheetItem.v.map(v => {
                      const extra = v.price - sheetItem.p
                      return (
                        <button
                          key={v.id}
                          className="opt"
                          aria-pressed={pickedVariant?.id === v.id}
                          onClick={() => { SFX.tap(); setPickedVariant(v) }}
                        >
                          <span>{v.label}</span>
                          {extra > 0 && <small>+₪{extra}</small>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="sheet-foot">
                <div className="qty">
                  <button onClick={() => { SFX.tap(); setQty(q => Math.max(1, q - 1)) }}>−</button>
                  <span className="n num">{qty}</span>
                  <button onClick={() => { SFX.tap(); setQty(q => Math.min(9, q + 1)) }}>+</button>
                </div>
                {/* Adding is not ordering. Jumping to the cart after every
                    item meant a second drink cost you two extra taps to get
                    back — so it closes and leaves you where the menu is. */}
                <button className="cta press" onClick={() => { closeSheet(); addToCart() }}>
                  <span>{t('it.add', 'أضف للسلة')}</span> · <span className="price">₪{itemTotal}</span>
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--app-gold)', textAlign: 'center', marginTop: 11 }}>
                {t('it.or', 'أو بـ')} <b className="num">{Math.round(itemTotal * 3.33)}</b>
              </p>
            </>)}
          </div>
        </div>

        {/* ── splash ───────────────────────────────────────────────────── */}
        {/* The phone prompt lived inside the HOME panel, and placing an order
            navigates to the tracking screen — so the one moment it exists to
            catch was the one moment it was unmounted. It asks once, only when
            Clerk has no number on file, and remembers a dismissal. */}
        {Phone ? <Phone armed={ordered} /> : null}

        {splashUp && (
          <div className="splash">
            <div className="splash-in">
              <div className="koup-lockup">
                <div className="koup-word">كوب</div>
                <div className="koup-rule" />
                <div className="koup-sub">Coffee House</div>
              </div>
            </div>
          </div>
        )}

        {locked && Gate ? <Gate /> : null}

        {/* ── tab bar ──────────────────────────────────────────────────── */}
        {/* The middle of the bar is the one place a thumb reaches without
            thinking, so it holds the thing the shop wants most — a new order —
            not a cart that is empty the majority of the time. */}
        <nav className="tabs">
          {([['home', P.home, 'nav.home', 'الرئيسية'], ['menu', P.list, 'nav.menu2', 'المنيو']] as const)
            .map(([s, d, k, ar]) => (
              <button key={s} className="tab" aria-current={screen === s} onClick={() => go(s as Screen)}>
                <Icon d={d} />
                <span>{t(k, ar)}</span>
              </button>
            ))}

          <button
            className="tab tab-new press"
            aria-label={t('nav.new', 'طلب جديد')}
            onClick={() => { SFX.tap(); haptic(12); newOrder() }}
          >
            <span className="newring" aria-hidden />
            <span className="newdot">
              <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span>{t('nav.new', 'طلب جديد')}</span>
          </button>

          {([['wallet', '', 'nav.rewards2', 'المكافآت'],
             ['cart', P.bag, 'nav.cart2', 'السلة']] as const).map(([s, d, k, ar]) => (
            <button key={s} className="tab" aria-current={screen === s} onClick={() => go(s as Screen)}>
              <span className="tabic" key={s === 'cart' ? cartBump : undefined}
                data-jump={s === 'cart' && cartBump > 0 ? '1' : undefined}>
                {d ? <Icon d={d} /> : <Bean s={21} />}
                {s === 'cart' && cartCount > 0 && (
                  <span className="tabcount num">{cartCount}</span>
                )}
              </span>
              <span>{t(k, ar)}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
