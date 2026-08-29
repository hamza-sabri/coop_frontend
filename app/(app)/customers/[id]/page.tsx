"use client"

/* ==========================================================================
   A customer at كوب.

   The template's version of this page was a debt ledger — right for a pharmacy
   where people run a tab, wrong for a café where they pay for the coffee and
   walk out. What matters here is what they ordered, whether it settled, and
   how many points it put in their cup.

   Debts still exist in the data model and the POS can still make one; they are
   simply not what this page is about any more.
   ========================================================================== */
import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Coffee, Pencil, Receipt, Sparkles, StickyNote, TrendingUp } from "lucide-react"

import { customersRetrieve } from "@/api/generated/customers/customers"
import { salesList } from "@/api/generated/sales/sales"
import { CustomerAppOrders } from "@/components/orders/customer-app-orders"
import { SaleDetail } from "@/components/sales/sale-detail"
import type { Customer, Sale } from "@/api/generated/model"
import { usePagedList } from "@/hooks/use-paged-list"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"

import { LoadMore } from "@/components/load-more"
import { EmptyState, ErrorState } from "@/components/states"
import { NoDebtsArt } from "@/components/illustrations"
import { CustomerForm } from "@/components/forms/customer-form"
import { GenderBadge } from "@/components/gender-badge"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const PAGE_SIZE = 10

type LoyaltyFields = { points?: number; tier?: string; signed_up?: boolean }
type Order = Sale & {
  beans_earned?: number
  is_paid?: boolean
  /** On the serializer; regenerate with `npm run api` to type it properly. */
  receipt_code?: string | null
}

const TIER_LABEL: Record<string, string> = {
  single: "سنجل", double: "دوبل", triple: "تريبل",
}

function Stat({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Coffee; label: string; value: string; tone?: "gold" | "plain"
}) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={
          tone === "gold"
            ? "font-heading text-2xl font-bold text-lime"
            : "font-heading text-2xl font-bold"
        }
      >
        {value}
      </p>
    </Card>
  )
}

function OrderRow({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const when = order.created_at ? new Date(order.created_at) : null
  const items = order.items?.length ?? 0
  const points = order.beans_earned ?? 0
  const paid = order.is_paid !== false
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        onOpen()
      }}
      className="card-interactive cursor-pointer gap-0 p-0"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Receipt className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            {formatNumber(items)} صنف
            {order.receipt_code ? (
              <span dir="ltr" className="ms-2 text-xs font-normal text-muted-foreground">
                #{order.receipt_code}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {when
              ? when.toLocaleString("ar", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })
              : "—"}
            {order.payment_method ? ` · ${order.payment_method === "cash" ? "نقدي" : order.payment_method === "debt" ? "دين" : "بطاقة"}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-heading text-base font-bold">
            {formatMoney(order.discounted_total ?? order.total)}
          </span>
          <span className={paid ? "pill pill-success" : "pill pill-warning"}>
            {paid ? "مدفوع" : "غير مدفوع"}
          </span>
        </div>
      </div>
      {points > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2">
          <span className="text-xs text-muted-foreground">نقاط من هالطلب</span>
          <span className="font-heading text-sm font-bold text-lime">
            +{formatNumber(points)}
          </span>
        </div>
      )}
    </Card>
  )
}

export default function CustomerDetailPage() {
  const routeParams = useParams<{ id: string }>()
  const id = Number(routeParams?.id)
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [page, setPage] = useState(1)

  const {
    data: customerRes, isLoading, isError, refetch,
  } = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => customersRetrieve(String(id)),
    enabled: Number.isFinite(id),
  })
  const customer = customerRes?.data as (Customer & LoyaltyFields) | undefined

  const {
    results: orders, count, pageCount, isLoading: ordersLoading,
  } = usePagedList<Order>(
    ["sales"],
    salesList,
    { customer: id, ordering: "-created_at" },
    page,
    PAGE_SIZE,
    Number.isFinite(id),
  )

  const spent = useMemo(
    () => orders.reduce((sum, o) => sum + toNumber(o.discounted_total ?? o.total), 0),
    [orders],
  )

  /* Top five by pieces bought, tie-broken by how many separate orders it
     appeared in — five singles of one drink is a habit, one order of five is
     a party. */
  /* Same dialog the sales page opens — items, totals, revisions, reprint. */
  const [detail, setDetail] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const topItems = useMemo(() => {
    const tally = new Map<string, { name: string; qty: number; orders: number }>()
    orders.forEach((o) => {
      const seen = new Set<string>()
      ;(o.items ?? []).forEach((it) => {
        const name = (it as { medication_name?: string }).medication_name?.trim()
        if (!name) return
        const row = tally.get(name) ?? { name, qty: 0, orders: 0 }
        row.qty += Number((it as { quantity?: number | string }).quantity ?? 1)
        if (!seen.has(name)) { row.orders += 1; seen.add(name) }
        tally.set(name, row)
      })
    })
    return [...tally.values()]
      .sort((a, b) => b.qty - a.qty || b.orders - a.orders)
      .slice(0, 5)
  }, [orders])

  if (isError) return <ErrorState onRetry={() => refetch()} />

  const points = customer?.points ?? 0
  const tier = customer?.tier ?? "single"

  return (
    <div className="space-y-5">
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        <span>الزبائن</span>
      </Link>

      {/* who they are */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 p-5">
          <div className="rounded-full bg-brand-gradient p-[2px]">
            <Avatar className="size-16 ring-2 ring-card">
              <AvatarImage src={customer?.avatar || undefined} alt="" />
              <AvatarFallback className="bg-card text-primary">
                {customer?.name?.charAt(0) ?? "؟"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <h2 className="truncate font-heading text-xl font-bold">{customer?.name}</h2>
            )}
            {customer?.phone && (
              <p dir="ltr" className="mt-1 text-start text-sm text-muted-foreground">
                {customer.phone}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <GenderBadge gender={customer?.gender} />
              {customer?.signed_up && (
                <Badge className="border-transparent bg-primary/12 font-normal text-primary">
                  عبر التطبيق
                </Badge>
              )}
              {tier !== "single" && (
                <Badge className="border-transparent bg-lime/20 font-normal text-foreground">
                  {TIER_LABEL[tier] ?? tier}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            تعديل
          </Button>
        </div>
        {/* The standing note: "no boycott items", "always oat milk". It was
            already saved on the customer and shown nowhere, which makes it a
            note nobody reads — so it sits on the card, not behind an edit
            dialog. */}
        {customer?.notes?.trim() && (
          <div className="flex items-start gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {customer.notes}
            </p>
          </div>
        )}
      </Card>

      {/* where they stand */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Sparkles} label="النقاط" value={`${formatNumber(points)}`} tone="gold" />
        <Stat icon={Coffee} label="الطلبات" value={formatNumber(count)} />
        <Stat icon={TrendingUp} label="المصروف" value={formatMoney(spent)} />
        <Stat
          icon={Receipt}
          label="الرصيد المستحق"
          value={formatMoney(customer?.outstanding ?? 0)}
        />
      </div>

      {/* Their usual. Counted from the orders already on this page rather than
          asking the server for a second aggregate — the data is here, and a
          barista wants "what does he always get" in one glance. */}
      {topItems.length > 0 && (
        <div>
          <h3 className="mb-3 font-heading text-lg font-bold">الأكثر طلباً</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {topItems.map((it) => (
              <Card key={it.name} className="gap-0 p-3">
                <p className="line-clamp-2 min-h-[2.4rem] text-sm font-medium leading-snug">
                  {it.name}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-heading text-xl font-bold text-primary">
                    {formatNumber(it.qty)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatNumber(it.orders)} طلب
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Orders sent from the app. Separate table from the till history
          below — see api/orders.ts. Renders nothing when there are none. */}
      <CustomerAppOrders customerId={Number(id)} />

      {/* what they bought at the counter */}
      <div>
        <h3 className="mb-3 font-heading text-lg font-bold">مبيعات الكاشير</h3>
        {ordersLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-3xl" />
            ))}
          </div>
        )}
        {!ordersLoading && orders.length === 0 && (
          <EmptyState
            art={<NoDebtsArt className="h-28 w-auto" />}
            title="لا توجد طلبات"
            description="أول طلب لهذا الزبون رح يظهر هون"
          />
        )}
        {orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onOpen={() => { setDetail(o); setDetailOpen(true) }}
                />
              ))}
            </div>
            <LoadMore
              hasNext={page < pageCount}
              isFetchingNext={ordersLoading}
              onLoad={() => setPage((p) => p + 1)}
            />
          </>
        )}
      </div>

      {/* The same invoice the sales page opens — items, totals, revisions,
          reprint. `Order` is the generated Sale with an optional `customer`;
          the dialog wants it required, so the row is narrowed here rather than
          the dialog being loosened for one caller. */}
      <SaleDetail
        sale={detail as Parameters<typeof SaleDetail>[0]["sale"]}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onVoid={() => {}}
      />

      <CustomerForm
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["customers"] })
          qc.invalidateQueries({ queryKey: ["customers-quick"] })
        }}
      />
    </div>
  )
}
