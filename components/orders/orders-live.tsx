"use client"

/* ==========================================================================
   The counter's awareness of orders coming in from the app.

   One poller for the whole admin, mounted in the app shell, so that:

     - the sidebar badge is right on every page, not just on the board;
     - the beep fires wherever the barista happens to be looking;
     - and the board itself does not run a SECOND poll of the same data.

   A new order is the one event in this product that has to interrupt someone.
   Until now it did the opposite: the queue re-rendered silently every ten
   seconds, so an order landed only if a human already happened to be staring
   at the right section of the right page. A café counter is not a place where
   anyone stares at a screen.

   Three channels, in the order they reach someone who is busy:
     1. a beep (the till's existing one, honouring the same mute switch),
     2. the tab title, so a background tab shows the count,
     3. a desktop notification, if the browser has been granted it.
   ========================================================================== */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { ordersLive, type LiveOrders, type Order } from "@/api/orders"
import { isMuted, playAlert, unlockAudio } from "@/lib/beep"

export const LIVE_ORDERS_KEY = ["orders", "live"] as const

/** How often to ask. A customer is standing at a counter; a minute of latency
 *  is the difference between the app being useful and being decoration. */
const POLL_MS = 10_000

/** How often the alert repeats while an order sits unaccepted. */
const RING_MS = 7_000

/** ...and how many times, before it gives up and leaves the badge to it.
 *  Roughly five minutes. Long enough to walk back from the machine; short
 *  enough that an order left overnight does not ring until morning. */
const MAX_RINGS = 42

type Ctx = {
  orders: Order[]
  recent: Order[]
  pending: number
  open: number
  isLoading: boolean
  refresh: () => void
  /** Ask the browser for desktop notifications. Must be called from a click. */
  enableDesktopAlerts: () => Promise<boolean>
  desktopAlerts: "granted" | "denied" | "default" | "unsupported"
}

const OrdersLiveContext = createContext<Ctx | null>(null)

export function useLiveOrders(): Ctx {
  const c = useContext(OrdersLiveContext)
  // The badge renders in the sidebar, which is also used on pages that mount
  // outside the provider in tests. An empty board is the honest default.
  return (
    c ?? {
      orders: [],
      recent: [],
      pending: 0,
      open: 0,
      isLoading: false,
      refresh: () => {},
      enableDesktopAlerts: async () => false,
      desktopAlerts: "unsupported",
    }
  )
}

function permission(): Ctx["desktopAlerts"] {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission as "granted" | "denied" | "default"
}

export function OrdersLiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const pathname = usePathname()
  const [desktopAlerts, setDesktopAlerts] =
    useState<Ctx["desktopAlerts"]>("unsupported")

  useEffect(() => setDesktopAlerts(permission()), [])

  const { data, isLoading } = useQuery({
    queryKey: LIVE_ORDERS_KEY,
    queryFn: ordersLive,
    refetchInterval: POLL_MS,
    // Keep polling when the tab is NOT the one being looked at. This is the
    // whole point: react-query pauses interval refetches in a background tab
    // by default, so the admin only noticed an order at the moment somebody
    // switched back to it — the alarm and the desktop notification both fired
    // on return rather than on arrival, which is precisely backwards. A
    // notification exists to reach someone who is looking at something else.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    // A blip on the café's wifi must not empty the board.
    retry: 2,
    staleTime: 0,
  })

  const live = (data?.data ?? {
    results: [],
    recent: [],
    pending: 0,
    open: 0,
  }) as LiveOrders
  const orders = live.results ?? []

  // Which order ids we have already announced. Seeded on the FIRST response,
  // never announced — otherwise opening the admin with four orders already in
  // the queue plays four beeps and pops four notifications at once.
  const seen = useRef<Set<number> | null>(null)

  useEffect(() => {
    if (!data) return
    const ids = new Set(orders.map((o) => o.id))

    if (seen.current === null) {
      seen.current = ids
      return
    }

    // Sound is NOT fired from here any more. A new order starts an alarm that
    // keeps ringing until somebody accepts it (see below) — this effect only
    // owns the desktop notification, which should fire once per order and
    // never repeat.
    const fresh = orders.filter(
      (o) => !seen.current!.has(o.id) && o.status === "placed",
    )
    seen.current = ids
    if (fresh.length === 0) return

    if (permission() === "granted") {
      try {
        const one = fresh[0]
        const n = new Notification(
          fresh.length === 1 ? `طلب جديد #${one.id}` : `${fresh.length} طلبات جديدة`,
          {
            body:
              fresh.length === 1
                ? [
                    one.customer_name || "زبون",
                    one.items
                      ?.map(
                        (it) => `${Math.round(Number(it.quantity))}× ${it.name}`,
                      )
                      .join("، "),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "افتح لوحة الطلبات",
            tag: "koup-new-order",
            icon: "/koup/icon-192.png",
          },
        )
        n.onclick = () => {
          window.focus()
          window.location.href = "/live"
        }
      } catch {
        /* Safari throws on the constructor in some contexts; not fatal */
      }
    }
  }, [data, orders])

  // Ring until somebody answers.
  //
  // The first version beeped once, at the moment an order arrived. That is a
  // sound you can be in the room for and miss — and if you happened to be
  // away from the screen for the one second it played, the order simply sat
  // there. So the alert now repeats every seven seconds for as long as any
  // order is still UNACCEPTED, and stops the instant one is: accepting is the
  // acknowledgement, so there is no separate "dismiss" to remember.
  //
  // The cap exists for the other end of the day — an order left open
  // overnight should not ring until morning. After it lapses the badge, the
  // tab title and the red column are still there.
  const rings = useRef(0)
  const highWater = useRef(0)

  useEffect(() => {
    const pending = live.pending
    if (pending <= 0) {
      rings.current = 0
      highWater.current = 0
      return
    }
    // A NEW order restarts the count, so a second one arriving after the
    // alarm lapsed starts it ringing again.
    if (pending > highWater.current) rings.current = 0
    highWater.current = pending

    const ring = () => {
      if (rings.current >= MAX_RINGS) return
      rings.current += 1
      if (isMuted()) return
      try {
        playAlert()
      } catch {
        /* the audio context is not unlocked yet; the badge still carries it */
      }
    }

    ring()
    const id = window.setInterval(ring, RING_MS)
    return () => window.clearInterval(id)
  }, [live.pending])

  // The tab title. A backgrounded tab is the normal state of the admin on a
  // counter laptop that is also someone's browser.
  useEffect(() => {
    if (typeof document === "undefined") return
    const base = document.title.replace(/^\(\d+\)\s*/, "")
    document.title = live.pending > 0 ? `(${live.pending}) ${base}` : base
    // pathname is a dependency because Next rewrites the title on navigation,
    // which would otherwise drop the count until the next order arrived.
  }, [live.pending, pathname])

  // The audio context can only be created inside a user gesture. Do it on the
  // first interaction with the admin, once, so the FIRST order still beeps.
  useEffect(() => {
    const go = () => {
      try {
        unlockAudio()
      } catch {
        /* nothing to do */
      }
      window.removeEventListener("pointerdown", go)
      window.removeEventListener("keydown", go)
    }
    window.addEventListener("pointerdown", go, { once: true })
    window.addEventListener("keydown", go, { once: true })
    return () => {
      window.removeEventListener("pointerdown", go)
      window.removeEventListener("keydown", go)
    }
  }, [])

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: LIVE_ORDERS_KEY })
  }, [qc])

  const enableDesktopAlerts = useCallback(async () => {
    if (!("Notification" in window)) return false
    const p = await Notification.requestPermission()
    setDesktopAlerts(p as Ctx["desktopAlerts"])
    return p === "granted"
  }, [])

  return (
    <OrdersLiveContext.Provider
      value={{
        orders,
        recent: live.recent ?? [],
        pending: live.pending ?? 0,
        open: live.open ?? orders.length,
        isLoading,
        refresh,
        enableDesktopAlerts,
        desktopAlerts,
      }}
    >
      {children}
    </OrdersLiveContext.Provider>
  )
}
