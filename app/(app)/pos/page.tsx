"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Check,
  ChartColumn,
  Layers,
  Loader2,
  Minus,
  Package,
  Plus,
  Printer,
  ScanBarcode,
  ShoppingBag,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from "lucide-react"

import { productsList } from "@/api/generated/products/products"
import type { Product } from "@/api/generated/model"
import { colorHexOf } from "@/lib/variant-options"
import {
  salesList,
  salesStats,
  salesUpdate,
  saleItemName,
  type CatalogMed,
  type CatalogVariant,
  type Sale,
  type SalePayload,
} from "@/api/sales"
import { useMe, displayName } from "@/hooks/use-me"
import { submitSale } from "@/lib/offline/submit-sale"
import { clearOfflineCaches } from "@/lib/offline/catalog-cache"
import type { QueuedSale } from "@/lib/offline/queue"
import { type ReceiptData } from "@/lib/print/receipt"
import { deliverReceipt, describeDelivery } from "@/lib/print/deliver"
import { loadPrintSettings, type PrintSettings } from "@/lib/print/settings"
import { PrintSettingsDialog } from "@/components/print/print-settings-dialog"
import { PrintReceiptDialog } from "@/components/print/print-receipt-dialog"
import { useInfiniteList } from "@/hooks/use-infinite-list"
import { usePosCatalog } from "@/hooks/use-pos-catalog"
import { useGlobalScanner } from "@/hooks/use-global-scanner"
import {
  QuickItemsPanel,
  isQuickItem,
} from "@/components/pos/quick-items-panel"
import { useScanAlert } from "@/components/pos/scan-alert"
import { TopupButtons } from "@/components/pos/topup-buttons"
import { QuickCards } from "@/components/pos/quick-cards"
import { CategoryCircles } from "@/components/pos/category-circles"
import { CustomerChips } from "@/components/pos/customer-chips"
import { ManualLineRow } from "@/components/pos/manual-line-row"
import { useCustomersCatalog } from "@/hooks/use-customers-catalog"
import { invalidateSaleData } from "@/lib/sale-queries"
import { useSaleEditLink } from "@/hooks/use-sale-edit-link"
import { useDebounced } from "@/hooks/use-debounced"
import {
  usePosCarts,
  cartTotal,
  type CartLine,
  type CartVariant,
} from "@/hooks/use-pos-carts"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import {
  formatMoney,
  formatNumber,
  sanitizeQtyInput,
  toNumber,
} from "@/lib/format"
import { isMuted, playBeep, setMuted } from "@/lib/beep"
import { cn } from "@/lib/utils"

import { SearchInput } from "@/components/search-input"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { LoadMore } from "@/components/load-more"
import { EntityCombobox, type ComboOption } from "@/components/entity-combobox"
import { ConfirmDelete } from "@/components/confirm-delete"
import { CustomerForm } from "@/components/forms/customer-form"
import { InlineScanner } from "@/components/scan/inline-scanner"
import type { ScanFeedback } from "@/components/scan/scan-dialog"
import { EmptyState, ErrorState } from "@/components/states"
import { NoMedsArt } from "@/components/illustrations"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type Pos = ReturnType<typeof usePosCarts>

/** Snapshot of the cart at checkout — feeds the printed receipt and, when
 *  offline, renders the queued sale without waiting for the server. */
type SaleSnapshot = {
  items: { name: string; quantity: number; unitPrice: string }[]
  total: number
  discountedTotal: number
  isReturn: boolean
  paymentMethod: "cash" | "debt"
  customerName?: string
  /** Stable per checkout — also used to key this sale's single toast. */
  receiptCode?: string
}

type CheckoutInput = {
  body: SalePayload
  snapshot: SaleSnapshot
  /** Print even if auto-print is off — the printer button asked for it. */
  forcePrint?: boolean
  /**
   * Set when this cart is CORRECTING an existing sale rather than ringing a
   * new one — see Cart.editingSaleId. Sends a PATCH, so the sale keeps its id
   * and its receipt number and the server files the old version away.
   */
  editingSaleId?: number
}

/**
 * Print a receipt, and say something useful when the device can't.
 *
 * A browser cannot ask the OS whether a printer exists, so "no printer found"
 * is not a thing we can detect up front. What we can detect is a device with
 * no print pipeline at all — and in that case the customer is still standing
 * at the counter, so we hand the cashier the receipt as a file and tell her
 * where it went instead of failing silently.
 */
/**
 * Print, then fold the result into the sale's OWN toast.
 *
 * A checkout used to raise two: "تم البيع — ₪163.00" and, a beat later, a
 * second one about the receipt. Two stacked toasts for one action read as two
 * things having happened, and the cashier has to parse both while a customer
 * waits. Sonner updates a toast in place when given the same id, so the sale
 * announces itself immediately (that is the part that must never be delayed)
 * and the receipt's fate is written into the same box when it is known.
 */
function printAndAnnounce(
  id: string,
  headline: string,
  kind: "success" | "warning",
  data: ReceiptData,
  pharmacyName: string,
  settings: PrintSettings,
  logoUrl: string,
) {
  void deliverReceipt(data, pharmacyName, settings, logoUrl).then((r) => {
    const d = describeDelivery(r)
    const action = r.fileUrl
      ? { label: "عرض", onClick: () => window.open(r.fileUrl!, "_blank") }
      : undefined
    // A no-printer result is a warning even on a successful sale; everything
    // else keeps the sale's own tone.
    const show =
      d.tone === "warn" ? toast.warning : kind === "warning" ? toast.warning : toast.success
    show(headline, {
      id,
      description: d.description,
      duration: d.duration,
      action,
    })
  })
}

function receiptFromSale(sale: Sale, cashierName: string): ReceiptData {
  return {
    saleId: sale.id,
    receiptCode: sale.receipt_code,
    items: sale.items.map((it) => ({
      name: saleItemName(it),
      quantity: it.quantity,
      unitPrice: it.unit_price,
      lineTotal: it.line_total,
    })),
    total: toNumber(sale.total),
    discountedTotal: toNumber(sale.discounted_total),
    paymentMethod: sale.payment_method,
    isReturn: Boolean(sale.is_return),
    customerName: sale.customer_name,
    cashierName: sale.created_by_name || cashierName,
    createdAt: sale.created_at,
  }
}

function receiptFromQueued(
  snap: SaleSnapshot,
  queued: QueuedSale,
  cashierName: string,
): ReceiptData {
  // The receipt number was minted on the till before the POST, so an offline
  // receipt carries the SAME barcode the sale will have once it syncs. It used
  // to print "مؤقت <uuid>" and no barcode at all, which meant the one receipt
  // most likely to be queried later was the one that couldn't be looked up.
  const receiptCode = queued.payload.receipt_code
  return {
    saleId: receiptCode || `مؤقت ${queued.clientUuid.slice(0, 6)}`,
    receiptCode,
    items: snap.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    total: snap.total,
    discountedTotal: snap.discountedTotal,
    paymentMethod: snap.paymentMethod,
    isReturn: snap.isReturn,
    customerName: snap.customerName,
    cashierName,
    createdAt: new Date(queued.createdAt),
    offline: true,
  }
}

/** Shared checkout (cart panel + table mode). Online → post + print the
 *  receipt; offline/unreachable → queue for auto-sync and print an "unsynced"
 *  copy so the customer still walks away with a receipt. */
/**
 * Carts with a checkout currently in flight.
 *
 * The POS mounts THREE independent `useCheckout` mutations — the page (for the
 * Enter key), the table view's button, and the cart panel's. Each has its own
 * `isPending`, so `disabled={checkout.isPending}` on one button knows nothing
 * about a submit the keyboard already started. Module scope is what makes this
 * guard visible to all three.
 *
 * The stable per-cart client_uuid means a double-submit that slips through is
 * still collapsed server-side; this just stops the pointless second request
 * and the confusing second toast.
 */
/** A digit typed on the page, to seed the last line's quantity field. */
type QtySeed = { digit: string; tick: number } | null

const inFlightCarts = new Set<string>()

function useCheckout(pos: Pos, onDone?: () => void) {
  const qc = useQueryClient()
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "المتجر"
  const pharmacyLogo = me?.pharmacy_logo || ""

  return useMutation({
    mutationFn: async ({
      body,
      snapshot,
      forcePrint,
      editingSaleId,
    }: CheckoutInput) => {
      const key = body.client_uuid ?? ""
      if (key && inFlightCarts.has(key)) {
        throw new Error("جارٍ إتمام البيع — انتظر لحظة")
      }
      if (key) inFlightCarts.add(key)
      try {
        if (editingSaleId != null) {
          // Corrections are NOT queued offline. The offline path exists so a
          // sale can still be RUNG during a cut and reconciled later; a
          // correction has to be applied against the row as the server holds
          // it now — replaying it hours later could overwrite a change made in
          // between, and silently. Better to say so and let the cashier retry.
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            throw new Error("تعديل الفاتورة يحتاج اتصالاً — حاول بعد عودة الإنترنت")
          }
          const res = await salesUpdate(editingSaleId, body)
          return {
            res: { status: "synced" as const, sale: res.data },
            snapshot,
            forcePrint,
            edited: true,
          }
        }
        const res = await submitSale(body, {
          total: snapshot.total,
          discountedTotal: snapshot.discountedTotal,
          isReturn: snapshot.isReturn,
          paymentMethod: snapshot.paymentMethod,
          customerName: snapshot.customerName,
          cashierName,
        })
        return { res, snapshot, forcePrint, edited: false }
      } finally {
        if (key) inFlightCarts.delete(key)
      }
    },
    onSuccess: ({ res, snapshot, forcePrint, edited }) => {
      const settings = loadPrintSettings()
      const wantPrint = forcePrint || settings.autoPrint
      // One toast per checkout, keyed so the printing result can be written
      // into it rather than stacked on top of it.
      const toastId = `sale-${snapshot.receiptCode || Date.now()}`
      if (res.status === "synced") {
        const sale = res.sale
        const headline = edited
          ? `تم تعديل الفاتورة ${sale.receipt_code || sale.id} — ${formatMoney(sale.discounted_total)}`
          : `${sale.is_return ? "تم الإرجاع" : "تم البيع"} — ${formatMoney(sale.discounted_total)}`
        toast.success(headline, { id: toastId, duration: 3500 })
        if (wantPrint) {
          printAndAnnounce(
            toastId,
            headline,
            "success",
            receiptFromSale(sale, cashierName),
            pharmacyName,
            settings,
            pharmacyLogo,
          )
        }
        invalidateSaleData(qc)
      } else {
        const headline = "لا يوجد اتصال — حُفظت الفاتورة وستُزامن تلقائياً"
        toast.warning(headline, { id: toastId, duration: 4000 })
        if (wantPrint) {
          // The barcode IS printed here: the number came from the till, not
          // the server, so it is already final.
          printAndAnnounce(
            toastId,
            headline,
            "warning",
            receiptFromQueued(snapshot, res.queued, cashierName),
            pharmacyName,
            settings,
            pharmacyLogo,
          )
        }
      }
      pos.closeCart(pos.activeId)
      onDone?.()
    },
    onError: (e) => {
      const err = e as Error & { status?: number; data?: unknown }
      const msg = err?.message ?? ""

      // The server rejected one or more product ids — a dead line left in the
      // saved cart (a product deleted/re-imported, or an old cached id). Find
      // EXACTLY which lines it rejected and drop just those, so the rest of the
      // cart can check out. `items[i]` maps 1:1 to the active cart's lines[i].
      const lines = pos.active?.lines ?? []
      const badKeys = new Set<string>()
      const data = err?.data as { items?: Array<{ product?: unknown }> } | undefined
      if (Array.isArray(data?.items)) {
        data!.items.forEach((it, i) => {
          if (it && it.product && lines[i]) badKeys.add(lines[i].key)
        })
      }
      // Fallback: pull ids straight out of the "Invalid pk \"15\"" message.
      const ids = new Set<number>()
      for (const m of msg.matchAll(/Invalid pk\s*"?(\d+)"?/gi)) ids.add(Number(m[1]))
      for (const l of lines) {
        if (l.medicationId != null && ids.has(l.medicationId)) badKeys.add(l.key)
      }

      if (badKeys.size > 0) {
        for (const key of badKeys) pos.removeLine(key)
        void clearOfflineCaches()
        qc.invalidateQueries({ queryKey: ["pos-catalog"] })
        qc.invalidateQueries({ queryKey: ["catalog-version"] })
        toast.error(
          `أُزيل ${badKeys.size} صنف لم يعد موجوداً من السلة — راجع السلة وأعد إتمام البيع`,
        )
        return
      }
      toast.error(msg || "تعذر إتمام البيع")
    },
  })
}

function buildPayload(pos: Pos): CheckoutInput | null {
  const active = pos.active
  if (!active || active.lines.length === 0) {
    toast.error("السلة فارغة")
    return null
  }
  const total = cartTotal(active)
  /**
   * A discount counts ONLY if the cashier actually set one.
   *
   * `discounted` doubles as a display field: when nobody has touched it, an
   * effect keeps it mirroring the cart total. Effects run AFTER the render
   * that changed the lines — and child effects before parent ones — so that
   * mirror is always one render behind. Treating it as an override meant a
   * line corrected to ₪12 was sent with discounted_total ₪10: the invoice
   * showed a 12.00 line struck through by a 10.00 total, and 10.00 is what the
   * shop was paid.
   *
   * Derived state must never override the thing it is derived from. If the
   * cashier has not typed an amount, the line sum IS the amount.
   */
  const hasDiscount =
    Boolean(active.discountTouched) && active.discounted.trim() !== ""
  const discounted = hasDiscount ? toNumber(active.discounted) : null
  /* كوب attaches a customer to ANY sale — that is how points accrue on a cash
     coffee, which is the whole loyalty premise — but it never REQUIRES one.
     Everything here is paid at the counter, so the method is always cash; a
     cart parked from before the debt switch was removed still says "debt", and
     is corrected here rather than being sent as one. */
  const paymentMethod = "cash" as const
  // A correction keeps the ORIGINAL sale's identity. Minting a new
  // client_uuid or receipt code for it would be meaningless at best (the
  // server refuses to move either) and confusing at worst, so neither is sent.
  const editingSaleId = active.editingSaleId
  const body: SalePayload = {
    // Stable for this cart across every attempt — see Cart.saleUuid. Without
    // it, a retry becomes a second sale instead of being collapsed server-side.
    client_uuid: editingSaleId != null ? undefined : pos.ensureSaleUuid(),
    // Printed as the barcode. Minted here, not server-side: an offline sale
    // prints before the server knows it exists, and that paper has to stay
    // findable.
    receipt_code:
      editingSaleId != null ? undefined : pos.ensureReceiptCode(),
    // On a correction this is sent even when it is null, so switching a credit
    // sale back to cash actually detaches the customer.
    customer:
      active.customerId ?? (editingSaleId != null ? null : undefined),
    payment_method: paymentMethod,
    // Sent even when blank on a correction, so clearing a note actually clears it.
    note: active.note?.trim() || (editingSaleId != null ? "" : undefined),
    is_return: active.isReturn || undefined,
    items: active.lines.map((l) => ({
      product: l.medicationId ?? undefined,
      variant: l.variantId ?? undefined,
      // Required by the API for a free-text line (top-up): with no product id
      // the name IS the item. Harmless on catalogue lines.
      medication_name: l.medicationId == null ? l.name : undefined,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      // Only when it actually differs — the backend nulls a no-op override
      // anyway, but sending it is what makes the discount visible later.
      original_unit_price:
        l.basePrice != null && toNumber(l.basePrice) !== toNumber(l.unitPrice)
          ? l.basePrice
          : undefined,
      // Sent even when blank on a correction, so clearing a note clears it.
      note: l.note?.trim() || (editingSaleId != null ? "" : undefined),
    })),
    discounted_total:
      discounted != null && discounted !== total
        ? discounted.toFixed(2)
        : undefined,
    // Points the customer is putting towards this sale. Only ever sent with a
    // customer attached — points belong to a person, not to a till.
    beans_spent:
      active.customerId != null && (active.beansSpent ?? 0) > 0
        ? active.beansSpent
        : undefined,
  }
  const snapshot: SaleSnapshot = {
    receiptCode: body.receipt_code || active.editingReceipt || "",
    items: active.lines.map((l) => ({
      /* The variant and the note ride ON the name, because that is the one
         string every receipt renderer already prints. A note that stops at the
         database never reaches the person making the drink. */
      name: [
        l.variantLabel ? `${l.name} — ${l.variantLabel}` : l.name,
        l.note?.trim() ? `(${l.note.trim()})` : "",
      ].filter(Boolean).join(" "),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    total,
    discountedTotal: discounted != null ? discounted : total,
    isReturn: Boolean(active.isReturn),
    paymentMethod,
    customerName: active.customerName || undefined,
  }
  return { body, snapshot, editingSaleId }
}

/* ── Parked-carts tabs ─────────────────────────────────────────────── */
function CartTabs({ pos }: { pos: Pos }) {
  const [toClose, setToClose] = useState<string | null>(null)
  const closable = pos.carts.length > 1

  function requestClose(id: string) {
    const cart = pos.carts.find((c) => c.id === id)
    // Empty carts (the misclicks) close instantly; loaded ones ask first.
    if (!cart || cart.lines.length === 0) {
      pos.closeCart(id)
      return
    }
    setToClose(id)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pos.carts.map((c, i) => {
        const isActive = c.id === pos.activeId
        return (
          <span
            key={c.id}
            className={cn(
              "inline-flex items-center overflow-hidden rounded-full transition-all",
              isActive
                ? "bg-ink text-white shadow-md shadow-ink/25"
                : "bg-muted text-muted-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => pos.setActiveId(c.id)}
              className={cn(
                "py-1.5 ps-3 text-xs font-semibold",
                closable ? "pe-1" : "pe-3",
                !isActive && "hover:text-foreground",
              )}
            >
              {c.isReturn && (
                <Undo2 className="me-1 inline size-3 text-destructive" />
              )}
              {c.customerName || `سلة ${i + 1}`}
              {c.lines.length > 0 && (
                <span className={isActive ? "text-lime" : "text-primary"}>
                  {" "}
                  · {formatMoney(cartTotal(c))}
                </span>
              )}
            </button>
            {closable && (
              <button
                type="button"
                onClick={() => requestClose(c.id)}
                aria-label="إغلاق السلة"
                className={cn(
                  "grid size-5 place-items-center rounded-full transition me-1.5",
                  isActive
                    ? "text-white/50 hover:bg-white/15 hover:text-white"
                    : "text-muted-foreground/50 hover:bg-foreground/10 hover:text-foreground",
                )}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        )
      })}
      <button
        type="button"
        data-tour="pos-new-cart"
        onClick={pos.parkAndNew}
        title="بيع جديد (تعليق الحالي)"
        className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
      >
        <Plus className="size-4" />
      </button>
      <ConfirmDelete
        open={toClose != null}
        onOpenChange={(o) => !o && setToClose(null)}
        onConfirm={() => {
          if (toClose) pos.closeCart(toClose)
          setToClose(null)
        }}
        title="إغلاق السلة"
        description="تحتوي هذه السلة على أصناف — سيتم تفريغها وإغلاقها."
        confirmLabel="إغلاق"
      />
    </div>
  )
}

/** Sale ⇄ return switch — flips the whole cart into refund mode. */
function ReturnToggle({ pos }: { pos: Pos }) {
  const active = pos.active
  if (!active) return null
  return (
    <button
      type="button"
      data-tour="pos-return"
      onClick={() =>
        pos.patchActive({ isReturn: !active.isReturn, payment: "cash" })
      }
      aria-pressed={active.isReturn}
      title={active.isReturn ? "العودة لوضع البيع" : "وضع الإرجاع"}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
        active.isReturn
          ? "bg-destructive text-white shadow-md shadow-destructive/30"
          : "bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      <Undo2 className="size-3.5" />
      {active.isReturn ? "وضع الإرجاع" : "إرجاع"}
    </button>
  )
}

/* ── Customer + payment + discount controls ────────────────────────── */
function SaleControls({ pos }: { pos: Pos }) {
  const { active, patchActive } = pos
  const [custFormOpen, setCustFormOpen] = useState(false)
  // Instant local customer search (Redis-cached catalogue).
  const { fetcher: customerFetcher, customers } = useCustomersCatalog()
  const total = active ? cartTotal(active) : 0

  // Keep the discount field showing the live total until the cashier edits it.
  //
  // One exception, and it is a money one. A CORRECTION opens with the amount
  // the original invoice was settled at, so reopening a ₪90-on-₪100 sale to
  // fix a name does not silently re-charge ₪100. That pin has to let go the
  // moment the LINES change: ₪10 agreed for one item is not the amount for
  // that item plus eight more, and holding it there charged ₪10 for ₪121 of
  // goods with nothing on screen to say so.
  //
  // Only the ORIGINAL sale's amount unpins this way. An amount the cashier
  // types during the correction is hers and is never overwritten.
  useEffect(() => {
    if (!active) return
    const linesMoved =
      active.discountFromOriginal &&
      active.editingBaseTotal != null &&
      Math.abs(total - active.editingBaseTotal) > 0.005
    if (active.discountTouched && !linesMoved) return
    const t = total.toFixed(2)
    if (active.discounted !== t || linesMoved) {
      patchActive({
        discounted: t,
        discountTouched: false,
        discountFromOriginal: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    total,
    active?.id,
    active?.discountTouched,
    active?.discountFromOriginal,
    active?.editingBaseTotal,
  ])

  if (!active) return null

  return (
    <div className="space-y-2.5">
      {/* No نقدي/دين switch: a café is paid at the counter. The toggle spent
          half the panel asking a question with one answer, and dragged a
          "customer required" rule behind it that could block a sale. */}

      {/* Customer — always offered, because that is how points accrue on a
          cash coffee. Never required. */}
      {!active.isReturn && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-1.5 duration-200">
          {/* The faces are a shortcut to picking someone, so once someone IS
              picked they are just a row of noise above the answer. Clearing
              the field with its × brings them back. */}
          {active.customerId == null && (
            <CustomerChips
              value={active.customerId}
              onPick={(c) =>
                patchActive({
                  customerId: c ? c.id : null,
                  customerName: c ? c.name : "",
                })
              }
            />
          )}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <EntityCombobox
                value={active.customerId}
                label={active.customerName}
                onChange={(opt) =>
                  patchActive({
                    customerId: opt?.id ?? null,
                    customerName: opt?.label ?? "",
                  })
                }
                fetcher={customerFetcher}
                /* The catalogue already has the face, so a cart reopened with a
                   customer on it shows it without waiting for the list to be
                   opened once. */
                avatar={
                  customers?.find((c) => c.id === active.customerId)?.avatar || undefined
                }
                placeholder="اربط الطلب بزبون (لجمع النقاط)"
                searchPlaceholder="ابحث بالاسم أو الهاتف…"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustFormOpen(true)}
              aria-label="زبون جديد"
              title="زبون جديد"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15"
            >
              <UserPlus className="size-4.5" />
            </button>
          </div>
        </div>
      )}

      {/* This slot used to hold a second "total after discount" field, which
          said the same thing as the الإجمالي row right below it — and the two
          could disagree while the cashier typed. The total is editable in
          place down there; this is now the one thing the till had no way to
          record: what the customer actually asked for. */}
      <Input
        placeholder="ملاحظة على الطلب (بدون سكر، تيك أواي…)"
        className="text-start"
        value={active.note ?? ""}
        onChange={(e) => patchActive({ note: e.target.value })}
      />
      <CustomerForm
        open={custFormOpen}
        onOpenChange={setCustFormOpen}
        onSaved={(c) =>
          patchActive({ customerId: c.id, customerName: c.name })
        }
      />
    </div>
  )
}

/** Points that make one shekel. Mirrors POINTS_PER_ILS on the server; the
 *  server is the authority and re-clamps whatever the till sends. */
const POINTS_PER_ILS = 10

/**
 * "The customer says use my points."
 *
 * Only appears when a customer is attached AND has a balance, because a row
 * that is empty nine times out of ten is a row the cashier learns to ignore.
 * One tap applies the most that can be applied; the amount stays editable for
 * "just take ten shekels off it".
 */
function PointsRow({ pos }: { pos: Pos }) {
  const { customers } = useCustomersCatalog()
  const active = pos.active
  if (!active || active.customerId == null || active.isReturn) return null

  // The catalogue is undefined until the first fetch lands. A cashier who
  // opens the till and selects a customer within that window must not crash
  // the whole POS over a loyalty row.
  const customer = (customers ?? []).find((c) => c.id === active.customerId)
  const balance = customer?.beans ?? 0
  if (balance <= 0) return null

  const total = cartTotal(active)
  // Bounded by the balance AND the bill: points cannot buy more than the
  // coffee costs. Floor, never round up.
  const maxUsable = Math.min(balance, Math.floor(total * POINTS_PER_ILS))
  const spending = Math.min(active.beansSpent ?? 0, maxUsable)
  const worth = (spending / POINTS_PER_ILS).toFixed(2)

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed px-4 py-2.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium">نقاط الزبون</span>
        <span className="text-xs text-muted-foreground">
          {balance} نقطة · تساوي {(balance / POINTS_PER_ILS).toFixed(2)} ₪
        </span>
      </div>
      {spending > 0 ? (
        <button
          type="button"
          onClick={() => pos.patchActive({ beansSpent: 0 })}
          className="rounded-xl bg-emerald-600/15 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          title="اضغط للإلغاء"
        >
          − {worth} ₪ ({spending} نقطة) ✕
        </button>
      ) : (
        <button
          type="button"
          disabled={maxUsable <= 0}
          onClick={() => pos.patchActive({ beansSpent: maxUsable })}
          className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          استخدم {maxUsable} نقطة
        </button>
      )}
    </div>
  )
}

function TotalRow({
  pos,
  onSubmitSale,
}: {
  pos: Pos
  onSubmitSale?: () => void
}) {
  const active = pos.active
  if (!active) return null
  const total = cartTotal(active)
  // Same rule as buildPayload: an untouched field is a MIRROR of the total,
  // and a mirror that is one render stale must not be shown as a discount.
  const discounted =
    active.discountTouched && active.discounted.trim()
      ? toNumber(active.discounted)
      : null
  return (
    <div className="flex flex-col gap-2">
    <PointsRow pos={pos} />
    <div className="flex items-baseline justify-between rounded-2xl bg-muted/60 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">الإجمالي</span>
      <span className="flex items-baseline gap-2 font-heading text-2xl font-bold">
        {discounted != null && discounted !== total && (
          <span className="text-sm text-muted-foreground line-through">
            {formatMoney(total)}
          </span>
        )}
        {/* Editable: the cashier rounds the bill in front of the customer.
            Writing here sets the cart's discounted total, which the sale
            already stores alongside the un-discounted one. */}
        <MoneyEditor
          value={discounted != null ? discounted : total}
          edited={discounted != null && discounted !== total}
          title="اضغط لتعديل الإجمالي"
          className="h-9 w-28 text-xl"
          onCommit={(v) =>
            pos.patchActive({
              discounted: v.toFixed(2),
              discountTouched: true,
              discountFromOriginal: false,
            })
          }
          onSubmitSale={onSubmitSale}
        />
      </span>
    </div>
    </div>
  )
}

function CheckoutButtons({
  pos,
  checkout,
}: {
  pos: Pos
  checkout: ReturnType<typeof useCheckout>
}) {
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "المتجر"
  const pharmacyLogo = me?.pharmacy_logo || ""
  const active = pos.active
  // Nothing blocks a sale on a customer any more: points are a bonus, not a
  // gate, and a queue does not wait while a name is typed in.
  const needsCustomer = false
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-tour="pos-checkout"
        onClick={() => {
          const input = buildPayload(pos)
          if (input) checkout.mutate(input)
        }}
        disabled={
          checkout.isPending ||
          !active ||
          active.lines.length === 0 ||
          needsCustomer
        }
        className={cn(
          "flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl font-heading text-base font-bold transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50",
          active?.isReturn
            ? "bg-destructive text-white shadow-lg shadow-destructive/30"
            : "bg-lime text-lime-foreground shadow-lg shadow-lime/30",
        )}
      >
        {checkout.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : active?.isReturn ? (
          <Undo2 className="size-5" />
        ) : (
          <ShoppingBag className="size-5" />
        )}
        {active?.editingSaleId != null
          ? "حفظ التعديل"
          : active?.isReturn
            ? "إتمام الإرجاع"
            : "إتمام البيع"}
      </button>
      {/* Print the cart BEFORE it is a sale — the customer asks "how much?"
          and wants it on paper, or the cashier wants to check the list against
          the trolley. Deliberately does not complete or alter the sale. */}
      {active && active.lines.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const input = buildPayload(pos)
            if (input) checkout.mutate({ ...input, forcePrint: true })
          }}
          disabled={checkout.isPending || needsCustomer}
          title="إتمام البيع وطباعة الفاتورة"
          aria-label="إتمام البيع وطباعة الفاتورة"
          className="grid size-13 shrink-0 place-items-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
        >
          <Printer className="size-5" />
        </button>
      )}
      {active && active.lines.length > 0 && (
        <button
          type="button"
          onClick={() => pos.closeCart(pos.activeId)}
          title="إلغاء هذه السلة"
          className="grid size-13 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive transition hover:bg-destructive/15"
        >
          <Trash2 className="size-5" />
        </button>
      )}
    </div>
  )
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

function formatQty(n: number): string {
  return String(roundQty(n))
}

// A keystroke burst this long, arriving at scanner speed, is a barcode — not a
// human quantity. Matches the global scanner's thresholds.
const SCAN_MIN_LEN = 3
const SCAN_MAX_GAP = 80 // ms between keys that still counts as one burst

/** Quantity control: ± steppers and a free decimal field.
 *  A value of 0 (or blank) removes the line.
 *
 *  When `focusSignal` changes, the field is focused + selected so the cashier
 *  can immediately type the new quantity. It stays scanner-safe: a fast barcode
 *  burst typed while it's focused is redirected to `onScanBurst` (and never
 *  lands in the quantity), and a plain Enter fires `onSubmitSale`. */
export function QtyEditor({
  value,
  onChange,
  focusSignal,
  seedDigit,
  onScanBurst,
  onSubmitSale,
}: {
  value: number
  onChange: (q: number) => void
  focusSignal?: number
  /** A digit the cashier typed on the page, which should start this field's
   *  value rather than be swallowed by the focus change. */
  seedDigit?: string
  onScanBurst?: (code: string) => void
  onSubmitSale?: () => void
}) {
  const [text, setText] = useState(formatQty(value))
  const inputRef = useRef<HTMLInputElement>(null)
  // Burst tracker: chars since the last idle gap, when the last key landed, and
  // the field value before the burst (restored if it turns out to be a scan).
  const burst = useRef({ chars: "", last: 0, base: "" })
  useEffect(() => {
    setText(formatQty(value))
  }, [value])
  // Auto-focus + select on demand — desktop/keyboard only, so we never pop the
  // on-screen keyboard on a touch device.
  useEffect(() => {
    if (focusSignal === undefined) return
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)")?.matches === false
    )
      return
    const el = inputRef.current
    if (!el) return
    el.focus()
    if (seedDigit) {
      // Seeded: the digit the cashier already pressed becomes the value, and
      // the caret goes to the END so the next keystroke appends ("3" then "5"
      // = 35, not 5). Prime the burst tracker with it too, so a barcode that
      // arrived this way is still recognised complete at Enter.
      setText(seedDigit)
      burst.current = { chars: seedDigit, last: Date.now(), base: formatQty(value) }
      requestAnimationFrame(() => {
        const len = el.value.length
        try {
          el.setSelectionRange(len, len)
        } catch {
          /* number inputs in some browsers reject setSelectionRange */
        }
      })
    } else {
      el.select()
    }
    // seedDigit is read at focus time only; focusSignal is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal])
  function commit() {
    const raw = text.trim()
    // Blank means "take this line off the sale" — that is deliberate and
    // documented above. A half-typed "." is NOT the same thing: it used to
    // parse to NaN, fall into the same branch, and delete the line. Put the
    // previous quantity back instead.
    if (raw === "") {
      onChange(0)
      return
    }
    const n = parseFloat(raw)
    if (!isFinite(n)) {
      setText(formatQty(value))
      return
    }
    onChange(n <= 0 ? 0 : roundQty(n))
  }
  function onKeyDown(e: { key: string; preventDefault: () => void }) {
    const now = Date.now()
    const b = burst.current
    // + / − nudge THIS line, while the field is focused.
    //
    // The page-level handler for these keys bails out the moment any field
    // has focus — and after a scan this field is exactly what has focus, so
    // pressing + did nothing at all. That is the one moment a cashier reaches
    // for it: item scanned, "make it three".
    if (e.key === "+" || e.key === "-") {
      e.preventDefault()
      b.chars = ""
      b.base = ""
      const current = parseFloat(text.trim())
      const from = isFinite(current) ? current : value
      const next = Math.max(0, roundQty(from + (e.key === "+" ? 1 : -1)))
      setText(formatQty(next))
      onChange(next)
      return
    }
    if (e.key === "F2") {
      // Bank what is typed, then LET IT THROUGH. F2 is handled once, globally
      // (useGlobalScanner), so it works from anywhere on the page; this field
      // only has to make sure the receipt prints the quantity on screen rather
      // than the one from a keystroke ago. No preventDefault, deliberately.
      commit()
      return
    }
    if (e.key === "Enter") {
      const code = b.chars
      const base = b.base
      b.chars = ""
      b.base = ""
      b.last = 0
      // A fast, long burst ending in Enter is a scanned barcode → hand it to the
      // scan handler and undo any digits that leaked into the field.
      if (onScanBurst && code.length >= SCAN_MIN_LEN) {
        e.preventDefault()
        setText(base)
        onScanBurst(code)
        return
      }
      // Otherwise it's a human Enter → keep the typed quantity, complete the sale.
      e.preventDefault()
      commit()
      onSubmitSale?.()
      return
    }
    if (e.key.length === 1) {
      const gap = now - b.last
      if (b.chars === "" || gap >= SCAN_MAX_GAP) {
        // A slow keystroke starts a fresh sequence, so human typing never
        // accumulates into a "scan" — only a real burst reaches SCAN_MIN_LEN.
        b.chars = e.key
        b.base = text
      } else {
        b.chars += e.key
      }
      b.last = now
      // Not prevented: the char flows into the field; a scan is reverted at Enter.
    }
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(roundQty(value + 1))}
          className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary active:scale-90"
          aria-label="زيادة"
        >
          <Plus className="size-3.5" />
        </button>
        <input
          ref={inputRef}
          value={text}
          // Numbers only — fractions allowed (0.5 kg of tomatoes is a real
          // sale), text never. See sanitizeQtyInput: a letter reaching
          // commit() becomes NaN, which this component treats as 0, which
          // deletes the line. One mistyped key must not remove an item from
          // the customer's basket.
          onChange={(e) => setText(sanitizeQtyInput(e.target.value))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          className="h-7 w-12 rounded-lg border bg-card text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="الكمية"
        />
        <button
          type="button"
          onClick={() => onChange(roundQty(value - 1))}
          className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground active:scale-90"
          aria-label="إنقاص"
        >
          <Minus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── Cart line row (newest first, pops in on mount) ────────────────── */
function CartLineRow({
  line,
  pos,
  focusSignal,
  seedDigit,
  onScanBurst,
  onSubmitSale,
}: {
  line: CartLine
  pos: Pos
  focusSignal?: number
  seedDigit?: string
  onScanBurst?: (code: string) => void
  onSubmitSale?: () => void
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 slide-in-from-top-1 flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 duration-300">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.name}</p>
        {line.variantLabel ? (
          <p className="truncate text-[11px] font-semibold text-primary">
            {line.variantLabel}
          </p>
        ) : null}
        {/* The note has to be READABLE in the cart, not just stored. A cashier
            reads the order back to the customer off this list. */}
        {line.note?.trim() ? (
          <p className="truncate text-[11px] text-warning-foreground">
            ⌁ {line.note}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {formatMoney(line.unitPrice)}
        </p>
      </div>
      <QtyEditor
        value={line.quantity}
        onChange={(q) => pos.setQuantity(line.key, q)}
        focusSignal={focusSignal}
        seedDigit={seedDigit}
        onScanBurst={onScanBurst}
        onSubmitSale={onSubmitSale}
      />
      <span className="w-16 text-end text-sm font-bold tabular-nums">
        {formatMoney(toNumber(line.unitPrice) * line.quantity)}
      </span>
      <button
        type="button"
        onClick={() => pos.removeLine(line.key)}
        className="text-muted-foreground/60 transition hover:text-destructive"
        aria-label="حذف"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/* ── The cart panel (desktop column + mobile sheet) ────────────────── */
function CartPanel({
  pos,
  onDone,
  totalOnTop = false,
  onScanCode,
  defaultScanning = false,
  onScanBurst,
  onSubmitSale,
  qtySeed,
}: {
  pos: Pos
  onDone?: () => void
  totalOnTop?: boolean
  /** When set, a camera toggle lets you scan straight into this cart. */
  onScanCode?: (code: string) => Promise<ScanFeedback>
  /** Open with the camera already running (search-bar scan shortcut). */
  defaultScanning?: boolean
  /** Keyboard-wedge burst captured inside the quantity field → add to cart. */
  onScanBurst?: (code: string) => void
  /** Plain Enter in the quantity field → complete the sale. */
  onSubmitSale?: () => void
  qtySeed?: QtySeed
}) {
  const [scanning, setScanning] = useState(defaultScanning)
  const checkout = useCheckout(pos, onDone)
  const active = pos.active
  if (!active) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        {onScanCode && (
          <button
            type="button"
            onClick={() => setScanning((s) => !s)}
            aria-pressed={scanning}
            title={scanning ? "إيقاف الكاميرا" : "مسح متواصل"}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full transition",
              scanning
                ? "bg-lime text-lime-foreground shadow-md shadow-lime/30"
                : "bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <ScanBarcode className="size-4.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <CartTabs pos={pos} />
        </div>
        <ReturnToggle pos={pos} />
      </div>

      {active.isReturn && (
        <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-2 rounded-2xl bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive duration-200">
          <Undo2 className="size-4 shrink-0" />
          وضع الإرجاع — المخزون سيُعاد والمبلغ سيُخصم من المبيعات
        </div>
      )}

      {/* Live camera: scan → line pops into the list right below. */}
      {onScanCode && scanning && (
        <InlineScanner onDetect={onScanCode} className="h-[30dvh] shrink-0" />
      )}

      {totalOnTop && <TotalRow pos={pos} onSubmitSale={onSubmitSale} />}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {active.lines.length === 0 && (
          <div className="grid place-items-center rounded-2xl bg-muted/50 py-10 text-center text-sm text-muted-foreground">
            <ShoppingBag className="mb-2 size-7 opacity-40" />
            {scanning ? "وجّه الكاميرا نحو باركود" : "اضغط على منتج لإضافته"}
          </div>
        )}
        {[...active.lines].reverse().map((l) => (
          <CartLineRow
            key={l.key}
            line={l}
            pos={pos}
            focusSignal={
              l.key === pos.lastAddedKey
                ? (qtySeed?.tick ?? pos.addTick)
                : undefined
            }
            seedDigit={l.key === pos.lastAddedKey ? qtySeed?.digit : undefined}
            onScanBurst={onScanBurst}
            onSubmitSale={onSubmitSale}
          />
        ))}
      </div>

      <div className="space-y-2.5 border-t border-border/70 pt-3">
        <SaleControls pos={pos} />
      </div>

      <div className="space-y-2">
        {!totalOnTop && <TotalRow pos={pos} onSubmitSale={onSubmitSale} />}
        <CheckoutButtons pos={pos} checkout={checkout} />
      </div>
    </div>
  )
}

/* ── CatalogItem tile: one tap adds it to the cart ─────────────────────── */
function ProductTile({
  med,
  onAdd,
}: {
  med: Product
  onAdd: (m: Product) => void
}) {
  // DRF serialises DecimalField as a string, so this arrived as
  // `string | number` and every `stock <= 5` was relying on JS
  // coercion. Coerce once, here.
  const stock = Number(med.stock ?? 0)
  const variantCount =
    (med as unknown as { variants?: unknown[] }).variants?.length ?? 0
  const img = (med as unknown as { image?: string }).image
  return (
    <button
      type="button"
      onClick={() => onAdd(med)}
      className="pos-tile group text-start"
    >
      {/* The photo is the tile, not a stamp in the corner of it. A cashier
          picking a drink at speed recognises the picture long before they read
          the name, so it gets the whole card and the text sits on a scrim over
          it — dark enough that white stays legible on any photo. */}
      <Card className="card-interactive relative flex aspect-[4/5] h-full flex-col justify-end gap-0 overflow-hidden p-0 transition group-active:scale-[0.97]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="bg-brand-soft absolute inset-0 grid place-items-center">
            <Package className="size-10 text-primary/40" />
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/95 via-card/25 via-40% to-transparent" />
        <span
          className={`pill absolute end-2 top-2 px-2 py-0.5 text-[10px] backdrop-blur-sm ${
            stock <= 0 ? "pill-danger" : stock <= 5 ? "pill-warning" : "pill-neutral"
          }`}
        >
          {formatNumber(stock)}
        </span>
        {variantCount > 0 && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-foreground ring-1 ring-border backdrop-blur-sm">
            <Layers className="size-3" />
            {formatNumber(variantCount)} أنواع
          </span>
        )}
        <div className="relative px-3 pb-3 pt-2">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
            {med.name}
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-heading text-base font-bold text-primary">
              {formatMoney(med.price)}
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary backdrop-blur-sm transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Plus className="size-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </button>
  )
}

/* ── Table mode: scan-first, one big live table ────────────────────── */
/**
 * An inline money field that looks like text until you touch it.
 *
 * Used for the line total and the sale total. Both are numbers the cashier
 * negotiates out loud ("make it 10 for the two"), so they have to be typeable
 * where they are READ — not behind a discount field somewhere else.
 *
 * Same numeric-only rule as the quantity: letters can never land, and a
 * half-typed "." reverts rather than committing nonsense.
 */
function MoneyEditor({
  value,
  onCommit,
  edited = false,
  className,
  title,
  onSubmitSale,
}: {
  value: number
  onCommit: (v: number) => void
  /** Show it as changed-from-catalogue. */
  edited?: boolean
  className?: string
  title?: string
  onSubmitSale?: () => void
}) {
  const [text, setText] = useState("")
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setText(value.toFixed(2))
  }, [value, editing])

  function commit() {
    setEditing(false)
    const raw = text.trim()
    const n = parseFloat(raw)
    if (raw === "" || !isFinite(n) || n < 0) {
      setText(value.toFixed(2)) // nonsense → put the number back
      return
    }
    if (Math.abs(n - value) > 0.004) onCommit(Number(n.toFixed(2)))
  }

  /**
   * Enter and F2 must bank the typed amount BEFORE they finish the sale.
   *
   * This used to only blur, and rely on the blur handler to commit. Whether
   * the amount survived then depended on the order two handlers happened to
   * run in — so a cashier who typed a haggled price and hit Enter without
   * clicking away could ring the OLD price, with the new one still on screen.
   * Committing here, first, removes the race entirely.
   */
  function commitThen(run?: () => void) {
    commit()
    run?.()
  }

  return (
    <input
      value={text}
      title={title}
      onFocus={(e) => {
        setEditing(true)
        e.currentTarget.select()
      }}
      onChange={(e) => setText(sanitizeQtyInput(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
          commitThen(onSubmitSale)
          return
        }
        if (e.key === "F2") {
          // Bank the amount, then let F2 reach the global handler that prints.
          commitThen()
          return
        }
        if (e.key === "Escape") {
          setText(value.toFixed(2))
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      inputMode="decimal"
      dir="ltr"
      aria-label="المبلغ"
      className={cn(
        // Deliberately the SAME control as the quantity field next to it —
        // same height, border, radius and focus ring. A full-width borderless
        // input read as a broken text box, and made the row look like a form
        // rather than a receipt.
        "h-7 w-20 rounded-lg border bg-card text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary/30",
        edited && "border-primary/50 text-primary",
        className,
      )}
    />
  )
}

/**
 * The النوع (unit) cell: قطعة, or whichever pack this line is set to.
 *
 * Only interactive when the product actually HAS packs. Products without them
 * — most of the catalogue — show a plain "قطعة" rather than a button that
 * opens a dialog with one option in it.
 */
function PosPageInner() {
  const pos = usePosCarts()
  // `/pos?edit=<id>` — the pencil on a sale lands here and opens it as a cart.
  useSaleEditLink(pos.openSaleForEdit)
  const pageCheckout = useCheckout(pos)
  // Complete the active cart's sale (fired by a bare Enter, or Enter from the
  // auto-focused quantity field). Silent no-op on an empty cart so a stray
  // Enter never nags the cashier.
  const submitActiveSale = (forcePrint = false) => {
    if (pageCheckout.isPending) return
    if (!pos.active || pos.active.lines.length === 0) return
    const input = buildPayload(pos)
    if (input) pageCheckout.mutate(forcePrint ? { ...input, forcePrint } : input)
  }

  /**
   * Ask for a checkout on the NEXT render, not this instant.
   *
   * A field that finishes the sale has to bank its text first, and banking it
   * is a React state update — which does not land until the component
   * re-renders. Calling the checkout straight afterwards reads the cart from
   * the render that is still on screen, i.e. the values from BEFORE the edit:
   * the cashier types 12, presses Enter, sees 12 flash, and the receipt says
   * 10. That is exactly what happened.
   *
   * Bumping a counter instead means the edit and the request are batched into
   * one render, and the effect below runs after it — reading a cart that
   * definitely contains the typed value.
   */
  const [submitTick, setSubmitTick] = useState(0)
  const submitPrintRef = useRef(false)
  const requestSubmit = (forcePrint = false) => {
    submitPrintRef.current = forcePrint
    setSubmitTick((n) => n + 1)
  }
  useEffect(() => {
    if (submitTick === 0) return
    submitActiveSale(submitPrintRef.current)
    // Only the tick may trigger this; submitActiveSale is re-created each
    // render and reads the cart as it stands NOW, which is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTick])

  /** F2 — finish the sale and print it, from anywhere on the page. */
  const printActiveSale = () => requestSubmit(true)

  /* Enter finishes the sale. It already worked inside the quantity field and
     the total, which is exactly where a cashier is NOT looking once the cart
     is right — pressing Enter with nothing focused did nothing at all.
     Deliberately ignored while typing (the search box must stay free to scan
     and to wedge-Enter) and while a dialog is open, where Enter belongs to
     whatever is on top. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        el?.isContentEditable ||
        el?.closest("[role='dialog']") ||
        document.querySelector("[role='dialog'],[data-state='open'][role='listbox']")
      ) return
      if (!pos.active || pos.active.lines.length === 0) return
      e.preventDefault()
      requestSubmit(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.active])
  // Grid is the default here. A pharmacy cashier works from a barcode scanner
  // and a list; a barista taps a picture of a latte. Same component, different
  // trade — so the default follows the vertical, not the template.
  const [searchRaw, setSearchRaw] = useState("")
  // Tap-to-filter for a barista: no typing, no scanning, two taps to a latte.
  // The category NAME — see CategoryCircles for why not the id.
  const [catId, setCatId] = useState<string | null>(null)
  const search = useDebounced(searchRaw, 250)
  // A hardware scanner types its burst anywhere — capture it without needing
  // the search box focused, and add the matched product straight to the cart
  // (falls back to filling the search box only when the code is ambiguous). A
  // bare Enter (nothing focused, no burst) completes the sale.
  const { flashNotFound, scanAlertOverlay } = useScanAlert()
  const [qtySeed, setQtySeed] = useState<QtySeed>(null)
  // Clear the seed once the cart moves on, so re-adding the same line doesn't
  // resurrect a stale digit.
  useEffect(() => {
    setQtySeed(null)
  }, [pos.lastAddedKey, pos.addTick])
  useGlobalScanner((code) => void handleWedgeEnter(code), {
    onEnter: () => requestSubmit(false),
    // + / − nudge the line the cashier just added — the common case is "make
    // that two" right after a scan, and reaching for the mouse to hit the
    // on-screen stepper costs more than the sale is worth.
    onAdjustQty: (delta) => {
      const line = pos.active?.lines.find((l) => l.key === pos.lastAddedKey)
      if (!line) return
      pos.setQuantity(line.key, Math.max(0, line.quantity + delta))
    },
    onNewCart: pos.parkAndNew,
    onPrintSale: printActiveSale,
    // A digit typed with nothing focused = a manual quantity for that line.
    onDigit: (digit) => {
      if (!pos.active?.lines.some((l) => l.key === pos.lastAddedKey)) return
      setQtySeed({ digit, tick: Date.now() })
    },
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [sheetScan, setSheetScan] = useState(false)
  const [bump, setBump] = useState(0)
  const scope = useRef<HTMLDivElement>(null)

  // Remember the cashier's preferred mode + sound preference.
  const [muted, setMutedState] = useState(false)
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  useEffect(() => {
    setMutedState(isMuted())
  }, [])

  /** Add + feedback: chirp and make the cart bounce. */
  function addWithFeedback(med: Product, variant?: CartVariant) {
    pos.addMedication(med, variant)
    playBeep(true)
    setBump((b) => b + 1)
  }

  const [bumping, setBumping] = useState(false)
  useEffect(() => {
    if (bump === 0) return
    setBumping(true)
    const t = setTimeout(() => setBumping(false), 380)
    return () => clearTimeout(t)
  }, [bump])

  const params = useMemo(
    () => ({
      search: search || undefined,
      category: catId ?? undefined,
      ordering: "name",
      page_size: 30,
    }),
    [search, catId],
  )
  const {
    items,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteList<Product>(["products"], productsList, params)

  useStaggerCards(
    scope,
    ".pos-tile",
    !isLoading && items.length > 0,
    [search, catId],
  )

  // The whole catalogue lives client-side → scans resolve with ZERO latency.
  const {
    catalog,
    byBarcode,
    ready: catalogReady,
    medIds,
    fresh: catalogFresh,
  } = usePosCatalog()

  // FULL PREVENTION: the moment the FRESH catalogue is known, purge any dead
  // line (a deleted/re-imported product, or a legacy stale id) from EVERY cart,
  // so a nonexistent item can never reach checkout. Gated to the fresh network
  // copy so we never drop a valid line while offline; the checkout error-handler
  // remains as the last-resort net for that offline edge.
  useEffect(() => {
    if (!catalogFresh || medIds.size === 0) return
    const removed = pos.reconcile((id) => medIds.has(id))
    if (removed > 0) {
      toast.warning(`أُزيل ${removed} صنف لم يعد متوفراً من السلة`)
    }
  }, [catalogFresh, medIds, pos.reconcile])

  function catalogToMed(m: CatalogMed): Product {
    return {
      id: m.id,
      name: m.name,
      price: String(m.price),
      stock: m.stock,
      barcode: m.barcode,
      category: m.category,
    } as unknown as Product
  }

  function medVariants(m: Product | CatalogMed): CatalogVariant[] {
    const vs = (m as { variants?: CatalogVariant[] }).variants ?? []
    return vs.filter((v) => (v as { is_active?: boolean }).is_active !== false)
  }

  function variantToCart(
    v: CatalogVariant,
    medPrice: string | number,
  ): CartVariant {
    // A variant's price defaults to the product price when it has none of its
    // own — it's the price shown/charged when this option is picked.
    const price = Number(v.price) > 0 ? v.price : medPrice
    return { id: v.id, label: v.label, price }
  }

  /* What the cashier has chosen inside the picker, before committing. The
     dialog is no longer one-tap-and-done: a note has to be typed, so the
     choice has to survive until they press the button. */
  const [pickVariant, setPickVariant] = useState<CatalogVariant | null>(null)
  const [pickNote, setPickNote] = useState("")

  const [variantPicker, setVariantPicker] = useState<{
    med: Product
    variants: CatalogVariant[]
    /** Set when we're changing an existing cart line's unit rather than
     *  adding something new. */
    lineKey?: string
  } | null>(null)

  /**
   * Open the unit chooser for a cart line: قطعة, or any pack the product has.
   *
   * The import creates one variant per pack BARCODE, so a product with two
   * barcodes for the same 24-pack ends up with two identical-looking rows.
   * Collapse them by label+price — the cashier is choosing a unit, not a
   * barcode, and two identical options is just a decision they can get wrong.
   */
  function openUnitPicker(line: CartLine) {
    const med = catalog?.find((m) => m.id === line.medicationId)
    if (!med) return
    const seen = new Set<string>()
    const variants = medVariants(med as unknown as Product).filter((v) => {
      const k = `${v.label}|${v.price}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (variants.length === 0) return
    setVariantPicker({
      med: catalogToMed(med),
      variants,
      lineKey: line.key,
    })
  }

  /**
   * Add a med to the cart — ALWAYS as a single piece.
   *
   * It used to open a "اختر النوع" dialog whenever the product had variants.
   * For this store every variant is a PACK (عبوة ×24 and friends, created by
   * the Shamel import from its secondary selling units), not a colour or a
   * size — so the base product is always a valid answer, and usually the right
   * one. Forcing the cashier to pick a unit for a ₪1 chocolate bar, on a
   * dialog listing only the ₪24 box, stops the sale dead.
   *
   * Scanning a PACK's own barcode still adds that pack directly (handled in
   * handleScan) — that barcode means the box. And any line can be switched
   * between piece and pack afterwards, from the النوع column.
   */
  function addMedOrPick(
    med: Product,
    variants: CatalogVariant[] | undefined,
  ): ScanFeedback {
    /* A product with options is not one thing. آيس تي is خوخ or يافا or بامبي,
       and dropping the base row into the cart charges the right money for the
       wrong drink — the barista then has to remember which one it was. The
       chooser already existed for changing a line's unit; this is the same
       dialog, opened at the moment it matters. */
    const opts = (variants ?? []).filter(
      (v) => (v as { is_active?: boolean }).is_active !== false,
    )
    if (opts.length > 0) {
      setPickVariant(opts.length === 1 ? opts[0] : null)
      setPickNote("")
      setVariantPicker({ med, variants: opts })
      return { ok: true, message: `اختر النوع: ${med.name}` }
    }
    addWithFeedback(med)
    return { ok: true, message: `أُضيف: ${med.name}` }
  }

  /** Camera scan → straight into the cart (sound + flash handled by the
   *  scanner based on `ok`: chirp when added, red flash + buzz otherwise). */
  async function handleScan(code: string): Promise<ScanFeedback> {
    // Instant path: local catalogue hit, no network round-trip.
    const hit = byBarcode.get(code.trim())
    if (hit) {
      if (hit.variant) {
        addWithFeedback(catalogToMed(hit.med), variantToCart(hit.variant, hit.med.price))
        return {
          ok: true,
          message: `أُضيف: ${hit.med.name} — ${hit.variant.label}`,
        }
      }
      return addMedOrPick(catalogToMed(hit.med), hit.med.variants)
    }
    try {
      // Fallback: exact (indexed) barcode lookup, then fuzzy search.
      const exact = await productsList({ barcode: code, page_size: 1 })
      const found = (exact.data.results ?? [])[0]
      if (found) {
        return addMedOrPick(found, medVariants(found))
      }
      if (catalogReady) {
        flashNotFound(code)
        return { ok: false, message: "غير موجود — لم تتم الإضافة" }
      }
      const r = await productsList({ search: code, page_size: 2 })
      const results = r.data.results ?? []
      if (results.length === 1) {
        return addMedOrPick(results[0], medVariants(results[0]))
      }
      if (results.length === 0) {
        flashNotFound(code)
        return { ok: false, message: "غير موجود — لم تتم الإضافة" }
      }
    } catch {
      /* fall through to plain search */
    }
    setSearchRaw(code)
    return { ok: false, message: "نتائج متعددة — اختر من القائمة" }
  }

  /** Hardware (keyboard-wedge) scanner: types the code then sends Enter. */
  async function handleWedgeEnter(value: string) {
    const hit = byBarcode.get(value.trim())
    if (hit) {
      if (hit.variant) {
        addWithFeedback(catalogToMed(hit.med), variantToCart(hit.variant, hit.med.price))
      } else {
        addMedOrPick(catalogToMed(hit.med), hit.med.variants)
      }
      setSearchRaw("")
      return
    }
    try {
      const r = await productsList({ search: value, page_size: 2 })
      const results = r.data.results ?? []
      if (
        results.length === 1 ||
        (results.length > 0 && results[0].barcode === value)
      ) {
        addMedOrPick(results[0], medVariants(results[0]))
        setSearchRaw("")
        return
      }
      if (results.length === 0) {
        playBeep(false)
        flashNotFound(value)
        toast.error("لا توجد نتيجة لهذا الباركود")
        return
      }
      // Ambiguous — surface the matches so the cashier can pick one.
      setSearchRaw(value)
    } catch {
      setSearchRaw(value)
    }
  }

  const activeCount = pos.active?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0
  const activeTotal = pos.active ? cartTotal(pos.active) : 0

  return (
    <div className="mx-auto w-full max-w-7xl">
      {scanAlertOverlay}
      {/* Header strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            نقطة البيع
          </h1>
          {/* The day's takings and the transaction count used to sit here.
              Removed at the owner's request: the till is worked by staff, and
              the shop's running total is the owner's business, not something
              that should be readable over a cashier's shoulder by whoever is
              standing at the counter. Both are still on the sales page and the
              dashboard, which is where the owner looks. */}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium shadow-sm transition hover:border-primary/40 hover:text-primary md:hidden"
          >
            <ChartColumn className="size-4" />
            المبيعات
          </Link>
        </div>
      </div>

      {/* Grid only. The table view was a pharmacy habit — rows of
          barcodes typed in fast. A café picks by sight, so the tiles
          with photos ARE the product list and a second way to see the
          same thing was just another button to get wrong. */}
          <div className="grid gap-5 lg:grid-cols-[1fr_460px]">
            {/* Products */}
            <div className="min-w-0" data-tour="pos-search">
              {/* Kept inside the products column so it never slides over the cart. */}
              <StickyToolbar className="lg:-mx-2 lg:px-2">
                <SearchInput
                  value={searchRaw}
                  onChange={setSearchRaw}
                  placeholder="ابحث أو امسح الباركود لإضافة منتج…"
                  scan
                  onScan={handleScan}
                  scanContinuous
                  onEnter={handleWedgeEnter}
                  onScanClick={() => {
                    // On mobile, scanning happens inside the cart sheet —
                    // camera on top, items landing live underneath.
                    if (window.innerWidth < 1024) {
                      setSheetScan(true)
                      setCartOpen(true)
                      return true
                    }
                  }}
                  scanStatus={
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShoppingBag className="size-4" />
                        {formatNumber(activeCount)} صنف
                      </span>
                      <span className="font-heading text-lg font-bold">
                        {formatMoney(activeTotal)}
                      </span>
                    </div>
                  }
                />
                <CategoryCircles value={catId} onChange={setCatId} />
              </StickyToolbar>

              {isLoading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-3xl" />
                  ))}
                </div>
              )}
              {isError && <ErrorState onRetry={() => refetch()} />}
              {!isLoading && !isError && items.length === 0 && (
                <EmptyState
                  art={<NoMedsArt className="h-32 w-auto" />}
                  title="لا توجد نتائج"
                  description="جرّب اسماً آخر أو امسح الباركود"
                />
              )}
              {items.length > 0 && (
                <>
                  <div
                    ref={scope}
                    className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 lg:pb-0"
                  >
                    {items.map((m) => (
                      <ProductTile
                        key={m.id}
                        med={m}
                        onAdd={(med) => addMedOrPick(med, medVariants(med))}
                      />
                    ))}
                  </div>
                  <LoadMore
                    hasNext={Boolean(hasNextPage)}
                    isFetchingNext={isFetchingNextPage}
                    onLoad={() => fetchNextPage()}
                  />
                </>
              )}
            </div>

            {/* Cart — desktop side panel */}
            <div className="relative z-30 hidden lg:block" data-tour="pos-cart">
              <Card
                className={cn(
                  // Height accounts for the top bar + page header so the
                  // checkout button never slips below the fold.
                  "sticky top-2 flex max-h-[calc(100dvh-13.5rem)] min-h-0 flex-col gap-0 overflow-hidden p-4",
                  bumping && "cart-bump",
                  pos.active?.isReturn && "return-glow",
                )}
              >
                <CartPanel
                  qtySeed={qtySeed}
                  pos={pos}
                  onScanBurst={(code) => void handleWedgeEnter(code)}
                  onSubmitSale={() => requestSubmit(false)}
                />
              </Card>
            </div>
          </div>

          {/* Cart — mobile: compact FAB while empty, full bar once it has items */}
          <div className="fixed inset-x-3 bottom-24 z-30 lg:hidden">
            {activeCount === 0 && pos.carts.length === 1 ? (
              <button
                type="button"
                onClick={() => {
                  // Open the cart with the barcode scanner already running.
                  setSheetScan(true)
                  setCartOpen(true)
                }}
                aria-label="السلة"
                className="ink-panel animate-in zoom-in-75 ms-auto grid size-14 place-items-center rounded-full text-white shadow-2xl transition duration-200 active:scale-95"
              >
                <ShoppingBag className="size-6" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Open the cart with the barcode scanner already running.
                  setSheetScan(true)
                  setCartOpen(true)
                }}
                className={cn(
                  "ink-panel animate-in fade-in zoom-in-95 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-white shadow-2xl transition duration-200 active:scale-[0.99]",
                  bumping && "cart-bump",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="relative">
                    <ShoppingBag className="size-5" />
                    {activeCount > 0 && (
                      <span className="absolute -end-2 -top-2 grid size-4.5 place-items-center rounded-full bg-lime text-[10px] font-bold text-lime-foreground">
                        {formatNumber(activeCount)}
                      </span>
                    )}
                  </span>
                  السلة
                  {pos.carts.length > 1 && (
                    <span className="pill bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                      {formatNumber(pos.carts.length)} سلال
                    </span>
                  )}
                </span>
                <span className="font-heading text-lg font-bold text-lime">
                  {formatMoney(activeTotal)}
                </span>
              </button>
            )}
          </div>
          <Dialog open={cartOpen} onOpenChange={setCartOpen}>
            {/* Bottom sheet: fixed height, internal scroll — actions always visible. */}
            <DialogContent
              showCloseButton={false}
              className={cn(
                "top-auto bottom-0 left-0 h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl data-closed:zoom-out-100 data-open:zoom-in-100 data-open:slide-in-from-bottom-10 flex flex-col gap-0 overflow-hidden p-4 pt-5",
                pos.active?.isReturn && "return-glow",
              )}
            >
              <DialogTitle className="sr-only">السلة</DialogTitle>
              <CartPanel
                qtySeed={qtySeed}
                pos={pos}
                totalOnTop
                onScanCode={handleScan}
                defaultScanning={sheetScan}
                onDone={() => setCartOpen(false)}
                onScanBurst={(code) => void handleWedgeEnter(code)}
                onSubmitSale={() => requestSubmit(false)}
              />
            </DialogContent>
          </Dialog>

      <PrintReceiptDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        onOpenSettings={() => {
          setPrintOpen(false)
          setPrintSettingsOpen(true)
        }}
      />
      <PrintSettingsDialog
        open={printSettingsOpen}
        onOpenChange={setPrintSettingsOpen}
      />
      <Dialog
        open={variantPicker !== null}
        onOpenChange={(o) => !o && setVariantPicker(null)}
      >
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {/* Two panes, the way Clerk lays out an account: the thing you are
              editing stays on one side so it never scrolls away, and the
              choices live on the other. A cashier mid-order should not have to
              re-read which drink this dialog belongs to. */}
          <div className="grid md:grid-cols-[240px_1fr]">
            <aside className="relative hidden flex-col justify-end overflow-hidden bg-muted/40 md:flex">
              {variantPicker?.med.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(variantPicker.med as { image?: string }).image}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
              <div className="relative p-5">
                <p className="font-heading text-lg font-bold leading-tight">
                  {variantPicker?.med.name}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold text-primary tabular-nums">
                  {formatMoney(variantPicker?.med.price ?? 0)}
                </p>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col">
              <DialogTitle className="border-b border-border/70 px-5 py-4 text-base">
                <span className="md:hidden">{variantPicker?.med.name} — </span>
                اختر النوع
              </DialogTitle>

              <div className="max-h-[46dvh] min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
                {variantPicker?.variants.map((v) => {
                  const price = Number(v.price) > 0 ? v.price : (variantPicker?.med.price ?? 0)
                  const on = pickVariant?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPickVariant(v)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start transition",
                        on
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      <span className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}>
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{v.label}</span>
                      <span className="shrink-0 font-heading font-bold text-primary tabular-nums">
                        {formatMoney(price)}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* The note lives with the drink it describes. "بدون سكر" on an
                  order of four says nothing about which one. */}
              <div className="border-t border-border/70 px-4 py-3">
                <Input
                  value={pickNote}
                  onChange={(e) => setPickNote(e.target.value)}
                  placeholder="ملاحظة على هذا الصنف (بدون سكر، سخن زيادة…)"
                  className="text-start"
                />
              </div>

              <div className="flex gap-2 border-t border-border/70 bg-muted/30 px-4 py-3">
                <Button
                  type="button"
                  data-form-primary
                  disabled={!pickVariant}
                  className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
                  onClick={() => {
                    if (!variantPicker || !pickVariant) return
                    const unit = variantToCart(pickVariant, variantPicker.med.price ?? "0")
                    if (variantPicker.lineKey) {
                      pos.setLineUnit(variantPicker.lineKey, unit, variantPicker.med.price ?? "0")
                      if (pickNote.trim()) pos.setLineNote(variantPicker.lineKey, pickNote.trim())
                    } else {
                      addWithFeedback(variantPicker.med, unit)
                      // The line the add just created is the one to annotate.
                      const key = pos.active?.lines.at(-1)?.key
                      if (key && pickNote.trim()) pos.setLineNote(key, pickNote.trim())
                    }
                    setVariantPicker(null)
                  }}
                >
                  {variantPicker?.lineKey ? "تغيير النوع" : "أضف للسلة"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setVariantPicker(null)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * useSearchParams() must sit inside a Suspense boundary.
 *
 * Without one, Next's static prerender pass hands the client component an
 * EMPTY parameter set and never re-renders it with the real query string — so
 * `/pos?edit=145648` reaches the till looking exactly like a plain `/pos`, the
 * sale is never fetched, and the only symptom is an empty cart. Silent, and
 * indistinguishable from "the link is broken".
 *
 * Same reason /inventory and /login are wrapped.
 */
export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosPageInner />
    </Suspense>
  )
}
