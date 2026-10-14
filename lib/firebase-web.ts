/* Google sign-in for the customer's web page, through Firebase — the same
 * Firebase project the Flutter app uses, so a customer is ONE account whether
 * they open the web page or the app, and push can reach them later.
 *
 * Every value is a NEXT_PUBLIC_* build arg (public by design: a Firebase web
 * config ships inside the browser bundle). With no API key built in, the web
 * page keeps its old behaviour — see app/(shop)/app/page.tsx.
 */
import type { FirebaseApp } from "firebase/app"
import type { Auth } from "firebase/auth"

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID ?? "",
}

export const FIREBASE_ON = Boolean(config.apiKey && config.projectId)

/** Facebook is offered only once it is switched on in Firebase (Authentication
 *  → Sign-in method → Facebook) and this build arg is set to 1 — a button that
 *  can only fail is worse than no button. */
export const FACEBOOK_ON = FIREBASE_ON && process.env.NEXT_PUBLIC_FACEBOOK_LOGIN === "1"

/** Facebook / Instagram / WhatsApp-style in-app browsers. Google refuses to
 *  sign in inside them ("disallowed_useragent") — the main reason customers
 *  arriving from a shared link could not get in. Facebook works there. */
export function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|; wv\)/i.test(navigator.userAgent)
}

let _auth: Promise<Auth> | null = null

/** The Auth instance, loaded on first use so the SDK never weighs on a page
 *  that does not need it. Persistence is the browser's local storage: an
 *  installed PWA stays signed in across launches. */
export function firebaseAuth(): Promise<Auth> {
  if (!_auth) {
    _auth = (async () => {
      const [{ initializeApp, getApps }, authMod] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
      ])
      const app: FirebaseApp = getApps()[0] ?? initializeApp({
        ...config,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
      })
      const auth = authMod.getAuth(app)
      auth.languageCode = "ar"
      await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {})
      return auth
    })()
  }
  return _auth
}

/** Popup first: the page keeps running and the session simply appears.
 *  Redirect when the browser blocks popups (some in-app browsers do). */
/** `hint`: pre-pick this Google account (used right after Facebook said the
 *  email is already a Google account). `viaRedirect`: no popup — for calls
 *  that do not come straight from a tap, where a popup would be blocked. */
export async function signInWithGoogle(hint?: string, viaRedirect = false): Promise<void> {
  const { GoogleAuthProvider, signInWithRedirect } = await import("firebase/auth")
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters(hint ? { login_hint: hint } : { prompt: "select_account" })
  if (viaRedirect) {
    await signInWithRedirect(await firebaseAuth(), provider)
    return
  }
  await signInWith(provider)
}

/** Facebook refused because this email is already a Google account here:
 *  the email, so we can continue straight into Google. Otherwise null. */
export function googleAccountFor(e: unknown): string | null {
  const err = e as { code?: string; customData?: { email?: string } }
  if (err?.code !== "auth/account-exists-with-different-credential") return null
  return err.customData?.email || ""
}

/* ── Facebook on phones ──────────────────────────────────────────────────
 * Firebase's redirect keeps its "login in progress" note in sessionStorage,
 * which belongs to ONE tab. On a phone the Facebook app usually catches the
 * hop to facebook.com and sends the person back in a NEW tab — the note is
 * gone and Firebase shows "Unable to process request due to missing initial
 * state". So on phones we talk to Facebook directly: our own note goes in
 * localStorage (shared by every tab), Facebook hands the access token back to
 * /app in the URL fragment, and Firebase signs in with that token. */
const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "1062994576218349"
const FB_STATE_KEY = "koup_fb_state"
const isPhone = () =>
  typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || inAppBrowser())

function facebookDirect(): void {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    localStorage.setItem(FB_STATE_KEY, JSON.stringify({ state, at: Date.now() }))
  } catch {
    /* private mode: the state check below will simply not match */
  }
  const q = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: `${window.location.origin}/app`,
    response_type: "token",
    scope: "public_profile,email",
    state,
  })
  window.location.assign(`https://www.facebook.com/v19.0/dialog/oauth?${q}`)
}

/** Back from Facebook (any tab): finish the sign-in. Returns true when it did. */
export async function completeFacebookReturn(): Promise<boolean> {
  if (typeof window === "undefined" || !window.location.hash.includes("access_token")) {
    if (typeof window !== "undefined" && /[#&]error/.test(window.location.hash)) {
      history.replaceState(null, "", window.location.pathname + window.location.search)
    }
    return false
  }
  const p = new URLSearchParams(window.location.hash.slice(1))
  // The token must never stay in the address bar (or in history).
  history.replaceState(null, "", window.location.pathname + window.location.search)
  let saved: { state?: string; at?: number } = {}
  try {
    saved = JSON.parse(localStorage.getItem(FB_STATE_KEY) || "{}")
    localStorage.removeItem(FB_STATE_KEY)
  } catch {
    /* ignore */
  }
  const token = p.get("access_token")
  const fresh = saved.at && Date.now() - saved.at < 15 * 60_000
  if (!token || !saved.state || saved.state !== p.get("state") || !fresh) return false
  const auth = await firebaseAuth()
  const { FacebookAuthProvider, signInWithCredential } = await import("firebase/auth")
  try {
    await signInWithCredential(auth, FacebookAuthProvider.credential(token))
  } catch (e) {
    await rememberFacebookToLink(e, token)
    throw e
  }
  return true
}

/* ── One person, two buttons ────────────────────────────────────────────
 * Someone who first came in with Google and now taps Facebook (same email)
 * is refused by Firebase: one account per email. We keep the Facebook token
 * for a few minutes, ask them to tap Google once, and then attach Facebook to
 * that same account — from then on either button opens the same points. */
const FB_LINK_KEY = "koup_fb_link"

async function rememberFacebookToLink(e: unknown, token?: string | null) {
  if ((e as { code?: string })?.code !== "auth/account-exists-with-different-credential") return
  let t = token
  if (!t) {
    const { FacebookAuthProvider } = await import("firebase/auth")
    t = FacebookAuthProvider.credentialFromError(e as never)?.accessToken ?? null
  }
  if (!t) return
  try {
    localStorage.setItem(FB_LINK_KEY, JSON.stringify({ token: t, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Called once a user is signed in: attach a Facebook login waiting for them. */
export async function linkPendingFacebook(): Promise<boolean> {
  let pending: { token?: string; at?: number } = {}
  try {
    pending = JSON.parse(localStorage.getItem(FB_LINK_KEY) || "{}")
  } catch {
    return false
  }
  if (!pending.token) return false
  try {
    localStorage.removeItem(FB_LINK_KEY)
  } catch {
    /* ignore */
  }
  if (!pending.at || Date.now() - pending.at > 15 * 60_000) return false
  const auth = await firebaseAuth()
  if (!auth.currentUser) return false
  const { FacebookAuthProvider, linkWithCredential } = await import("firebase/auth")
  try {
    await linkWithCredential(auth.currentUser, FacebookAuthProvider.credential(pending.token))
    return true
  } catch {
    return false // already linked, or the token expired — nothing to undo
  }
}

export async function signInWithFacebook(): Promise<void> {
  if (isPhone()) {
    facebookDirect()
    return
  }
  const { FacebookAuthProvider } = await import("firebase/auth")
  const provider = new FacebookAuthProvider()
  provider.addScope("email")
  provider.setCustomParameters({ display: "popup" })
  try {
    await signInWith(provider)
  } catch (e) {
    await rememberFacebookToLink(e)
    throw e
  }
}

async function signInWith(provider: import("firebase/auth").AuthProvider): Promise<void> {
  const auth = await firebaseAuth()
  const { signInWithPopup, signInWithRedirect } = await import("firebase/auth")
  // Inside an in-app browser a popup opens a dead tab: go straight to redirect.
  if (inAppBrowser()) {
    await signInWithRedirect(auth, provider)
    return
  }
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = (e as { code?: string })?.code ?? ""
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider)
      return
    }
    throw e
  }
}

export async function signOutWeb(): Promise<void> {
  const auth = await firebaseAuth()
  const { signOut } = await import("firebase/auth")
  await signOut(auth)
}

/** Arabic for the errors a customer can actually hit. */
export function signInError(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? ""
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null
  if (code === "auth/unauthorized-domain") return "هذا العنوان غير مسموح للدخول بعد — بلّغ المقهى."
  if (code === "auth/network-request-failed") return "ما في إنترنت — جرّب كمان شوي."
  if (code === "auth/account-exists-with-different-credential")
    return "حسابك عندنا مسجّل عبر Google — اضغط Google، وبنربط فيسبوك بنفس الحساب."
  if (code === "auth/operation-not-allowed") return "هذه الطريقة غير مفعّلة بعد — جرّب الطريقة الثانية."
  return "ما زبط الدخول. جرّب كمان مرة."
}
