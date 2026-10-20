"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { useMe } from "@/hooks/use-me"
import { NAV_ITEMS, isActive } from "@/components/nav-config"
import { getPharmacySlug } from "@/lib/site"
import { analyticsEnabled, identify, initAnalytics, startClickTracking, trackPage } from "@/lib/analytics"

/** Readable page names for the dashboards: the nav label where there is one
 *  ("المنيو"), else the first path segment. */
function pageName(pathname: string): string {
  const hit = NAV_ITEMS.find((item) => isActive(pathname, item.href))
  if (hit) return hit.label
  return pathname.split("/").filter(Boolean)[0] || "home"
}

/** Mounted once in the admin layout. Renders nothing. */
export function AnalyticsTracker() {
  const pathname = usePathname()
  const { user } = useMe(analyticsEnabled)
  const who = useRef<string | null>(null)
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!analyticsEnabled) return
    void initAnalytics()
    startClickTracking()
  }, [])

  useEffect(() => {
    if (!analyticsEnabled || !user) return
    const store =
      (user as { store_slug?: string }).store_slug || getPharmacySlug() || "unknown"
    const key = `${store}:${user.id}`
    if (who.current === key) return
    who.current = key
    identify({
      userId: user.id,
      store,
      role: (user as { role?: string }).role || "employee",
    })
  }, [user])

  useEffect(() => {
    if (!analyticsEnabled || !pathname || lastPath.current === pathname) return
    lastPath.current = pathname
    trackPage(pathname, pageName(pathname))
  }, [pathname])

  return null
}
