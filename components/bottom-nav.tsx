"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
import { isActive, type NavItem } from "@/components/nav-config"
import { GlobalScanButton } from "@/components/scan/global-scan-button"
import { useScannerEnabled } from "@/lib/scanner-pref"
import { useNavItemsWithLock } from "@/lib/modules"
import { NavBadge } from "@/components/orders/nav-badge"
import { useLockedFeature } from "@/components/locked-feature"
import { cn } from "@/lib/utils"

/**
 * Ink bar docked to the bottom edge — the app's main mobile navigation. Every
 * feature shows; ones this account can't use are locked and open a "contact
 * the owner" dialog.
 *
 * Docked, not floating: on Android an installed app reports a tall bottom
 * safe area (the gesture bar), and a pill lifted by `0.75rem + inset` rose
 * into the POS cart bar and covered it. The bar now sits on the edge and
 * fills the safe area with its own colour; its height is `--nav-h`
 * (globals.css), which everything that floats above it uses.
 */
export function BottomNav() {
  const pathname = usePathname()
  const { openLocked } = useLockedFeature()
  const items = useNavItemsWithLock().filter(({ item }) => !item.desktopOnly)
  const half = Math.ceil(items.length / 2)
  const first = items.slice(0, half)
  const last = items.slice(half)

  function Item({ item, locked }: { item: NavItem; locked: boolean }) {
    const active = isActive(pathname, item.href) && !locked
    const Icon = item.icon
    const className = cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors",
      active ? "text-lime" : locked ? "text-white/40" : "text-white/55 hover:text-white",
    )
    const inner = (
      <>
        <span
          className={cn(
            "relative grid size-8 place-items-center rounded-xl transition-colors",
            active && "bg-white/10",
          )}
        >
          <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
          <NavBadge badge={item.badge} className="absolute -end-1 -top-1" />
          {locked && (
            <span className="absolute -end-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-ink text-white/85 ring-1 ring-white/15">
              <Lock className="size-2.5" />
            </span>
          )}
        </span>
        {item.label}
      </>
    )
    const anchor = `nav-${item.href.replace("/", "")}`
    return locked ? (
      <button
        type="button"
        data-tour={anchor}
        onClick={() => openLocked(item.module)}
        className={className}
      >
        {inner}
      </button>
    ) : (
      <Link
        href={item.href}
        data-tour={anchor}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {inner}
      </Link>
    )
  }

  // Off by default — see lib/scanner-pref.ts.
  const scannerOn = useScannerEnabled()

  return (
    <nav data-slot="bottom-nav" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      {/* Inline radius/padding: .ink-panel is unlayered CSS and beats utilities. */}
      <div
        className="ink-panel flex h-[var(--nav-h)] items-start gap-1 px-2 pt-1.5 shadow-2xl"
        style={{ borderRadius: "22px 22px 0 0", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {first.map(({ item, locked }) => (
          <Item key={item.href} item={item} locked={locked} />
        ))}
        {scannerOn && (
          <div className="shrink-0 px-1">
            <GlobalScanButton variant="nav" />
          </div>
        )}
        {last.map(({ item, locked }) => (
          <Item key={item.href} item={item} locked={locked} />
        ))}
      </div>
    </nav>
  )
}
