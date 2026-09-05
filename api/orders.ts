"use client"
/* Customer-placed orders, staff side.
 *
 * NOT the same thing as api/sales.ts. A Sale is a completed till transaction;
 * an Order is what a customer sent from their phone and the counter has not
 * made yet. The الطلبات page was renamed from المبيعات but still listed
 * Sales — which is why an order placed in the app showed up on the phone and
 * nowhere in the admin. Two tables, two endpoints.
 */
import { customFetch } from "@/api/http"

export type OrderStatus =
  | "placed" | "accepted" | "preparing" | "ready" | "collected" | "cancelled"

export type OrderItem = {
  id: number
  name: string
  unit_price: string
  quantity: string
  note: string
  line_total: string
}

export type Order = {
  id: number
  status: OrderStatus
  status_label: string
  next_statuses: OrderStatus[]
  customer: number | null
  customer_name: string
  /** What the drinks cost, before any points came off. */
  total: string
  /** Points redeemed against this order. */
  beans_spent: number
  /** Those points' worth in shekels — the server does the division. */
  beans_value: string
  /** What the customer actually hands over: total − beans_value. */
  cash_total: string
  note: string
  fulfilment?: "pickup" | "dinein"
  table_number?: string
  items: OrderItem[]
  created_at: string
}

type Page<T> = { count: number; next?: string | null; results: T[] }

const qs = (p: Record<string, unknown>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v))
  }
  const out = s.toString()
  return out ? `?${out}` : ""
}

export const ordersList = (params: Record<string, unknown> = {}) =>
  customFetch<{ data: Page<Order> }>(`/api/v1/orders/${qs(params)}`)

/** Move an order one legal step. The backend refuses anything else. */
export const orderAdvance = (id: number, status: OrderStatus) =>
  customFetch<{ data: Order }>(`/api/v1/orders/${id}/advance/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })

/** Arabic for each step, so the button says what it does. */
export const STATUS_ACTION: Record<OrderStatus, string> = {
  placed: "بانتظار التأكيد",
  accepted: "اقبل الطلب",
  preparing: "ابدأ التحضير",
  ready: "جاهز للاستلام",
  collected: "تم الاستلام",
  cancelled: "ألغِ الطلب",
}
