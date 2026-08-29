"use client"
/* Orders this customer placed from the app, on their profile page.
 *
 * The profile already had a section headed الطلبات — but it listed `Sale`
 * rows filtered by customer, which is till history. An order sent from the
 * phone is a different table, so a customer who had ordered twice that
 * morning still read "لا توجد طلبات".
 */
import { useCallback, useEffect, useState } from "react"

import { ordersList, type Order } from "@/api/orders"
import { formatMoney } from "@/lib/format"

const LIVE = new Set(["placed", "accepted", "preparing", "ready"])

export function CustomerAppOrders({ customerId }: { customerId: number }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await ordersList({ customer: customerId, page_size: 20 })
      setOrders(res.data.results ?? [])
    } catch {
      /* leave the section empty rather than breaking the profile */
    } finally {
      setLoaded(true)
    }
  }, [customerId])

  useEffect(() => { void load() }, [load])

  if (!loaded || orders.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-heading text-lg font-bold">
        طلبات من التطبيق
        <span className="ms-2 text-sm font-normal text-muted-foreground">
          {orders.length}
        </span>
      </h3>

      <div className="space-y-2.5">
        {orders.map(o => (
          <article
            key={o.id}
            className="rounded-2xl border border-border/70 bg-card p-3.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <b className="font-heading text-sm">طلب #{o.id}</b>
              <span className="text-sm font-bold tabular-nums">
                {formatMoney(Number(o.total))}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={
                  LIVE.has(o.status)
                    ? "rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                    : o.status === "cancelled"
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
                      : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                }
              >
                {o.status_label}
              </span>
              <span className="text-muted-foreground">
                {new Date(o.created_at).toLocaleString("ar", {
                  day: "numeric", month: "short",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>

            <ul className="mt-2 space-y-0.5 text-[13px] text-muted-foreground">
              {o.items.map(it => (
                <li key={it.id}>
                  <span className="tabular-nums">
                    {Math.round(Number(it.quantity))}×
                  </span>{" "}
                  {it.name}
                  {it.note ? <em> · {it.note}</em> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}
