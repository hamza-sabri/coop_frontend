import {
  BookOpenText,
  Store,
  Boxes,
  Users,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  ConciergeBell,
  Sunset,
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
  /**
   * A live count to show on this item. "liveOrders" = orders from the app that
   * nobody has accepted yet. Deliberately a KEY rather than a number: nav-config
   * is a plain data module that both the sidebar and the bottom bar import, and
   * it must not pull a React hook in with it.
   */
  badge?: "liveOrders"
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
  /* Two different things, and they used to share one page.
     الطلبات is the LIVE board: drinks somebody is waiting for. It carries the
     badge, because it is the only page in the admin with a number that means
     "go and do something now".
     الفواتير is history: what was rung up. It can wait, and it does. */
  {
    href: "/live",
    label: "الطلبات",
    icon: ConciergeBell,
    module: "pos",
    badge: "liveOrders",
  },
  { href: "/orders", label: "الفواتير", icon: ShoppingBag, module: "pos", desktopOnly: true },
  // The screen an owner opens at closing time. Separate from التقارير, which
  // is a month of analysis: this one is the drawer, tonight.
  {
    href: "/today",
    label: "اليوم",
    icon: Sunset,
    module: "pos",
    desktopOnly: true,
  },
  {
    href: "/reports",
    label: "التقارير",
    icon: ChartPie,
    desktopOnly: true,
    module: "reports",
  },
  /* Import is out of the navigation for كوب. It exists to bulk-load a
     catalogue of thousands from a supplier file; a café types its menu once
     and then edits it. The page and its API are untouched — restore this
     entry to bring it back for a vertical that needs it. */
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}
