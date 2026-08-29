"use client"
/* The counter's queue: orders customers sent from the app.
 *
 * This sits at the TOP of الطلبات because it is the only part of that page
 * that is time-sensitive — a sale in the history below can wait, a drink
 * somebody is standing there waiting for cannot.
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  ordersList, orderAdvance, STATUS_ACTION,
  type Order, type OrderStatus,
} from "@/api/orders"
import { formatMoney } from "@/lib/format"

/** Anything else is finished business and belongs in history, not the queue. */
const LIVE: OrderStatus[] = ["placed", "accepted", "preparing", "ready"]

export function LiveOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await ordersList({ ordering: "created_at", page_size: 50 })
      setOrders((res.data.results ?? []).filter(o => LIVE.includes(o.status)))
    } catch {
      /* the till is offline or the API blipped — keep what is on screen */
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /* Ten seconds. A customer is standing at the counter; a minute of latency
     here is the difference between the app being useful and being decorative.
     Cheap: this is one small query against an indexed (store, status) pair. */
  useEffect(() => {
    const id = window.setInterval(() => { void load() }, 10_000)
    const onFocus = () => { void load() }
    window.addEventListener("focus", onFocus)
    return () => { window.clearInterval(id); window.removeEventListener("focus", onFocus) }
  }, [load])

  async function advance(o: Order, status: OrderStatus) {
    setBusy(o.id)
    try {
      await orderAdvance(o.id, status)
      toast.success(`طلب #${o.id} · ${STATUS_ACTION[status]}`)
      await load()
    } catch {
      toast.error("ما زبطت — جرّب كمان مرة")
    } finally {
      setBusy(null)
    }
  }

  if (!orders.length) return null

  return (
    <section className="mb-6 rounded-3xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-base font-bold">
          طلبات من التطبيق
          <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {orders.length}
          </span>
        </h3>
        <span className="text-xs text-muted-foreground">بتتحدث لحالها</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map(o => (
          <article key={o.id} className="rounded-2xl border border-border/70 bg-background p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <b className="font-heading text-sm">
                طلب #{o.id}
                {o.customer_name ? <span className="ms-2 text-xs font-normal text-muted-foreground">{o.customer_name}</span> : null}
              </b>
              <span className="text-sm font-bold">{formatMoney(Number(o.total))}</span>
            </div>

            <p className="mt-0.5 text-xs text-muted-foreground">{o.status_label}</p>

            <ul className="mt-2.5 space-y-1 text-[13px]">
              {o.items.map(it => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="tabular-nums">{Math.round(Number(it.quantity))}×</span>{" "}
                    {it.name}
                    {it.note ? <em className="text-muted-foreground"> · {it.note}</em> : null}
                  </span>
                </li>
              ))}
            </ul>

            {o.note ? (
              <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">{o.note}</p>
            ) : null}

            {/* Only the moves the backend will actually accept: next_statuses
                comes straight from the model's transition table, so the till
                cannot offer a step that will be refused. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {o.next_statuses.map(st => (
                <button
                  key={st}
                  disabled={busy === o.id}
                  onClick={() => advance(o, st)}
                  className={
                    st === "cancelled"
                      ? "rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
                      : "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  }
                >
                  {STATUS_ACTION[st]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
