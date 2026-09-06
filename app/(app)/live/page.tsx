"use client"

/* ==========================================================================
   الطلبات — the counter's board.

   This is a PLACE, not a widget. It used to be a card section pinned above a
   table of past invoices, which meant it vanished when the queue emptied, it
   shared a screen with history nobody needs mid-shift, and it could not be
   left open on the counter monitor as "the board". Drinks somebody is standing
   there waiting for deserve their own screen.

   Laid out as the four states an order passes through, left to right, because
   that is the shape of the work: what has just come in, what has been said yes
   to, what is on the machine, what is on the pass. A barista moves a card one
   column at a time and never has to read a dropdown.
   ========================================================================== */
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bell,
  BellOff,
  Check,
  Coffee,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"

import { orderAdvance, type Order, type OrderStatus } from "@/api/orders"
import { useLiveOrders } from "@/components/orders/orders-live"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/states"
import { NoDataArt } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMe, displayName } from "@/hooks/use-me"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { isMuted, setMuted, playNewOrder } from "@/lib/beep"
import { deliverAndToast } from "@/lib/print/deliver"
import { loadPrintSettings } from "@/lib/print/settings"
import type { ReceiptData } from "@/lib/print/receipt"
import { invalidateSaleData } from "@/lib/sale-queries"
import { cn } from "@/lib/utils"

/** The board, left to right. The last two are today's finished work: they sit
 *  ON the board rather than on a history page because "did #12 go out?" is a
 *  question a barista is asked all day, and because a card that is still here
 *  is one drag away from being put right when it was closed by mistake. */
const COLUMNS: {
  status: OrderStatus
  title: string
  /** What pressing the button on a card in this column does. */
  next: OrderStatus
  action: string
  tone: string
  /** Finished work — resets at the start of each trading day. */
  done?: boolean
}[] = [
  { status: "placed", title: "جديد", next: "accepted", action: "اقبل", tone: "border-destructive/50 bg-destructive/5" },
  { status: "accepted", title: "مقبول", next: "preparing", action: "ابدأ التحضير", tone: "border-primary/40 bg-primary/5" },
  { status: "preparing", title: "قيد التحضير", next: "ready", action: "جاهز", tone: "border-amber-500/40 bg-amber-500/5" },
  { status: "ready", title: "على الكاونتر", next: "collected", action: "تم التسليم", tone: "border-lime/50 bg-lime/5" },
  { status: "collected", title: "تم التسليم", next: "preparing", action: "أعد فتحه", tone: "border-border bg-muted/30", done: true },
  { status: "cancelled", title: "ملغى", next: "preparing", action: "أعد فتحه", tone: "border-border bg-muted/20", done: true },
]

/** How long they have been waiting, and whether that is a problem yet. */
function waited(iso: string): { label: string; late: boolean } {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return { label: "الآن", late: false }
  if (mins < 60) return { label: `${formatNumber(mins)} د`, late: mins >= 10 }
  const h = Math.floor(mins / 60)
  return { label: `${formatNumber(h)} س`, late: true }
}

/** The server's transition table, as the client sees it: every order carries
 *  its own `next_statuses`. Asking the order rather than hard-coding the graph
 *  means a drop can never propose a move the API would refuse. */
function canDrop(o: Order | null, to: OrderStatus): boolean {
  return Boolean(o) && o!.status !== to && (o!.next_statuses ?? []).includes(to)
}

export default function LiveOrdersPage() {
  const { orders, recent, open, isLoading, refresh, enableDesktopAlerts, desktopAlerts } =
    useLiveOrders()
  // One list for the whole board: the four live columns and the two finished
  // ones read from the same array, so a card that moves between them is the
  // same card and not two different renderings of it.
  const board = [...orders, ...recent]
  const qc = useQueryClient()
  const [busy, setBusy] = useState<number | null>(null)
  const [muted, setMutedState] = useState(false)
  /* The card being dragged, and the column it is currently over.
     Held as state (not just in the dataTransfer) because a drop target has to
     decide whether it will ACCEPT the card before the drop — dataTransfer's
     payload is deliberately unreadable during dragover for privacy, so the
     legality check has to be answered from something we already know. */
  const [dragging, setDragging] = useState<Order | null>(null)
  const [over, setOver] = useState<OrderStatus | null>(null)
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const shopName = me?.pharmacy_name?.trim() || "كوب"

  // localStorage does not exist on the server, and reading it during render
  // would hydrate the wrong icon.
  useEffect(() => setMutedState(isMuted()), [])

  async function move(o: Order, status: OrderStatus) {
    setBusy(o.id)
    try {
      await orderAdvance(o.id, status)
      refresh()
      // Collecting an order rings it up as a sale and moves points; leaving
      // `collected` voids that sale and takes the points back. Either way the
      // history and the customer's balance are now stale everywhere.
      if (status === "collected" || o.status === "collected") {
        invalidateSaleData(qc)
      }
      if (status === "accepted") ticket(o)
      toast.success(
        status === "cancelled" ? `أُلغي الطلب #${o.id}` : `طلب #${o.id} · تم`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحديث الطلب")
    } finally {
      setBusy(null)
    }
  }

  /** The barista's paper: what to make, for whom, with the notes. Not a bill —
   *  the customer pays at the counter and gets the receipt there. */
  function ticket(o: Order) {
    const data: ReceiptData = {
      saleId: `#${o.id}`,
      items: (o.items ?? []).map((it) => ({
        name: it.note?.trim() ? `${it.name} (${it.note.trim()})` : it.name,
        quantity: Number(it.quantity),
        unitPrice: it.unit_price,
        lineTotal: it.line_total,
      })),
      total: toNumber(o.total),
      discountedTotal: toNumber(o.cash_total ?? o.total),
      paymentMethod: "cash",
      customerName: o.customer_name || "زبون التطبيق",
      cashierName,
      createdAt: o.created_at,
    }
    void deliverAndToast(
      data,
      shopName,
      loadPrintSettings(),
      me?.pharmacy_logo || "",
      `تذكرة الطلب #${o.id}`,
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الطلبات"
        description="طلبات التطبيق — تتحدّث تلقائياً كل ١٠ ثوانٍ"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {desktopAlerts !== "granted" && desktopAlerts !== "unsupported" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const ok = await enableDesktopAlerts()
                  toast[ok ? "success" : "warning"](
                    ok ? "سنُنبّهك عند وصول طلب جديد" : "المتصفح رفض التنبيهات",
                  )
                }}
              >
                <Bell className="size-4" />
                فعّل التنبيهات
              </Button>
            )}
            {desktopAlerts === "granted" && (
              <span className="hidden items-center gap-1.5 rounded-xl bg-lime/12 px-2.5 py-1.5 text-xs font-semibold text-lime sm:inline-flex">
                <Bell className="size-3.5" />
                التنبيهات مفعّلة
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={!muted}
              onClick={() => {
                const next = !muted
                setMuted(next)
                setMutedState(next)
                // Preview the REAL alert, not a single blip — the point of
                // un-muting is to know what you are agreeing to hear.
                if (!next) playNewOrder()
              }}
              title={muted ? "الصوت مكتوم" : "الصوت مفعّل"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      <p className="hidden px-1 text-xs text-muted-foreground md:block">
        اسحب الطلب من عمود لعمود، أو استخدم الزر على البطاقة. آخر عمودين يبدآن من جديد مع كل يوم عمل.
      </p>

      {desktopAlerts === "denied" && (
        <p className="rounded-2xl border border-dashed px-4 py-2.5 text-xs text-muted-foreground">
          <BellOff className="me-1.5 inline size-3.5" />
          تنبيهات المتصفح محظورة لهذا الموقع. الصوت والعداد على الشريط ما زالا
          يعملان — لتفعيل التنبيهات، اسمح بها من إعدادات الموقع في المتصفح.
        </p>
      )}

      {isLoading && open === 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : open === 0 ? (
        <EmptyState
          art={<NoDataArt />}
          title="ما في طلبات مفتوحة"
          description="أي طلب يوصل من التطبيق بيظهر هون فوراً، مع صوت وتنبيه."
        />
      ) : (
        // Six columns will not fit a laptop in a grid, and wrapping them puts
        // "تم التسليم" underneath "جديد", which breaks the one thing a board
        // is for — left to right IS the workflow. So it scrolls sideways, at
        // a width where a card is still readable.
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {COLUMNS.map((col) => {
            const rows = board.filter((o) => o.status === col.status)
            const accepts = canDrop(dragging, col.status)
            return (
              <section
                key={col.status}
                onDragOver={(e) => {
                  // preventDefault is what MAKES an element a drop target; a
                  // column that will not accept this card simply does not call
                  // it, and the browser shows the "no" cursor for free.
                  if (!accepts) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  if (over !== col.status) setOver(col.status)
                }}
                onDragLeave={(e) => {
                  // Only when the pointer leaves the COLUMN, not when it
                  // crosses from the column onto a card inside it.
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setOver((c) => (c === col.status ? null : c))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const card = dragging
                  setOver(null)
                  setDragging(null)
                  if (!canDrop(card, col.status)) return
                  void move(card!, col.status)
                }}
                className={cn(
                  "flex w-[17rem] shrink-0 flex-col gap-2.5 rounded-3xl p-1.5 transition-colors",
                  col.done && "opacity-90",
                  accepts && "outline-dashed outline-2 outline-offset-2 outline-primary/30",
                  accepts && over === col.status && "bg-primary/10 outline-primary",
                )}
              >
                <header className="flex items-baseline justify-between px-1">
                  <h2 className="font-heading text-sm font-bold">
                    {col.title}
                    {col.done ? (
                      <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">
                        اليوم
                      </span>
                    ) : null}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(rows.length)}
                  </span>
                </header>

                {rows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    —
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex flex-col gap-2.5",
                      // Sixty delivered cups must not push the live columns
                      // off the bottom of the screen.
                      col.done && "max-h-[28rem] overflow-y-auto pe-0.5",
                    )}
                  >
                    {rows.map((o) => {
                    const w = waited(o.created_at)
                    const points = Number(o.beans_spent ?? 0)
                    return (
                      <article
                        key={o.id}
                        draggable
                        onDragStart={(e) => {
                          setDragging(o)
                          e.dataTransfer.effectAllowed = "move"
                          // Firefox refuses to start a drag without payload.
                          e.dataTransfer.setData("text/plain", String(o.id))
                        }}
                        onDragEnd={() => {
                          setDragging(null)
                          setOver(null)
                        }}
                        className={cn(
                          "rounded-2xl border bg-card p-3.5 shadow-sm transition",
                          "cursor-grab active:cursor-grabbing",
                          col.tone,
                          dragging?.id === o.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <b className="font-heading text-sm">
                            #{o.id}
                            {o.customer_name ? (
                              <span className="ms-2 text-xs font-normal text-muted-foreground">
                                {o.customer_name}
                              </span>
                            ) : null}
                          </b>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                              w.late
                                ? "bg-destructive/15 text-destructive"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {w.label}
                          </span>
                        </div>

                        <ul className="mt-2 space-y-0.5 text-[13px]">
                          {(o.items ?? []).map((it) => (
                            <li key={it.id} className="leading-snug">
                              <span className="font-semibold tabular-nums">
                                {Math.round(Number(it.quantity))}×
                              </span>{" "}
                              {it.name}
                              {it.note?.trim() ? (
                                <em className="text-primary"> · {it.note}</em>
                              ) : null}
                            </li>
                          ))}
                        </ul>

                        {o.note?.trim() ? (
                          <p className="mt-2 rounded-xl bg-muted/60 px-2.5 py-1.5 text-[12px]">
                            {o.note}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground">
                            {points > 0
                              ? `نقداً ${formatMoney(Number(o.cash_total ?? o.total))} · نقاط ${formatNumber(points)}`
                              : "الدفع عند الاستلام"}
                          </span>
                          <span className="font-heading text-sm font-bold">
                            {formatMoney(Number(o.cash_total ?? o.total))}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant={col.done ? "secondary" : "default"}
                            className="flex-1"
                            disabled={busy === o.id}
                            onClick={() => void move(o, col.next)}
                          >
                            {busy === o.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : col.done ? (
                              <RotateCcw className="size-4" />
                            ) : col.next === "collected" ? (
                              <Check className="size-4" />
                            ) : (
                              <Coffee className="size-4" />
                            )}
                            {col.action}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label="اطبع التذكرة"
                            onClick={() => ticket(o)}
                          >
                            <Printer className="size-4" />
                          </Button>
                          {!col.done && (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label="ألغِ الطلب"
                              disabled={busy === o.id}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `إلغاء الطلب #${o.id}؟ ستُعاد نقاطه إن استُخدمت.`,
                                  )
                                ) {
                                  return
                                }
                                void move(o, "cancelled")
                              }}
                              className="text-destructive"
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </div>

                      </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

    </div>
  )
}
