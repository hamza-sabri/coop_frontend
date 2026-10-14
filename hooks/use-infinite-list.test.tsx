import { useEffect, useState } from "react"
import { describe, expect, it } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useInfiniteList } from "./use-infinite-list"

const fetcher = async () => ({ data: { count: 2, next: null, results: [{ id: 1 }, { id: 2 }] } })

let effects = 0
function Probe() {
  const { items } = useInfiniteList<{ id: number }>(["probe"], fetcher, { a: 1 })
  const [, setSeen] = useState(0)
  // The orders page did exactly this: state set from `items` in an effect.
  useEffect(() => {
    effects++
    if (items.length) setSeen((n) => n + 1)
  }, [items])
  return <p>{items.length}</p>
}

describe("useInfiniteList", () => {
  it("keeps `items` stable between renders (no effect loop)", async () => {
    effects = 0
    const qc = new QueryClient()
    const { findByText } = render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    )
    await findByText("2")
    await new Promise((r) => setTimeout(r, 200))
    await waitFor(() => expect(effects).toBeLessThan(5))
  })
})
