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
import { customerProfile, type CustomerProfile, type CustomerStatus } from "@/api/customer-profile"
import { CountUp } from "@/components/count-up"
import { PointsCard } from "@/components/customers/points-card"
import { CustomerForm } from "@/components/forms/customer-form"
import { LoadMore } from "@/components/load-more"
import { CustomerAppOrders } from "@/components/orders/customer-app-orders"
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

const PAGE_SIZE = 12

type Order = Sale & {
  beans_earned?: number
  beans_spent?: number
  receipt_code?: string | null
}

const WEEKDAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

/* ── wording ─────────────────────────────────────────────────────────── */

function ago(days: number | null): string {
  if (days == null) return "—"
  if (days <= 0) return "اليوم"
  if (days === 1) return "أمس"
  if (days === 2) return "منذ يومين"
  if (days <= 10) return `منذ ${days} أيام`
  return `منذ ${days} يوماً`
}

function every(d: number | null): string | null {
  if (d == null) return null
  if (d <= 1.2) return "يومياً تقريباً"
  if (d < 2.5) return "كل يومين تقريباً"
  if (d <= 10) return `كل ${Math.round(d)} أيام تقريباً`
  return `كل ${Math.round(d)} يوماً تقريباً`
}

function hourLabel(h: number): string {
  const p = h < 12 ? "ص" : "م"
  const x = h % 12 === 0 ? 12 : h % 12
  return `${x}${p}`
}

const STATUS: Record<CustomerStatus, { m: string; f: string; cls: string; dot: string }> = {
  regular: { m: "زبون دائم", f: "زبونة دائمة", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  active: { m: "زبون نشط", f: "زبونة نشطة", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  new: { m: "زبون جديد", f: "زبونة جديدة", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  fading: { m: "غاب عنّا", f: "غابت عنّا", cls: "bg-amber-500/12 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  no_visits: { m: "لم يزرنا بعد", f: "لم تزرنا بعد", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

/* ── the page ────────────────────────────────────────────────────────── */

export default function CustomerDetailPage() {
  const routeParams = useParams<{ id: string }>()
  const id = Number(routeParams?.id)
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const [editOpen, setEditOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Order | null>(null)

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

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title={female ? "طلبها المعتاد" : "طلبه المعتاد"} hint={p ? `من ${formatNumber(toNumber(p.cups))} كوب` : undefined}>
          {p ? <Usual profile={p} /> : <Skeleton className="h-40 rounded-xl" />}
        </Panel>
        <Panel
          className="lg:col-span-3"
          title="آخر ١٢ أسبوعاً"
          hint={p ? `${formatNumber(p.visits_30d)} زيارة في آخر ٣٠ يوماً` : undefined}
        >
          {p ? <Weeks profile={p} isOwner={isOwner} /> : <Skeleton className="h-48 rounded-xl" />}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title={female ? "متى تأتي" : "متى يأتي"} hint={p ? whenHint(p) : undefined}>
          {p ? <When profile={p} /> : <Skeleton className="h-28 rounded-xl" />}
        </Panel>
        <div className="lg:col-span-2">{Number.isFinite(id) ? <PointsCard customerId={id} /> : null}</div>
      </div>

      <CustomerAppOrders customerId={id} />

      <Panel title="الفواتير" hint={p ? `${formatNumber(p.visits)} فاتورة منذ ${formatDate(p.first_visit)}` : undefined} flush>
        {ordersLoading && orders.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground">لا فواتير بعد — أول طلب سيظهر هنا.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} onOpen={() => setDetail(o)} />
            ))}
          </ul>
        )}
        {orders.length > 0 ? (
          <div className="px-4 pb-3">
            <LoadMore hasNext={page < pageCount} isFetchingNext={ordersLoading} onLoad={() => setPage((x) => x + 1)} />
          </div>
        ) : null}
      </Panel>

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
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar className="size-20 shrink-0 ring-4 ring-muted sm:size-24">
            <AvatarImage src={customer?.avatar || undefined} alt="" className="object-cover" />
            <AvatarFallback className="bg-primary/10 font-heading text-2xl text-primary">
              {customer?.name?.charAt(0) ?? ""}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {customer ? (
              <h2 className="truncate font-heading text-2xl font-bold leading-tight">{customer.name}</h2>
            ) : (
              <Skeleton className="h-7 w-44" />
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {status ? (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", status.cls)}>
                  <span className={cn("size-1.5 rounded-full", status.dot)} />
                  {female ? status.f : status.m}
                  {p?.status === "fading" ? ` ${ago(p.days_since_last)}` : ""}
                </span>
              ) : null}
              {customer?.signed_up ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">على التطبيق</span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {female ? "زبونة" : "زبون"} منذ {formatDate(p?.joined ?? customer?.created_at)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {phone ? (
            <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<a href={`tel:${phone}`} />}>
              <Phone className="size-4" />
              <span dir="ltr">{customer?.phone}</span>
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

      {/* the numbers, as one line of facts rather than four boxes */}
      <dl className="grid grid-cols-2 border-t border-border/70 sm:grid-cols-4 [&>div]:border-border/70 [&>div:nth-child(odd)]:border-e sm:[&>div]:border-e sm:[&>div:last-child]:border-e-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div:nth-child(-n+2)]:border-b-0">
        <Fact label="الزيارات" sub={p ? `آخرها ${ago(p.days_since_last)}` : undefined}>
          {p ? <CountUp value={p.visits} /> : "—"}
        </Fact>
        {isOwner ? (
          <>
            <Fact label="صرف عندنا" sub={p?.avg_ticket ? `${formatMoney(p.avg_ticket)} للفاتورة` : undefined}>
              {p?.spent != null ? <CountUp value={toNumber(p.spent)} decimals={2} suffix=" ₪" /> : "—"}
            </Fact>
          </>
        ) : (
          <Fact label="الأكواب" sub="منذ أول زيارة">{p ? <CountUp value={toNumber(p.cups)} /> : "—"}</Fact>
        )}
        <Fact label="يزورنا" sub={p?.first_visit ? `أول زيارة ${formatDate(p.first_visit)}` : undefined}>
          <span className="text-base">{p ? (every(p.every_days) ?? (p.visits ? "مرة واحدة" : "—")) : "—"}</span>
        </Fact>
        <Fact label="النقاط" sub="رصيد قابل للاستخدام">
          {points != null ? <CountUp value={points} /> : "—"}
        </Fact>
      </dl>

      {customer?.notes?.trim() ? (
        <div className="flex items-start gap-2 border-t border-border/70 bg-amber-500/5 px-5 py-3">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{customer.notes}</p>
        </div>
      ) : null}
    </section>
  )
}

function Fact({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-xl font-bold tabular-nums leading-tight">{children}</dd>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p> : null}
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

function Weeks({ profile: p, isOwner }: { profile: CustomerProfile; isOwner: boolean }) {
  const data = p.weekly.map((w) => ({
    label: `${Number(w.week.slice(8))}/${Number(w.week.slice(5, 7))}`,
    week: w.week,
    visits: w.visits,
    spend: toNumber(w.spend),
  }))
  if (!data.some((d) => d.visits)) return <p className="py-10 text-center text-sm text-muted-foreground">لا زيارات في آخر ١٢ أسبوعاً</p>
  return (
    <div className="h-48" dir="ltr">
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

function When({ profile: p }: { profile: CustomerProfile }) {
  // Only the hours the café actually sees anyone in, from the first to the
  // last visit hour (business order: 04:00 first).
  const firstI = p.hours.findIndex((h) => h.visits > 0)
  const lastI = p.hours.length - 1 - [...p.hours].reverse().findIndex((h) => h.visits > 0)
  if (firstI < 0) return <p className="py-6 text-center text-sm text-muted-foreground">لا زيارات بعد</p>
  const pad = Math.max(0, 8 - (lastI - firstI + 1))
  const lo = Math.max(0, firstI - Math.floor(pad / 2))
  const hi = Math.min(p.hours.length - 1, lastI + Math.ceil(pad / 2))
  const hours = p.hours.slice(lo, hi + 1)
  const maxH = Math.max(...hours.map((h) => h.visits), 1)
  const maxD = Math.max(...p.weekdays, 1)

  return (
    <div className="space-y-5">
      <div>
        <div className="flex h-24 items-end gap-1" dir="ltr">
          {hours.map((h, i) => (
            <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${hourLabel(h.hour)}: ${formatNumber(h.visits)} زيارة`}>
              <div
                className={cn(
                  "animate-bar-y w-full rounded-t-md",
                  h.visits === maxH ? "bg-primary" : "bg-primary/30",
                )}
                style={{ height: `${Math.max(h.visits ? 6 : 2, (h.visits / maxH) * 100)}%`, animationDelay: `${i * 30}ms` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1 text-[10px] text-muted-foreground" dir="ltr">
          {hours.map((h, i) => (
            <span key={h.hour} className="flex-1 text-center tabular-nums">
              {i % 2 === 0 ? hourLabel(h.hour) : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => {
          const v = p.weekdays[i]
          const t = v / maxD
          return (
            <div key={d} className="text-center">
              <div
                className="mx-auto h-8 rounded-lg transition-colors"
                style={{ background: `color-mix(in oklch, var(--primary) ${Math.round(8 + t * 72)}%, transparent)` }}
                title={`${d}: ${formatNumber(v)} زيارة`}
              />
              <p className={cn("mt-1 text-[10px]", v === maxD ? "font-bold text-foreground" : "text-muted-foreground")}>
                {d.replace("ال", "")}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── receipts ────────────────────────────────────────────────────────── */

function OrderRow({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const when = order.created_at ? new Date(order.created_at) : null
  const names = (order.items ?? [])
    .map((it) => {
      const r = it as { medication_name?: string; variant_label?: string; quantity?: string | number }
      const q = Number(r.quantity ?? 1)
      return `${q > 1 ? `${q}× ` : ""}${r.medication_name ?? ""}${r.variant_label ? ` ${r.variant_label}` : ""}`
    })
    .filter(Boolean)
  const earned = order.beans_earned ?? 0
  const spent = order.beans_spent ?? 0
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-muted/40 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Receipt className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{names.join("، ") || "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {when ? when.toLocaleString("ar-u-nu-latn", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
            {order.receipt_code ? (
              <span dir="ltr" className="ms-1.5">
                #{order.receipt_code}
              </span>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="font-heading text-sm font-bold tabular-nums">{formatMoney(order.discounted_total ?? order.total)}</p>
          {earned || spent ? (
            <p className="text-[11px] tabular-nums" dir="ltr">
              {spent ? <span className="text-muted-foreground">−{formatNumber(spent)} </span> : null}
              {earned ? <span className="text-emerald-700 dark:text-emerald-400">+{formatNumber(earned)}</span> : null}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
}
