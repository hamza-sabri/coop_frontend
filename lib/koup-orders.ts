"use client"
/* The customer's orders — placed for real, and read back.
 *
 * Everything on the old طلبي screen was invented in the component: a fake
 * "آيس لاتيه كراميل + فرنش توست", a fake "#١٠٤٢", a fake status. Nothing
 * reached Django, so nothing ever appeared in the admin, and there was no
 * such thing as history. This is the wire.
 */
import { useCallback, useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const CACHE = "koup.orders.v1"

export type OrderItem = {
  id?: number
  product?: number | null
  variant?: number | null
  name: string
  unit_price: string
  quantity: string | number
  note?: string
  line_total?: string
}

export type Fulfilment = "pickup" | "dinein"

export type Order = {
  id: number
  fulfilment?: Fulfilment
  table_number?: string
  beans_spent?: number
  status: "placed" | "accepted" | "preparing" | "ready" | "collected" | "cancelled"
  status_label: string
  next_statuses: string[]
  total: string
  note: string
  items: OrderItem[]
  created_at: string
  updated_at?: string
  /** Every status it has been in, with when (the server records each move). */
  timeline?: { s: Order["status"]; at: string | null }[]
}

/** Anything not in this set is finished business — history, not a live order. */
export const LIVE_STATUSES = new Set(["placed", "accepted", "preparing", "ready"])

/** Live = still moving AND from today's service. An order accepted days ago
 *  and never marked collected is history, not "on its way" — otherwise it
 *  sits on top of home forever and keeps the app polling. */
const STALE_MS = 12 * 60 * 60 * 1000
export function isLiveOrder(o: Pick<Order, "status" | "created_at">, now = Date.now()): boolean {
  if (!LIVE_STATUSES.has(o.status)) return false
  const at = Date.parse(o.created_at)
  return Number.isNaN(at) || now - at < STALE_MS
}

function readCache(uid: string): Order[] {
  try {
    const raw = localStorage.getItem(CACHE)
    if (!raw) return []
    const c = JSON.parse(raw) as { uid: string; orders: Order[] }
    return c && c.uid === uid && Array.isArray(c.orders) ? c.orders : []
  } catch { return [] }
}

function writeCache(uid: string, orders: Order[]) {
  try { localStorage.setItem(CACHE, JSON.stringify({ uid, orders })) } catch { /* fine */ }
}

export function useKoupOrders(
  uid: string | null | undefined,
  getToken: (() => Promise<string | null>) | undefined,
) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!uid) { setOrders([]); return }
    const c = readCache(uid)
    if (c.length) setOrders(c)
  }, [uid])

  const refresh = useCallback(async () => {
    if (!uid || !getToken) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const r = await fetch(`${API}/api/v1/shop/orders/`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (!r.ok) return
      const j = (await r.json()) as { results: Order[] }
      setOrders(j.results ?? [])
      writeCache(uid, j.results ?? [])
    } catch {
      /* offline — the cached list stays on screen */
    } finally { setLoading(false) }
  }, [uid, getToken])

  useEffect(() => { void refresh() }, [refresh])

  /* While an order is live the customer is watching it, so poll — but only
     then. A finished list does not change on its own, and a café's wifi is
     not worth spending on a request that can only return the same thing. */
  useEffect(() => {
    if (!orders.some(o => isLiveOrder(o))) return
    const id = window.setInterval(() => { void refresh() }, 20_000)
    return () => window.clearInterval(id)
  }, [orders, refresh])

  const place = useCallback(async (
    items: OrderItem[],
    opts: {
      note?: string
      fulfilment?: Fulfilment
      table_number?: string
      /** Points the customer asked to spend. The SERVER decides what actually
       *  comes off — it checks the live balance and the order total inside the
       *  same transaction, because a balance read on this phone thirty seconds
       *  ago is not a balance. */
      beans_spent?: number
    } = {},
  ): Promise<Order | null> => {
    if (!uid || !getToken || !items.length) return null
    const token = await getToken()
    if (!token) return null
    /* One id per checkout, generated here. A retry after a dropped response
       returns the ORIGINAL order instead of making a second one — the same
       contract the offline till uses for sales. */
    const client_uuid =
      (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2))
    const r = await fetch(`${API}/api/v1/shop/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items,
        note: opts.note ?? "",
        fulfilment: opts.fulfilment ?? "pickup",
        table_number: opts.table_number ?? "",
        beans_spent: opts.beans_spent ?? 0,
        client_uuid,
      }),
    })
    if (!r.ok) {
      // Show the server's words, not its JSON: {"items": "…"} → "…".
      const body = await r.json().catch(() => null) as Record<string, unknown> | null
      const first = (v: unknown): string =>
        typeof v === "string" ? v : Array.isArray(v) ? first(v[0]) : v && typeof v === "object" ? first(Object.values(v)[0]) : ""
      throw new Error((body && (first(body.detail) || first(body))) || "ما زبط الطلب — جرّب كمان مرة")
    }
    const order = (await r.json()) as Order
    setOrders(prev => {
      const next = [order, ...prev.filter(o => o.id !== order.id)]
      writeCache(uid, next)
      return next
    })
    return order
  }, [uid, getToken])

  /** Cancel while still «بانتظار التأكيد» (the server refuses later, and
   *  refunds any points spent). Throws the server's own words on refusal. */
  const cancel = useCallback(async (id: number): Promise<Order | null> => {
    if (!uid || !getToken) return null
    const token = await getToken()
    if (!token) return null
    const r = await fetch(`${API}/api/v1/shop/orders/${id}/cancel/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    })
    const body = await r.json().catch(() => null) as (Order & { detail?: string }) | null
    if (!r.ok) throw new Error(body?.detail || "ما زبط الإلغاء — جرّب كمان مرة")
    if (body && typeof body.id === "number") {
      setOrders(prev => {
        const next = prev.map(o => (o.id === body.id ? body : o))
        writeCache(uid, next)
        return next
      })
    } else {
      void refresh()
    }
    return body
  }, [uid, getToken, refresh])

  const live = orders.find(o => isLiveOrder(o)) ?? null
  const past = orders.filter(o => !isLiveOrder(o))

  return { orders, live, past, loading, refresh, place, cancel }
}
