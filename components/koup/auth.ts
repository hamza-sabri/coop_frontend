import type { ComponentType } from 'react'
import type { ShopMe } from '@/lib/koup-me'
import type { Fulfilment, Order, OrderItem } from '@/lib/koup-orders'

/** What the app needs to know about who is holding the phone. */
export type KoupAuth = {
  /** Blur the app and show the door. */
  locked: boolean
  user: { firstName?: string | null; imageUrl?: string | null } | null
  /** The door itself — only supplied when Clerk is configured. */
  Gate?: ComponentType
  /** Opens Clerk's account UI: profile, connected accounts, security. */
  openProfile?: () => void
  /** Clerk's UserButton — the avatar plus manage-account, settings and
   *  sign-out. */
  Account?: ComponentType<{ onSettings?: () => void }>
  /** Does Clerk already have a number for this customer? */
  hasPhone?: boolean
  /** Save one. Resolves true on success. Used as a step INSIDE checkout —
   *  the counter cannot call out an order it has no way to attach to a
   *  person, so this is asked before the order is sent, not after. */
  savePhone?: (phone: string) => Promise<boolean>
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
  placeOrder?: (
    items: OrderItem[],
    opts?: {
      note?: string
      fulfilment?: Fulfilment
      table_number?: string
      beans_spent?: number
    },
  ) => Promise<Order | null>
  refreshOrders?: () => Promise<void> | void
}

/** Clerk is on only when a publishable key was built in. NEXT_PUBLIC_* is
 *  inlined at build time, so this is a constant, not a runtime lookup. */
export const CLERK_ON = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
