import { API_BASE } from "@/api/http"

/** Public, aggregate-only platform stats for the marketing site (no auth). */
export type PublicStats = {
  products: number
  listings: number
  stores: number
  with_images: number
  categories: { name: string; count: number }[]
}

export async function publicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_BASE}/api/v1/public/stats/`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`stats ${res.status}`)
  return (await res.json()) as PublicStats
}

/**
 * Can customers order right now? Its own endpoint, uncached, so switching
 * ordering off takes effect on the next page load rather than after the
 * menu's five-minute cache expires.
 */
export async function publicOrdering(): Promise<{ open: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/public/ordering/`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`ordering ${res.status}`)
  return (await res.json()) as { open: boolean }
}
