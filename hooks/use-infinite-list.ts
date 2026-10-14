"use client"

import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

type PageBody<T> = {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

/** The generated orval "fetch" functions resolve to a { data } envelope. */
type ListResponse<T> = { data: PageBody<T> }

/** Pull the `page` number out of DRF's `next` URL (or undefined at the end). */
function nextPageParam(url?: string | null): number | undefined {
  if (!url) return undefined
  try {
    const p = new URL(url).searchParams.get("page")
    return p ? Number(p) : undefined
  } catch {
    return undefined
  }
}

/**
 * Server-paginated list over a generated `xxxList` fetcher. Flattens every page
 * into `items` and exposes `count` + the usual infinite-query controls.
 */
export function useInfiniteList<T>(
  keyBase: readonly unknown[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: (params: any) => Promise<ListResponse<T>>,
  params: Record<string, unknown>,
  enabled = true,
  /** Poll every N ms — for screens left open. Only while just the first page
   *  is loaded: re-fetching twenty pages every few seconds for someone deep
   *  in the history would hammer the server and the main thread. */
  refetchInterval?: number,
) {
  const query = useInfiniteQuery({
    queryKey: [...keyBase, params],
    queryFn: ({ pageParam }) => fetcher({ ...params, page: pageParam }),
    initialPageParam: 1 as number,
    getNextPageParam: (last) => nextPageParam(last.data.next),
    enabled,
    refetchInterval: refetchInterval
      ? (q) => ((q.state.data?.pages.length ?? 0) <= 1 ? refetchInterval : false)
      : undefined,
  })

  // Memoised: a fresh array every render made any effect keyed on `items`
  // set state → re-render → new array → effect again, forever. That loop
  // starved the router (links stopped working on the orders page).
  const pages = query.data?.pages
  const items = useMemo(() => pages?.flatMap((p) => p.data.results ?? []) ?? [], [pages])
  const count = query.data?.pages[0]?.data.count ?? 0

  return { ...query, items, count }
}
