"use client"
/* The invoice, lifted out of the sales page.

   It was defined inline there, so the customer page could either show no sale
   at all or grow a second, thinner copy of the same dialog — one that would
   drift from this one the first time either changed. One dialog, two callers.
*/
import { Banknote, CalendarDays, Pencil, Printer, Trash2, UserCog, User as UserIcon } from "lucide-react"
import { saleItemName, type Sale } from "@/api/sales"
import { useMe, displayName } from "@/hooks/use-me"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { deliverAndToast } from "@/lib/print/deliver"
import type { ReceiptData } from "@/lib/print/receipt"
import { loadPrintSettings } from "@/lib/print/settings"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { isLocalSale, saleNumberLabel } from "@/lib/offline/local-sale"
import { SaleRevisions } from "@/components/sales/sale-revisions"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function SaleDetail({
  sale,
  open,
  onOpenChange,
  onVoid,
}: {
  sale: Sale | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onVoid: (s: Sale) => void
}) {
  const { user } = useMe()
  const cashierName = displayName(user)
  const me = user as { pharmacy_name?: string; pharmacy_logo?: string } | undefined
  const pharmacyName = me?.pharmacy_name?.trim() || "المتجر"
  const pharmacyLogo = me?.pharmacy_logo || ""

  function reprint(s: Sale) {
    const data: ReceiptData = {
      saleId: s.id,
      // Same number as the original receipt, so a reprint scans identically.
      receiptCode: s.receipt_code,
      items: s.items.map((it) => ({
        name: saleItemName(it),
        quantity: it.quantity,
        unitPrice: it.unit_price,
        lineTotal: it.line_total,
      })),
      total: toNumber(s.total),
      discountedTotal: toNumber(s.discounted_total),
      paymentMethod: s.payment_method,
      isReturn: Boolean(s.is_return),
      customerName: s.customer_name,
      cashierName: s.created_by_name || cashierName,
      createdAt: s.created_at,
    }
    // Agent → browser → file, same as a checkout.
    void deliverAndToast(
      data,
      pharmacyName,
      loadPrintSettings(),
      pharmacyLogo,
      "إعادة طباعة الفاتورة",
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl"
      >
        {sale && (
          <>
            {/* shrink-0: the dialog is a flex column with a max height, so a
                child without it gets SQUEEZED as the middle grows. Expanding
                the revision history crushed this header and hid قيمة البيع —
                the one number the owner opened the invoice to read. Only the
                middle section may give; the header and the footer are fixed. */}
            <div
              className="ink-panel shrink-0 rounded-none p-6"
              style={{ borderRadius: 0, boxShadow: "none" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="bg-brand-gradient grid size-12 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-bold text-white ring-2 ring-white/20">
                    {(sale as { customer_avatar?: string }).customer_avatar ? (
                      <img
                        src={(sale as { customer_avatar?: string }).customer_avatar}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      sale.customer_name?.trim().charAt(0) || (
                        <UserIcon className="size-5" />
                      )
                    )}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate font-heading text-lg font-bold text-white">
                      {sale.customer_name || "زبون نقدي"}
                    </DialogTitle>
                    {/* A queued sale has no server number yet — showing
                        "بيع رقم -1" would read as a data bug. */}
                    <p className="text-xs text-white/55">
                      {saleNumberLabel(sale.id, sale.receipt_code)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "pill",
                    sale.payment_method === "cash"
                      ? "bg-success/25 text-white"
                      : "bg-warning/25 text-white",
                  )}
                >
                  <Banknote className="size-3.5" />
                  {sale.payment_method === "cash" ? "نقدي" : "دين"}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                <div>
                  <p className="text-[11px] text-white/60">قيمة البيع</p>
                  <p className="font-heading text-2xl font-bold text-lime">
                    {formatMoney(sale.discounted_total)}
                  </p>
                </div>
                {toNumber(sale.discounted_total) !== toNumber(sale.total) && (
                  <p className="text-sm text-white/45 line-through">
                    {formatMoney(sale.total)}
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground">
                      التاريخ
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {formatDate(sale.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserCog className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground">
                      البائع
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {sale.created_by_name || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nothing at all on an untouched invoice, which is nearly all
                  of them. */}
              <SaleRevisions
                saleId={sale.id}
                count={sale.revision_count ?? 0}
                receiptCode={sale.receipt_code}
              />

              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">الصنف</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-end">السعر</TableHead>
                      <TableHead className="text-end">المجموع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((it, i) => (
                      <TableRow key={it.id ?? i}>
                        <TableCell className="max-w-[180px] truncate whitespace-normal font-medium">
                          {saleItemName(it)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatMoney(it.unit_price)}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums">
                          {formatMoney(it.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-t border-border/70 bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reprint(sale)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                >
                  <Printer className="size-4" />
                  طباعة الفاتورة
                </button>
                {/* Correct the sale instead of voiding and re-ringing it: the
                    receipt already in the customer's hand keeps pointing at the
                    right invoice, and the day's history shows one sale for one
                    basket. A queued sale has no server id yet, so there is
                    nothing to PATCH. */}
                <Link
                  href={isLocalSale(sale.id) ? "#" : `/pos?edit=${sale.id}`}
                  onClick={(e) => {
                    if (isLocalSale(sale.id)) {
                      e.preventDefault()
                      return
                    }
                    onOpenChange(false)
                  }}
                  aria-disabled={isLocalSale(sale.id)}
                  title={
                    isLocalSale(sale.id)
                      ? "لا يمكن تعديل بيع لم تتم مزامنته بعد — انتظر عودة الاتصال"
                      : "تعديل الفاتورة في نقطة البيع"
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-muted",
                    isLocalSale(sale.id) && "pointer-events-none opacity-40",
                  )}
                >
                  <Pencil className="size-4" />
                  تعديل
                </Link>
              </div>
              {/* Voiding PATCHes /sales/<id>/. A queued sale has no server id
                  yet, so the call would go out as -1. Fix it at the source in
                  the POS (or wait for the sync) instead. */}
              <button
                type="button"
                disabled={isLocalSale(sale.id)}
                title={
                  isLocalSale(sale.id)
                    ? "لا يمكن إلغاء بيع لم تتم مزامنته بعد — انتظر عودة الاتصال"
                    : undefined
                }
                onClick={() => {
                  onOpenChange(false)
                  onVoid(sale)
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                إلغاء البيع (استرجاع المخزون)
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
