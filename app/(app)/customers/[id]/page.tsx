"use client"

/* ==========================================================================
   A customer at كوب — the page a barista opens to know who is at the counter
   and the owner opens to know who is worth keeping.

     Who they are, and where they stand: a regular, new, or slipping away.
     Their usual — what to start making when they walk in.
     Their rhythm — the last twelve weeks, and when in the day they come.
     Their points, and every receipt.

   Every figure comes from all of their history (the server counts it), not
   from the page of receipts below. Money is the owner's.
   ========================================================================== */
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowRight, MessageCircle, Pencil, Phone, Receipt, StickyNote } from "lucide-react"

import { customersRetrieve } from "@/api/generated/customers/customers"
import { salesList } from "@/api/generated/sales/sales"
import type { Customer, Sale } from "@/api/generated/model"
import { customerProfile, type CustomerProfile } from "@/api/customer-profile"
import { STATUS, ago } from "@/components/customers/status"
import { CountUp } from "@/components/count-up"
import { PointsCard } from "@/components/customers/points-card"
import { CustomerForm } from "@/components/forms/customer-form"
import { ordersList, type Order as AppOrder } from "@/api/orders"
import { DataTable, type Column } from "@/components/data-table"
import { PaginationBar } from "@/components/pagination-bar"
import { AXIS, Panel, TOOLTIP_STYLE } from "@/components/reports/kit"
import { SaleDetail } from "@/components/sales/sale-detail"
import { ErrorState } from "@/components/states"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePagedList } from "@/hooks/use-paged-list"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { pointsValue } from "@/lib/points"
import { usePointsRate } from "@/hooks/use-points-rate"

const PAGE_SIZE = 12

type Order = Sale & {
  beans_earned?: number
  beans_spent?: number
  receipt_code?: string | null
}

type Tab = "overview" | "receipts" | "points"

/** Sections arrive one after another rather than all at once. */
const STAGGER = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"

const WEEKDAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

/* ── wording ─────────────────────────────────────────────────────────── */


function hourLabel(h: number): string {
  const p = h < 12 ? "ص" : "م"
  const x = h % 12 === 0 ? 12 : h % 12
  return `${x}${p}`
}


/* ── the page ────────────────────────────────────────────────────────── */

export default function CustomerDetailPage() {
  usePointsRate()
  const routeParams = useParams<{ id: string }>()
  const id = Number(routeParams?.id)
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const [editOpen, setEditOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Order | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  const c = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => customersRetrieve(String(id)),
    enabled: Number.isFinite(id),
  })
  const customer = c.data?.data as (Customer & { signed_up?: boolean }) | undefined
  const prof = useQuery({
    queryKey: ["customers", "profile", id],
    queryFn: () => customerProfile(id).then((r) => r.data),
    enabled: Number.isFinite(id),
  })
  const p = prof.data
  const { results: orders, pageCount, isLoading: ordersLoading } = usePagedList<Order>(
    ["sales"],
    salesList,
    { customer: id, ordering: "-created_at" },
    page,
    PAGE_SIZE,
    Number.isFinite(id),
  )

  if (c.isError) return <ErrorState onRetry={() => c.refetch()} />
  const female = customer?.gender === "female"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-24">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        الزبائن
      </Link>

      <Hero customer={customer} profile={p} female={female} isOwner={isOwner} onEdit={() => setEditOpen(true)} />

      <div className={cn(STAGGER, "[animation-delay:90ms]")}>
        <div className="flex gap-1 rounded-xl border border-border/80 bg-card p-1" role="tablist">
          {(
            [
              ["overview", "نظرة"],
              ["receipts", `الفواتير${p ? ` · ${formatNumber(p.visits)}` : ""}`],
              ["points", "النقاط"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div key="overview" className="grid gap-3 lg:grid-cols-5">
          <Panel
            className={cn(STAGGER, "sm:p-4 lg:col-span-2 [animation-delay:160ms]")}
            title={female ? "طلبها المعتاد" : "طلبه المعتاد"}
            hint={p ? `من ${formatNumber(toNumber(p.cups))} كوب` : undefined}
          >
            {p ? <Usual profile={p} /> : <Skeleton className="h-40 rounded-xl" />}
          </Panel>
          <Panel
            className={cn(STAGGER, "sm:p-4 lg:col-span-3 [animation-delay:240ms]")}
            title={female ? "زياراتها" : "زياراته"}
            hint={p ? `${formatNumber(p.visits_30d)} زيارة في آخر ٣٠ يوماً · آخر ١٢ أسبوعاً` : undefined}
          >
            {p ? <Rhythm profile={p} isOwner={isOwner} /> : <Skeleton className="h-48 rounded-xl" />}
          </Panel>
        </div>
      ) : tab === "receipts" ? (
        <div key="receipts" className={STAGGER}>
          <OrdersTable
            customerId={id}
            sales={orders}
            salesCount={p?.visits ?? orders.length}
            loading={ordersLoading}
            page={page}
            pageCount={pageCount}
            onPage={setPage}
            onOpenSale={(o) => setDetail(o)}
          />
        </div>
      ) : (
        <div key="points" className={STAGGER}>
          {Number.isFinite(id) ? <PointsCard customerId={id} /> : null}
        </div>
      )}

      <SaleDetail
        sale={detail as Parameters<typeof SaleDetail>[0]["sale"]}
        open={detail != null}
        onOpenChange={(o) => !o && setDetail(null)}
        onVoid={() => {
          qc.invalidateQueries({ queryKey: ["customers", "profile", id] })
        }}
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

/* ── who they are ────────────────────────────────────────────────────── */

function Hero({
  customer,
  profile: p,
  female,
  isOwner,
  onEdit,
}: {
  customer: (Customer & { signed_up?: boolean }) | undefined
  profile: CustomerProfile | undefined
  female: boolean
  isOwner: boolean
  onEdit: () => void
}) {
  const status = p ? STATUS[p.status] : null
  const phone = customer?.phone?.replace(/\s+/g, "") ?? ""
  // Palestinian mobiles: 059x / 056x → +970 for WhatsApp.
  const wa = /^05\d{8}$/.test(phone) ? `https://wa.me/970${phone.slice(1)}` : null
  const points = (customer as { points?: number } | undefined)?.points

  return (
    <section className={cn(STAGGER, "overflow-hidden rounded-2xl border border-border/80 bg-card")}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <Avatar className="size-16 shrink-0 ring-2 ring-border/60 ring-offset-2 ring-offset-card">
          <AvatarImage src={customer?.avatar || undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-primary/10 font-heading text-xl text-primary">{customer?.name?.charAt(0) ?? ""}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 sm:flex-none">
          <div className="flex flex-wrap items-center gap-2">
            {customer ? (
              <h2 className="truncate font-heading text-xl font-bold leading-tight">{customer.name}</h2>
            ) : (
              <Skeleton className="h-6 w-40" />
            )}
            {status ? (
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", status.cls)}>
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {female ? status.f : status.m}
                {p?.status === "fading" ? ` ${ago(p.days_since_last)}` : ""}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {customer?.phone ? <span dir="ltr" className="tabular-nums">{customer.phone}</span> : null}
            {customer?.phone ? <span aria-hidden className="hidden sm:inline">·</span> : null}
            <span>{female ? "زبونة" : "زبون"} منذ {formatDate(p?.joined ?? customer?.created_at)}</span>
            {customer?.signed_up ? (
              <>
                <span aria-hidden>·</span>
                <span>على التطبيق</span>
              </>
            ) : null}
          </p>
        </div>

        {/* the numbers, inline — four facts, no boxes */}
        <dl className="order-last grid w-full grid-cols-4 gap-2 border-t border-border/60 pt-3 sm:order-none sm:ms-auto sm:flex sm:w-auto sm:gap-6 sm:border-0 sm:pt-0">
          <Fact label="زيارة" sub={p ? ago(p.days_since_last) : undefined}>{p ? <CountUp value={p.visits} /> : "—"}</Fact>
          {isOwner ? (
            <Fact label="صرف" sub={p?.avg_ticket ? `${formatMoney(p.avg_ticket)}/فاتورة` : undefined}>
              {p?.spent != null ? <CountUp value={toNumber(p.spent)} decimals={0} suffix=" ₪" /> : "—"}
            </Fact>
          ) : (
            <Fact label="كوب">{p ? <CountUp value={toNumber(p.cups)} /> : "—"}</Fact>
          )}
          <Fact label="يزورنا">{p ? short(p.every_days, p.visits) : "—"}</Fact>
          <Fact label="نقطة" sub={points != null ? formatMoney(pointsValue(points)) : undefined}>{points != null ? <CountUp value={points} /> : "—"}</Fact>
        </dl>

        <div className="flex shrink-0 gap-1.5">
          {phone ? (
            <Button variant="outline" size="icon-sm" aria-label="اتصال" title="اتصال" nativeButton={false} render={<a href={`tel:${phone}`} />}>
              <Phone className="size-4" />
            </Button>
          ) : null}
          {wa ? (
            <Button variant="outline" size="icon-sm" aria-label="واتساب" title="واتساب" nativeButton={false} render={<a href={wa} target="_blank" rel="noreferrer" />}>
              <MessageCircle className="size-4" />
            </Button>
          ) : null}
          <Button variant="outline" size="icon-sm" aria-label="تعديل" title="تعديل" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      {customer?.notes?.trim() ? (
        <div className="flex items-start gap-2 border-t border-border/60 bg-amber-500/5 px-4 py-2.5">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{customer.notes}</p>
        </div>
      ) : null}
    </section>
  )
}

function short(every: number | null, visits: number): string {
  if (every == null) return visits ? "مرة" : "—"
  const d = Math.round(every)
  if (d <= 1) return "يومياً"
  if (d === 2) return "كل يومين"
  return `كل ${d} ${d <= 10 ? "أيام" : "يوماً"}`
}

function Fact({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 text-center sm:text-start">
      <dd className="font-heading text-lg font-bold tabular-nums leading-tight">{children}</dd>
      <dt className="text-[11px] text-muted-foreground">
        {label}
        {sub ? <span className="hidden sm:inline"> · {sub}</span> : null}
      </dt>
    </div>
  )
}

/* ── their usual ─────────────────────────────────────────────────────── */

function Usual({ profile: p }: { profile: CustomerProfile }) {
  if (!p.favourites.length) return <p className="py-6 text-center text-sm text-muted-foreground">لا طلبات بعد</p>
  const max = Math.max(...p.favourites.map((f) => toNumber(f.share)), 1)
  return (
    <ol className="space-y-3">
      {p.favourites.map((f, i) => (
        <li key={`${f.product_id}-${f.name}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <span className={cn("font-semibold", i === 0 && "text-primary")}>{f.name}</span>
              {f.size ? <span className="ms-1.5 text-[11px] text-muted-foreground">غالباً {f.size}</span> : null}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatNumber(toNumber(f.qty))} · {Math.round(toNumber(f.share))}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("animate-bar h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/40")}
              style={{ width: `${(toNumber(f.share) / max) * 100}%`, animationDelay: `${i * 80}ms` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── their rhythm ────────────────────────────────────────────────────── */

function WeekBars({ profile: p, isOwner }: { profile: CustomerProfile; isOwner: boolean }) {
  const data = p.weekly.map((w) => ({
    label: `${Number(w.week.slice(8))}/${Number(w.week.slice(5, 7))}`,
    week: w.week,
    visits: w.visits,
    spend: toNumber(w.spend),
  }))
  if (!data.some((d) => d.visits)) return <p className="py-10 text-center text-sm text-muted-foreground">لا زيارات في آخر ١٢ أسبوعاً</p>
  return (
    <div className="h-36" dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 180 }}>
        <BarChart data={data} margin={{ left: 0, right: 4, top: 6 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
          <YAxis {...AXIS} width={28} allowDecimals={false} />
          <Tooltip
            {...TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            labelFormatter={(_, x) => `أسبوع ${formatDate(x?.[0]?.payload?.week as string)}`}
            formatter={(v, _n, item) => [
              isOwner ? `${formatNumber(Number(v))} زيارة · ${formatMoney(item?.payload?.spend)}` : `${formatNumber(Number(v))} زيارة`,
              "",
            ]}
          />
          <Bar dataKey="visits" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function whenHint(p: CustomerProfile): string | undefined {
  if (!p.visits) return undefined
  // The busiest two-hour window, and the busiest day.
  let best = 0
  let at = 0
  for (let i = 0; i < p.hours.length - 1; i++) {
    const s = p.hours[i].visits + p.hours[i + 1].visits
    if (s > best) {
      best = s
      at = i
    }
  }
  const from = p.hours[at].hour
  const to = (from + 2) % 24
  const day = p.weekdays.indexOf(Math.max(...p.weekdays))
  return `غالباً بين ${hourLabel(from)} و${hourLabel(to)} · أكثر يوم ${WEEKDAYS[day]}`
}

/** The last 12 weeks, then one line on when in the day and week they come. */
function Rhythm({ profile: p, isOwner }: { profile: CustomerProfile; isOwner: boolean }) {
  const maxD = Math.max(...p.weekdays, 1)
  const hint = whenHint(p)
  return (
    <div className="space-y-3">
      <WeekBars profile={p} isOwner={isOwner} />
      {hint ? (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="flex gap-1" aria-label="الزيارات حسب اليوم">
            {WEEKDAYS.map((d, i) => {
              const v = p.weekdays[i]
              return (
                <div key={d} className="text-center" title={`${d}: ${formatNumber(v)} زيارة`}>
                  <div
                    className="h-5 w-7 rounded-md"
                    style={{ background: `color-mix(in oklch, var(--chart-1) ${Math.round(8 + (v / maxD) * 80)}%, transparent)` }}
                  />
                  <p className={cn("mt-0.5 text-[9px]", v === maxD ? "font-bold text-foreground" : "text-muted-foreground")}>
                    {d.replace("ال", "").slice(0, 3)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── receipts ────────────────────────────────────────────────────────── */

type OrderLine =
  | { kind: "sale"; id: string; s: Order }
  | { kind: "app"; id: string; o: AppOrder }

const whenText = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-u-nu-latn", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"

function saleItems(o: Order): string {
  return (o.items ?? [])
    .map((it) => {
      const r = it as { medication_name?: string; variant_label?: string; quantity?: string | number }
      const q = Number(r.quantity ?? 1)
      return `${q > 1 ? `${q}× ` : ""}${r.medication_name ?? ""}${r.variant_label ? ` ${r.variant_label}` : ""}`
    })
    .filter(Boolean)
    .join("، ")
}
function saleNotes(o: Order): string {
  return [(o as { note?: string }).note, ...(o.items ?? []).map((it) => (it as { note?: string }).note)]
    .map((n) => n?.trim())
    .filter(Boolean)
    .join(" · ")
}

/** Everything this customer ordered: at the till, or from the app — one table. */
function OrdersTable({
  customerId,
  sales,
  salesCount,
  loading,
  page,
  pageCount,
  onPage,
  onOpenSale,
}: {
  customerId: number
  sales: Order[]
  salesCount: number
  loading: boolean
  page: number
  pageCount: number
  onPage: (p: number) => void
  onOpenSale: (o: Order) => void
}) {
  const [src, setSrc] = useState<"sale" | "app">("sale")
  const app = useQuery({
    queryKey: ["orders", "customer", customerId],
    queryFn: () => ordersList({ customer: customerId, page_size: 50 }).then((r) => r.data.results ?? []),
    enabled: Number.isFinite(customerId),
  })
  const appRows = app.data ?? []
  const rows: OrderLine[] =
    src === "sale"
      ? sales.map((s) => ({ kind: "sale", id: `s${s.id}`, s }))
      : appRows.map((o) => ({ kind: "app", id: `a${o.id}`, o }))

  const columns: Column<OrderLine>[] = [
    {
      key: "when",
      header: "متى",
      width: "w-44",
      cell: (r) => <span className="text-xs text-muted-foreground">{whenText(r.kind === "sale" ? r.s.created_at : r.o.created_at)}</span>,
    },
    {
      key: "what",
      header: "ماذا طلب",
      cell: (r) => {
        const items = r.kind === "sale" ? saleItems(r.s) : r.o.items.map((it) => `${Math.round(Number(it.quantity)) > 1 ? `${Math.round(Number(it.quantity))}× ` : ""}${it.name}`).join("، ")
        const notes = r.kind === "sale" ? saleNotes(r.s) : r.o.items.map((it) => it.note).filter(Boolean).join(" · ")
        return (
          <div className="min-w-0 max-w-lg">
            <p className="truncate">{items || "—"}</p>
            {notes ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-800 dark:text-amber-300">
                <StickyNote className="size-3 shrink-0" />
                <span className="truncate">{notes}</span>
              </p>
            ) : null}
          </div>
        )
      },
    },
    {
      key: "status",
      header: src === "sale" ? "الفاتورة" : "الحالة",
      width: "w-32",
      cell: (r) =>
        r.kind === "sale" ? (
          <span className="text-xs text-muted-foreground" dir="ltr">
            {r.s.receipt_code ? `#${r.s.receipt_code}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.o.status_label}</span>
        ),
    },
    {
      key: "points",
      header: "النقاط",
      width: "w-24",
      align: "end",
      cell: (r) => {
        const earned = r.kind === "sale" ? r.s.beans_earned ?? 0 : 0
        const spent = r.kind === "sale" ? r.s.beans_spent ?? 0 : Number(r.o.beans_spent ?? 0)
        return earned || spent ? (
          <span className="text-xs tabular-nums" dir="ltr">
            {spent ? <span className="text-muted-foreground">−{formatNumber(spent)} </span> : null}
            {earned ? <span className="text-emerald-700 dark:text-emerald-400">+{formatNumber(earned)}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      },
    },
    {
      key: "amount",
      header: "المبلغ",
      width: "w-28",
      align: "end",
      cell: (r) => (
        <span className="font-heading font-bold tabular-nums">
          {formatMoney(r.kind === "sale" ? (r.s.discounted_total ?? r.s.total) : Number(r.o.cash_total ?? r.o.total))}
        </span>
      ),
    },
  ]

  return (
    <DataTable<OrderLine>
      rows={rows}
      rowKey={(r) => r.id}
      columns={columns}
      loading={src === "sale" ? loading : app.isLoading}
      onRowClick={(r) => (r.kind === "sale" ? onOpenSale(r.s) : undefined)}
      filters={[
        { id: "sale", label: "من الكاشير", count: salesCount },
        { id: "app", label: "من التطبيق", count: appRows.length },
      ]}
      manual={{ filter: src, onFilter: (v) => setSrc(v as "sale" | "app") }}
      empty={src === "sale" ? "لا فواتير بعد — أول طلب سيظهر هنا." : "لم يطلب من التطبيق بعد."}
      footer={
        src === "sale" && pageCount > 1 ? (
          <div className="border-t border-border/60 px-4 py-2">
            <PaginationBar page={page} pageCount={pageCount} count={salesCount} onPage={onPage} />
          </div>
        ) : null
      }
      mobileRow={(r) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Receipt className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.kind === "sale" ? saleItems(r.s) : r.o.items.map((it) => it.name).join("، ")}</p>
            <p className="text-[11px] text-muted-foreground">{whenText(r.kind === "sale" ? r.s.created_at : r.o.created_at)}</p>
          </div>
          <span className="shrink-0 font-heading text-sm font-bold tabular-nums">
            {formatMoney(r.kind === "sale" ? (r.s.discounted_total ?? r.s.total) : Number(r.o.cash_total ?? r.o.total))}
          </span>
        </div>
      )}
    />
  )
}
