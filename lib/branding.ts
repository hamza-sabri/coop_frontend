/**
 * Per-tenant branding — each store's own NAME + LOGO everywhere the app
 * chrome used to say the vendor brand.
 *
 * Source of truth is the backend's public branding endpoint (name + logo by
 * slug, nothing sensitive), so this works logged-out too (login page, PWA
 * manifest). No slug / central site / missing logo → fall back to the generic
 * Pharma brand.
 *
 * Isomorphic on purpose: these run in Server Components (layout metadata,
 * manifest route — with ISR revalidate) and in the browser (React Query via
 * hooks/use-branding).
 *
 * The tenant is per-REQUEST, not per-build: on the client it comes from the
 * slug the layout stamped on <html>; on the server the caller must pass it in
 * (`await currentSlug()`), because a Server Component has no `document` and
 * one deployment now answers for every store. Defaulting rather than
 * passing it server-side would silently brand every tenant as the central
 * site.
 */
import { getPharmacySlug } from "@/lib/site"

export type Branding = { name: string; logo: string }

/* The fallback shown before the store's own branding arrives, and whenever
   the branding lookup fails. It must be GENERIC.
   This used to be "المودة" — another client of this template — so any coop
   screen whose branding call 404'd (a slug mismatch, a cold cache, offline)
   displayed a different client's brand in the sidebar and on printed
   receipts. A neutral word is a small cosmetic loss; the wrong client's name
   in front of a customer is not. */
export const DEFAULT_BRAND_NAME = "المتجر"
/* كوب's own marks. /icons/* are the template's generic set and were another
   client's artwork in practice — the sidebar and the installed PWA both wore
   it. /koup/* ships with this app, so the default is right even before the
   backend answers. */
export const DEFAULT_ICON_192 = "/koup/icon-192.png"
export const DEFAULT_ICON_512 = "/koup/icon-512.png"
export const DEFAULT_ICON_MASKABLE = "/koup/icon-maskable-512.png"

// Kept out of api/http.ts so server code doesn't drag in the client-only API
// layer (tokens/localStorage/demo mocks). The VALUE still comes from the one
// place that resolves it — never a per-file default pointing at another shop.
import { API_BASE } from "@/lib/api-base"

/** The public branding JSON URL for a tenant, or null when there isn't one. */
export function brandingUrl(slug = getPharmacySlug()): string | null {
  if (!slug) return null
  return `${API_BASE}/api/v1/public/branding/?store=${encodeURIComponent(slug)}`
}

/** Backend-rendered square PNG of the tenant logo (PWA manifest icons). */
export function brandingIconUrl(
  size: 192 | 512,
  maskable = false,
  slug = getPharmacySlug(),
): string {
  return (
    `${API_BASE}/api/v1/public/branding/icon/?store=${encodeURIComponent(slug)}` +
    `&size=${size}${maskable ? "&maskable=1" : ""}`
  )
}

/**
 * Fetch {name, logo} for this tenant. Null on central site, unknown slug,
 * network failure, or when the tenant has neither a name nor a logo — callers
 * then keep the default Pharma brand.
 */
export async function fetchBranding(
  options: { slug?: string; revalidateSeconds?: number } = {},
): Promise<Branding | null> {
  const { slug, revalidateSeconds = 300 } = options
  const url = brandingUrl(slug ?? getPharmacySlug())
  if (!url) return null
  try {
    // `next.revalidate` = ISR on the server; browsers simply ignore the key.
    const res = await fetch(url, { next: { revalidate: revalidateSeconds } })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<Branding> | null
    const name = typeof data?.name === "string" ? data.name.trim() : ""
    const logo = typeof data?.logo === "string" ? data.logo : ""
    if (!name && !logo) return null
    return { name, logo }
  } catch {
    return null
  }
}
