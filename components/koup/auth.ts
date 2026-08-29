import type { ComponentType } from 'react'
import type { ShopMe } from '@/lib/koup-me'
import type { Order, OrderItem } from '@/lib/koup-orders'

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
  /** This customer's real points, tier and history. Null while signed out or
   *  before the first answer; the app must render something either way. */
  me?: ShopMe | null
  /** Re-read the balance — used by pull-to-refresh. */
  refreshMe?: () => Promise<void> | void
  /** The customer's real orders: the live one, and the ones before it. */
  orders?: Order[]
  liveOrder?: Order | null
  pastOrders?: Order[]
  /** Send the basket to the shop. Resolves with the created order. */
  placeOrder?: (items: OrderItem[], note?: string) => Promise<Order | null>
  refreshOrders?: () => Promise<void> | void
}

/** Clerk is on only when a publishable key was built in. NEXT_PUBLIC_* is
 *  inlined at build time, so this is a constant, not a runtime lookup. */
export const CLERK_ON = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
