/* Per-device preferences for the customer app — language and sound.
 *
 * These belong to the BROWSER, not the account: the same person may want
 * Arabic on their phone and English on the shop's tablet, and someone who
 * muted the app on a quiet morning should not have it shout again after a
 * refresh. So they live in localStorage rather than on the customer row.
 *
 * Every access is wrapped: localStorage THROWS (not returns null) in a few
 * real situations — Safari private browsing historically, "block all cookies"
 * in Chrome, and any embedding context that denies storage. An unguarded read
 * at module scope would take the whole app down for those visitors.
 *
 * One key holding one JSON object, versioned, so adding a preference later
 * does not mean a new key and a new migration.
 */
export type KoupLang = 'ar' | 'en' | 'he'

export type KoupPrefs = {
  lang?: KoupLang
  sound?: boolean
  /** The opening animation has been watched. It is a welcome, not a loader. */
  seenIntro?: boolean
}

const KEY = 'koup.prefs.v1'
const LANGS: readonly KoupLang[] = ['ar', 'en', 'he']

export function readPrefs(): KoupPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const { lang, sound, seenIntro } = parsed as KoupPrefs
    // Validate rather than trust: a stale build, a hand-edited value or a
    // future key must not put an unknown language into the UI.
    return {
      lang: LANGS.includes(lang as KoupLang) ? (lang as KoupLang) : undefined,
      sound: typeof sound === 'boolean' ? sound : undefined,
      seenIntro: seenIntro === true ? true : undefined,
    }
  } catch {
    return {}
  }
}

/** Merge a patch into the stored preferences. Never throws. */
export function writePrefs(patch: KoupPrefs): void {
  if (typeof window === 'undefined') return
  try {
    const next = { ...readPrefs(), ...patch }
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage denied or full — the app still works, it just forgets */
  }
}
