"use client"

import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { customersQuick } from "@/api/sales"
import { customersList } from "@/api/generated/customers/customers"
import type { ComboOption } from "@/components/entity-combobox"
import { matches } from "@/lib/search"

/**
 * Customers held client-side (server side is Redis-cached, invalidated on any
 * customer/debt change) so the POS customer picker filters instantly.
 * Falls back to the paginated API until the catalogue has loaded.
 */
export function useCustomersCatalog() {
  const { data, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["customers-quick"],
    queryFn: async () => (await customersQuick()).data.results,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  })

  /* App customers first, then whoever has the most points. Someone who signed
     up in the app is the person whose balance actually moves — at the till
     they are the ones being looked for, so they should never be buried under
     a wall of walk-ins typed in by hand. */
  const rank = useCallback(
    <T extends { signed_up?: boolean; beans?: number; name: string }>(rows: T[]) =>
      [...rows].sort(
        (a, b) =>
          Number(b.signed_up ?? false) - Number(a.signed_up ?? false) ||
          (b.beans ?? 0) - (a.beans ?? 0) ||
          a.name.localeCompare(b.name, "ar"),
      ),
    [],
  )

  const sorted = data ? rank(data) : undefined

  const fetcher = useCallback(
    async (search: string): Promise<ComboOption[]> => {
      const toOption = (c: {
        id: number; name: string; phone?: string
        avatar?: string; signed_up?: boolean
      }): ComboOption => ({
        id: c.id,
        label: c.name,
        sub: c.phone || undefined,
        avatar: c.avatar || undefined,
        badge: c.signed_up ? "تطبيق" : undefined,
      })

      // Opening the picker on a list older than 30 s fetches it again first
      // (cheap: the server caches it), so someone who just signed up in the
      // app is there when the cashier looks.
      let list = data
      if (list && !search.trim() && Date.now() - dataUpdatedAt > 30_000) {
        list = (await refetch()).data ?? list
      }
      if (list) {
        const q = search.trim()
        const hits = q ? list.filter((c) => matches(c.name, q) || matches(c.phone, q)) : list
        if (hits.length || !q) return rank(hits).slice(0, 20).map(toOption)
        // Nothing here — ask the server before saying "no one".
      }
      // Catalogue still loading, or no local match → ask the API.
      const r = await customersList({ search: search || undefined, page_size: 20 })
      const rows = (r.data.results ?? []) as unknown as {
        id: number; name: string; phone?: string
        avatar?: string; signed_up?: boolean
      }[]
      return rank(rows).map(toOption)
    },
    [data, dataUpdatedAt, refetch, rank],
  )

  return { customers: sorted, fetcher, ready: Boolean(data) }
}
