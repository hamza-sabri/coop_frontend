"use client"

/* Customers appear on their own.
 *
 * A customer signing up on the web page (or finishing their profile) used to
 * show up in the admin only after a refresh. One light poll for the whole
 * admin — the most recently changed customer, one row — and when it moves,
 * every customer list, picker and profile on screen refetches. A brand-new
 * sign-up also gets a toast, wherever the staff happen to be.
 */
import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { customersList } from "@/api/generated/customers/customers"
import { hasModule, useModules } from "@/lib/modules"

const POLL_MS = 8_000

type Row = { id: number; name?: string; created_at?: string; updated_at?: string }

export function CustomersLive() {
  const qc = useQueryClient()
  const { modules, isLoading } = useModules()
  const on = !isLoading && hasModule(modules, "customers")

  const { data } = useQuery({
    queryKey: ["customers-live"],
    queryFn: async () => {
      const r = await customersList({ ordering: "-updated_at", page_size: 1 } as never)
      const rows = ((r as { data?: { results?: Row[] } }).data?.results ?? []) as Row[]
      return rows[0] ?? null
    },
    enabled: on,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 0,
  })

  const last = useRef<string | null>(null)
  const since = useRef<number>(Date.now())
  useEffect(() => {
    if (!data) return
    const stamp = `${data.id}:${data.updated_at ?? ""}`
    if (last.current === null) {
      last.current = stamp // first answer: nothing has changed yet
      return
    }
    if (stamp === last.current) return
    last.current = stamp

    void qc.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey[0]
        return (
          k === "customers" ||
          k === "customers-quick" ||
          (typeof k === "string" && k.startsWith("/api/v1/customers"))
        )
      },
    })
    const created = data.created_at ? Date.parse(data.created_at) : 0
    if (created > since.current) {
      since.current = created
      toast.success(`زبون جديد انضم: ${data.name || "بدون اسم"}`)
    }
  }, [data, qc])

  return null
}
