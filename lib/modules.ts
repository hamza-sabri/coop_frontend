"use client"

import { NAV_ITEMS, type NavItem } from "@/components/nav-config"
import { useMe } from "@/hooks/use-me"

/**
 * Feature modules — mirrors `apps/store/modules.py` on the backend.
 *
 * After login, `user.modules` lists what THIS account may use (the store's
 * subscription ∩ the account's own grants). The API enforces it server-side;
 * everything here is purely cosmetic — hide nav items and bounce users off
 * pages they can't use anyway.
 *
 * A user object WITHOUT a `modules` field (older backend) means "everything",
 * so the UI never locks out a tenant mid-upgrade.
 */

export const MODULE_LABELS: Record<string, string> = {
  inventory: "المخزون والأدوية",
  pos: "نقطة البيع",
  customers: "الزبائن",
  debts: "الديون والدفاتر",
  price_check: "استعلام الأسعار للزبائن",
  imports: "الاستيراد من حسابات",
  reports: "التقارير والتحليلات",
  sales_reports: "تقارير المبيعات",
  purchases: "المشتريات وطلبات الشراء",
  offline: "العمل بدون إنترنت",
  offline_purchases: "المشتريات بدون إنترنت",
  online_orders: "الطلب أونلاين",
  pnl: "الأرباح والمصاريف",
}

export const ALL_MODULE_KEYS = Object.keys(MODULE_LABELS)

/** `modules` may be a string or an any-of array; undefined = ungated. */
export function hasModule(
  mods: ReadonlySet<string> | null,
  required?: string | readonly string[],
): boolean {
  if (!required) return true
  if (mods === null) return true // unknown yet / legacy backend → don't lock out
  const list = typeof required === "string" ? [required] : required
  return list.some((m) => mods.has(m))
}

/**
 * The current account's effective modules.
 * `null` while /me is loading or when the backend doesn't send the field.
 */
export function useModules(): { modules: ReadonlySet<string> | null; isLoading: boolean } {
  const { user, isLoading } = useMe()
  const raw = (user as { modules?: string[] } | undefined)?.modules
  const modules = Array.isArray(raw) && raw.length > 0 ? new Set(raw) : null
  return { modules, isLoading }
}

/**
 * Role of the current account. Employees are day-to-day staff; owner-only
 * surfaces (reports, imports, QR, bulk ops) hide or lock for them. Unknown /
 * legacy backends count as owner so nobody gets locked out mid-upgrade —
 * the API enforces the real rule server-side either way.
 */
export function useIsOwner(): boolean {
  return useOwnerState() === "owner"
}

/**
 * The same question, with "not known yet" as its own answer.
 *
 * Treating "still loading" as owner fired every owner-only request for an
 * employee during the first half-second (the P&L, the period totals, the QR)
 * and each came back 403. Owner-only queries and pages wait for "owner";
 * pages show a skeleton for "loading" rather than flashing the
 * "owner only" notice at the owner.
 */
export function useOwnerState(): "owner" | "employee" | "loading" {
  const { user, isLoading } = useMe()
  if (!user) return isLoading ? "loading" : "owner"
  // The server's answer first: owner OR platform superuser = full access,
  // whatever `role` says (a superuser's role can read "employee").
  const u = user as { role?: string; is_owner?: boolean }
  if (typeof u.is_owner === "boolean") return u.is_owner ? "owner" : "employee"
  return u.role === "employee" ? "employee" : "owner"
}

function itemLocked(
  item: NavItem,
  modules: ReadonlySet<string> | null,
  isOwner: boolean,
): boolean {
  if (!hasModule(modules, item.module)) return true
  return Boolean(item.ownerOnly) && !isOwner
}

/** NAV_ITEMS the current account may actually see. */
export function useNavItems(): NavItem[] {
  const { modules } = useModules()
  const isOwner = useIsOwner()
  return NAV_ITEMS.filter((item) => !itemLocked(item, modules, isOwner))
}

/** ALL nav items, each flagged `locked` when the account lacks its module.
 *  Locked items are shown (not hidden) and open the "contact the owner"
 *  dialog when clicked — see components/locked-feature.tsx. */
export function useNavItemsWithLock(): { item: NavItem; locked: boolean }[] {
  const { modules } = useModules()
  const isOwner = useIsOwner()
  return NAV_ITEMS.map((item) => ({
    item,
    locked: itemLocked(item, modules, isOwner),
  })).filter(
    ({ item, locked }) =>
      !(locked && item.hideWhenLocked) &&
      // Money is not an upsell to an employee: it is simply not theirs.
      !(item.ownerOnly && !isOwner),
  )
}

/** Where to land someone who can't open the page they asked for. */
export function firstAllowedRoute(mods: ReadonlySet<string> | null): string {
  const first = NAV_ITEMS.find((item) => hasModule(mods, item.module))
  return first?.href ?? "/login"
}

/** The module a pathname belongs to (undefined = ungated page). */
export function requiredModuleFor(pathname: string): string | string[] | undefined {
  const item = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  )
  return item?.module
}
