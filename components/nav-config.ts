import {
  BookOpenText,
  Store,
  Boxes,
  Users,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  ChartPie,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Hidden from the mobile bottom bar (still in the desktop rail). */
  desktopOnly?: boolean
  /**
   * Feature module(s) that unlock this item (array = any-of). Matches
   * `user.modules` from /auth/me/ — see lib/modules.ts. Omit = always shown.
   */
  module?: string | string[]
  /** Locked for employee accounts (owner/superuser only). */
  ownerOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/pos", label: "البيع", icon: Store, module: "pos" },
  // A café has a menu, not a warehouse. Same page, same data — the words a
// barista uses for it.
  { href: "/menu", label: "المنيو", icon: BookOpenText, module: "inventory" },
  {
    href: "/customers",
    label: "الزبائن",
    icon: Users,
    // Customer profiles serve POS credit sales and the debt ledger too.
    module: ["customers", "debts", "pos"],
    // Moved OFF the mobile bottom bar → the profile dropdown + a button on the
    // debts page. Still in the desktop rail.
    desktopOnly: true,
  },
  /* Debts and purchases are hidden for كوب. A café is paid at the counter, so
     there is no ledger of who owes; and stock arrives as a delivery note, not
     through a purchase-order builder. The pages and their data still exist —
     nothing was deleted — they are simply not in the navigation, so they can
     come back for a vertical that needs them by restoring these two entries. */
  // On the mobile bottom bar (took the debts slot) + the desktop rail.
  /* الطلبات, not المبيعات. This is a coffee shop: the counter takes orders,
     it does not record "sales" the way a supermarket till does. Same data,
     the word the staff actually use. /sales still redirects here. */
  { href: "/orders", label: "الطلبات", icon: ShoppingBag, module: "pos" },
  {
    href: "/reports",
    label: "التقارير",
    icon: ChartPie,
    desktopOnly: true,
    module: "reports",
    ownerOnly: true,
  },
  /* Import is out of the navigation for كوب. It exists to bulk-load a
     catalogue of thousands from a supplier file; a café types its menu once
     and then edits it. The page and its API are untouched — restore this
     entry to bring it back for a vertical that needs it. */
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}
