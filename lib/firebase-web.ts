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
export async function signInWithGoogle(): Promise<void> {
  const auth = await firebaseAuth()
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth")
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
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
  return "ما زبط الدخول. جرّب كمان مرة."
}
