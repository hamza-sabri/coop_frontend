import type { ComponentType } from 'react'

/** What the app needs to know about who is holding the phone. */
export type KoupAuth = {
  /** Blur the app and show the door. */
  locked: boolean
  user: { firstName?: string | null; imageUrl?: string | null } | null
  /** The door itself — only supplied when Clerk is configured. */
  Gate?: ComponentType
  /** Opens Clerk's account UI: profile, connected accounts, security. */
  openProfile?: () => void
  /** Clerk's UserButton — the avatar plus manage-account and sign-out. */
  Account?: ComponentType
  /** Asks once for a phone number, after an order. Renders nothing otherwise. */
  Phone?: ComponentType<{ armed?: boolean }>
  /** "Add to your phone" — hides itself once installed. */
  Install?: ComponentType
}

/** Clerk is on only when a publishable key was built in. NEXT_PUBLIC_* is
 *  inlined at build time, so this is a constant, not a runtime lookup. */
export const CLERK_ON = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
