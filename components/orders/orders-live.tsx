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
import { usePathname, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { ordersLive, type LiveOrders, type Order } from "@/api/orders"
import { unlockAudio } from "@/lib/beep"
import { alarmMuted, startAlarm, stopAlarm } from "@/lib/order-alarm"
import { hasModule, useModules, useOwnerState } from "@/lib/modules"

export const LIVE_ORDERS_KEY = ["orders", "live"] as const

/** How often to ask. A customer is standing at a counter; a minute of latency
 *  is the difference between the app being useful and being decoration. */
const POLL_MS = 10_000


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
  /** New orders nobody has acknowledged yet — the alarm rings while any exist. */
  unseen: Order[]
  /** "Seen": stop the alarm for every order waiting now. */
  acknowledge: () => void
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
      unseen: [],
      acknowledge: () => {},
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

  // With online ordering switched off there is nothing to poll for: no
  // request every ten seconds from every admin page, and no sound.
  // Wait for /auth/me/: while it loads `modules` is null, which hasModule
  // reads as "allow" so a legacy backend never locks anyone out — right for
  // a nav item, wrong for a poller that would fire before the answer lands.
  const { modules, isLoading: modulesLoading } = useModules()
  const ordersOn = !modulesLoading && hasModule(modules, "online_orders")
  /* Who is alerted: employees — the people at the counter. Owners and
     platform superusers still see the badge and the board, but are not rung
     or bannered (an owner's phone at home must not start ringing). */
  const alertMe = useOwnerState() === "employee"

  const { data, isLoading } = useQuery({
    queryKey: LIVE_ORDERS_KEY,
    queryFn: ordersLive,
    enabled: ordersOn,
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

    const fresh = orders.filter(
      (o) => !seen.current!.has(o.id) && o.status === "placed",
    )
    seen.current = ids
    if (fresh.length === 0) return

    // The alarm itself (ringing until "seen") is driven by `unseen` below.
    if (alertMe && permission() === "granted") {
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
  }, [data, orders, alertMe])

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

  /* The alarm. It rings — loud, on a loop — while any order is still
     "placed" and nobody has tapped "seen" for it. Accepting the order stops
     it too. This replaced a single soft chime that a busy counter missed. */
  const [acked, setAcked] = useState<Set<number>>(() => new Set())
  const unseen = alertMe ? orders.filter((o) => o.status === "placed" && !acked.has(o.id)) : []
  const unseenKey = unseen.map((o) => o.id).join(",")
  useEffect(() => {
    if (unseenKey && !alarmMuted()) void startAlarm()
    else stopAlarm()
  }, [unseenKey])
  useEffect(() => () => stopAlarm(), [])
  const acknowledge = useCallback(() => {
    setAcked((prev) => {
      const next = new Set(prev)
      for (const o of orders) if (o.status === "placed") next.add(o.id)
      return next
    })
    stopAlarm()
  }, [orders])

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
        unseen,
        acknowledge,
      }}
    >
      {children}
      <OrderAlarmBanner unseen={unseen} onSeen={acknowledge} />
    </OrdersLiveContext.Provider>
  )
}


/* Across the top of every admin page while an order is waiting unseen. One
   tap anywhere on it is "seen": the ring stops, and the board opens. */
function OrderAlarmBanner({ unseen, onSeen }: { unseen: Order[]; onSeen: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  if (!unseen.length) return null
  const one = unseen[0]
  const label =
    unseen.length === 1
      ? `طلب جديد #${one.id}${one.customer_name ? ` · ${one.customer_name}` : ""}${
          one.fulfilment === "dinein" && one.table_number ? ` · طاولة ${one.table_number}` : ""
        }`
      : `${unseen.length} طلبات جديدة`
  return (
    <button
      type="button"
      dir="rtl"
      onClick={() => {
        onSeen()
        if (pathname !== "/live") router.push("/live")
      }}
      className="fixed inset-x-0 top-0 z-[100] flex animate-pulse items-center justify-center gap-3 bg-red-600 px-4 py-4 text-lg font-bold text-white shadow-lg"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      aria-live="assertive"
    >
      <span aria-hidden>🔔</span>
      <span>{label}</span>
      <span className="rounded-full bg-white/20 px-3 py-1 text-sm">اضغط — تم</span>
    </button>
  )
}
