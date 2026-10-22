"use client"

/**
 * الفواتير — every sale the till rang, as one table (DESIGN.md §2).
 *
 *   [ابحث برقم الفاتورة أو المشروب…] [اليوم 12][أمس 40][آخر ٧ أيام][هذا الشهر][الكل]   [الدفع ▾][البائع ▾]
 *   12 فاتورة · 420٫00 ₪
 *   الزبون · ماذا طلب · المبلغ · الدفع · الوقت · البائع
 *
 * The period is a chip, not a form: "today" is one tap. The count and the
 * total under the chips are the SERVER's for exactly what the table shows
 * (business days, refunds off) — the money only for the owner.
 *
 * Nothing destructive lives here as a button. Cancelling one sale is inside
 * that sale, behind a confirmation.
 */
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, Clock, CloudOff, Coins, Pencil, ReceiptText, ShoppingBag, StickyNote } from "lucide-react"
import { toast } from "sonner"

import { saleItemName, salesDelete, salesList, salesStats, salesSummary, type Sale } from "@/api/sales"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable, type Column } from "@/components/data-table"
import { Enter, PageShell } from "@/components/page-shell"
import { LoadMore } from "@/components/load-more"
import { Input } from "@/components/ui/input"
import { useInfiniteList } from "@/hooks/use-infinite-list"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SaleDetail } from "@/components/sales/sale-detail"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { LOCAL_SALE_LABEL, isLocalSale } from "@/lib/offline/local-sale"
import { businessToday } from "@/lib/period"
import { invalidateSaleData } from "@/lib/sale-queries"
import { cn } from "@/lib/utils"
import { payLabel, payPill } from "@/lib/payment"

/* The list is left open on the counter screen, so it polls. */
const LIVE_MS = 15_000
const PAGE_SIZE = 20

type PeriodId = "today" | "yesterday" | "week" | "month" | "all"
type PayId = "all" | "sales" | "cash" | "card" | "return"

function days(today: string, back: number): string {
  const d = new Date(`${today}T00:00:00`)
  d.setDate(d.getDate() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function periodRange(p: PeriodId, today: string): { day_from?: string; day_to?: string } {
  if (p === "today") return { day_from: today, day_to: today }
  if (p === "yesterday") return { day_from: days(today, 1), day_to: days(today, 1) }
  if (p === "week") return { day_from: days(today, 6), day_to: today }
  if (p === "month") return { day_from: `${today.slice(0, 8)}01`, day_to: today }
  return {}
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("ar-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

function itemsLine(s: Sale): string {
  const head = s.items
    .slice(0, 2)
    .map((it) => `${Number(it.quantity) > 1 ? `${Number(it.quantity)}× ` : ""}${saleItemName(it)}`)
    .join("، ")
  return s.items.length > 2 ? `${head} و${formatNumber(s.items.length - 2)} غيرها` : head
}
function notesOf(s: Sale): string[] {
  return [
    (s as { note?: string }).note?.trim(),
    ...s.items.map((it) => (it as { note?: string }).note?.trim()),
  ].filter(Boolean) as string[]
}

export default function SalesPage() {
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const today = businessToday()
  const [searchRaw, setSearchRaw] = useState("")
  const search = useDebounced(searchRaw, 300)
  const [period, setPeriod] = useState<PeriodId>("today")
  const [pay, setPay] = useState<PayId>("all")
  const [cashier, setCashier] = useState<{ id: number; name: string } | null>(null)
  /** Exact time window (date + hour + minute), as datetime-local strings. */
  const [atFrom, setAtFrom] = useState("")
  const [atTo, setAtTo] = useState("")
  const timed = Boolean(atFrom || atTo)
  const [detail, setDetail] = useState<Sale | null>(null)
  const [toVoid, setToVoid] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [cashiers, setCashiers] = useState<Map<number, string>>(new Map())

  // ?search= deep link — the stock statement links each movement to its
  // receipt, and that link has to land on the invoice, whatever its day.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search")
    if (q) {
      setSearchRaw(q)
      setPeriod("all")
    }
  }, [])

  const params = useMemo(
    () => ({
      // A time window replaces the period chips.
      ...(timed
        ? {
            at_from: atFrom ? new Date(atFrom).toISOString() : undefined,
            at_to: atTo ? new Date(atTo).toISOString() : undefined,
          }
        : periodRange(period, today)),
      item: search || undefined,
      payment_method: pay === "cash" || pay === "card" ? pay : undefined,
      is_return: pay === "return" ? true : pay === "all" ? undefined : false,
      created_by: cashier?.id,
      ordering: "-created_at",
    }),
    [period, today, search, pay, cashier, timed, atFrom, atTo],
  )

  // Infinite scroll: the next 20 load as the list's end comes into view.
  const {
    items: results, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteList<Sale>(["sales"], salesList, { ...params, page_size: PAGE_SIZE }, true, LIVE_MS)
  const isPlaceholderData = false
  // What the current filter shows, counted by the server.
  const summary = useQuery({
    queryKey: ["sales", "summary", params],
    queryFn: () => salesSummary(params).then((r) => r.data),
    enabled: isOwner,
    refetchInterval: LIVE_MS,
    placeholderData: (p) => p,
  })
  // The chips' counts (owner only — period takings are the owner's).
  const stats = useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => (await salesStats()).data,
    enabled: isOwner,
    refetchInterval: LIVE_MS,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!results.length) return
    setCashiers((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const s of results)
        if (s.created_by != null && s.created_by_name && next.get(s.created_by) !== s.created_by_name) {
          next.set(s.created_by, s.created_by_name)
          changed = true
        }
      return changed ? next : prev // same Map → React skips the re-render
    })
  }, [results])

  // A term typed but not yet sent, or a new filter still loading, hides the
  // old rows. A background poll (isFetching on the SAME filter) does not —
  // the counter screen must not blink every fifteen seconds.
  const searching = isLoading || isPlaceholderData || searchRaw.trim() !== search.trim()

  async function confirmVoid() {
    if (!toVoid) return
    setVoiding(true)
    try {
      const r = (await salesDelete(toVoid.id))?.data
      // Say only what happened: a return never took ingredients, and a drink
      // with no recipe (or an imported sale) has nothing to put back.
      toast.success(
        !r || typeof r.restocked !== "number"
          ? "أُلغيت الفاتورة"
          : r.was_return
            ? "أُلغي الإرجاع — المخزون لم يتغيّر"
            : r.restocked > 0
              ? "أُلغيت الفاتورة وعادت مكوناتها إلى المخزون"
              : "أُلغيت الفاتورة — لم تكن سحبت مكونات من المخزون",
      )
      invalidateSaleData(qc)
      setToVoid(null)
      setDetail(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإلغاء")
    } finally {
      setVoiding(false)
    }
  }

  const P = stats.data?.periods
  const columns: Column<Sale>[] = [
    {
      key: "customer",
      header: "الزبون",
      width: "w-56",
      cell: (s) => <CustomerCell sale={s} />,
    },
    {
      key: "items",
      header: "ماذا طلب",
      cell: (s) => {
        const notes = notesOf(s)
        return (
          <div className="min-w-0 max-w-md">
            <p className="truncate">{itemsLine(s)}</p>
            {notes.length ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-800 dark:text-amber-300">
                <StickyNote className="size-3 shrink-0" />
                <span className="truncate">{notes.join(" · ")}</span>
              </p>
            ) : null}
          </div>
        )
      },
    },
    {
      key: "amount",
      header: "المبلغ",
      align: "end",
      width: "w-32",
      cell: (s) => (
        <div>
          <p className={cn("font-heading font-bold tabular-nums", s.is_return && "text-destructive")}>
            {s.is_return ? "−" : ""}
            {formatMoney(s.discounted_total)}
          </p>
          {(s.beans_spent ?? 0) > 0 ? (
            <p className="flex items-center justify-end gap-1 text-[11px] text-amber-700 dark:text-amber-300" title="جزء من الفاتورة دُفع بنقاط الزبون">
              <Coins className="size-3" />
              {formatNumber(s.beans_spent ?? 0)} نقطة
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "pay",
      header: "الدفع",
      align: "center",
      width: "w-24",
      cell: (s) => <PayPill sale={s} />,
    },
    {
      key: "when",
      header: "الوقت",
      width: "w-36",
      cell: (s) => <span className="text-xs text-muted-foreground">{when(s.created_at)}</span>,
    },
    {
      key: "by",
      header: "البائع",
      width: "w-28",
      hideBelow: "lg",
      cell: (s) => <span className="text-xs text-muted-foreground">{s.created_by_name || "—"}</span>,
    },
    {
      key: "edit",
      header: "",
      width: "w-12",
      align: "end",
      cell: (s) =>
        !isLocalSale(s.id) ? (
          <Link
            href={`/pos?edit=${s.id}`}
            onClick={(e) => e.stopPropagation()}
            title="تعديل الفاتورة على الكاشير"
            aria-label="تعديل الفاتورة"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground/60 transition hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="size-4" />
          </Link>
        ) : null,
    },
  ]

  return (
    <PageShell
      title="الفواتير"
      action={
        <Button size="sm" className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25" render={<Link href="/pos" />} nativeButton={false}>
          <ShoppingBag className="size-4" />
          بيع جديد
        </Button>
      }
    >
      <Enter i={0} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-heading text-2xl font-bold tabular-nums">
          {/* How many invoices, like what they took, is the owner's figure. */}
          {!isOwner ? "الفواتير" : summary.data?.count != null ? `${formatNumber(summary.data.count)} فاتورة` : "…"}
        </p>
        {isOwner && summary.data?.total != null ? (
          <p className="text-lg font-semibold tabular-nums text-muted-foreground">· {formatMoney(summary.data.total)}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {timed
            ? `${atFrom ? `من ${stamp(atFrom)}` : ""}${atFrom && atTo ? " " : ""}${atTo ? `إلى ${stamp(atTo)}` : ""}`
            : { today: "اليوم", yesterday: "أمس", week: "في آخر ٧ أيام", month: "هذا الشهر", all: "منذ البداية" }[period]}
          {search ? ` · تطابق «${search}»` : ""}
          {cashier ? ` · باعها ${cashier.name}` : ""}
        </p>
      </Enter>

      <Enter i={1}>
        <DataTable<Sale>
          rows={searching ? [] : results}
          rowKey={(s) => s.id}
          columns={columns}
          loading={searching}
          onRowClick={(s) => setDetail(s)}
          rowClassName={(s) => (s.is_return ? "bg-rose-500/[0.03]" : undefined)}
          searchPlaceholder="ابحث برقم الفاتورة أو اسم المشروب…"
          filters={[
            { id: "today", label: "اليوم", count: P?.today.count },
            { id: "yesterday", label: "أمس", count: P?.yesterday.count },
            { id: "week", label: "آخر ٧ أيام", count: P?.week.count },
            { id: "month", label: "هذا الشهر", count: P?.month.count },
            { id: "all", label: "الكل" },
          ]}
          manual={{
            search: searchRaw,
            onSearch: setSearchRaw,
            filter: timed ? "" : period,
            onFilter: (id) => {
              setPeriod(id as PeriodId)
              setAtFrom("")
              setAtTo("")
            },
          }}
          toolbar={
            <>
              <TimeWindow
                from={atFrom}
                to={atTo}
                onChange={(f, t) => {
                  setAtFrom(f)
                  setAtTo(t)
                }}
              />
              <Menu
                label={{ all: "كل الفواتير", sales: "المبيعات فقط", cash: "مبيعات نقدية", card: "مبيعات بالبطاقة", return: "المرتجعات فقط" }[pay]}
                options={[
                  { id: "all", label: "كل الفواتير" },
                  { id: "sales", label: "المبيعات فقط" },
                  { id: "cash", label: "مبيعات نقدية" },
                  { id: "card", label: "مبيعات بالبطاقة" },
                  { id: "return", label: "المرتجعات فقط" },
                ]}
                value={pay}
                onChange={(v) => setPay(v as PayId)}
              />
              <Menu
                label={cashier ? cashier.name : "كل البائعين"}
                options={[{ id: "", label: "كل البائعين" }, ...[...cashiers.entries()].map(([id, name]) => ({ id: String(id), label: name }))]}
                value={cashier ? String(cashier.id) : ""}
                onChange={(v) => setCashier(v ? { id: Number(v), name: cashiers.get(Number(v)) ?? "" } : null)}
              />
            </>
          }
          empty={
            search
              ? `لا فاتورة تطابق «${search}».`
              : period === "today"
                ? "لا مبيعات اليوم بعد — أول بيعة ستظهر هنا فوراً."
                : "لا فواتير في هذه الفترة."
          }
          footer={
            hasNextPage ? (
              <div className="border-t border-border/60">
                <LoadMore hasNext={Boolean(hasNextPage)} isFetchingNext={isFetchingNextPage} onLoad={() => fetchNextPage()} />
              </div>
            ) : null
          }
          mobileRow={(s) => (
            <div className="flex items-center gap-3">
              <SaleAvatar sale={s} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.customer_name || "زبون بدون اسم"}</p>
                <p className="truncate text-xs text-muted-foreground">{itemsLine(s)}</p>
                {notesOf(s).length ? (
                  <p className="truncate text-[11px] text-amber-800 dark:text-amber-300">{notesOf(s).join(" · ")}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-end">
                <p className={cn("font-heading text-sm font-bold tabular-nums", s.is_return && "text-destructive")}>
                  {s.is_return ? "−" : ""}
                  {formatMoney(s.discounted_total)}
                </p>
                <p className="text-[11px] text-muted-foreground">{when(s.created_at)}</p>
              </div>
            </div>
          )}
        />
      </Enter>

      <SaleDetail sale={detail} open={detail != null} onOpenChange={(o) => !o && setDetail(null)} onVoid={(s) => setToVoid(s)} />
      <ConfirmDelete
        open={Boolean(toVoid)}
        onOpenChange={(o) => !o && setToVoid(null)}
        onConfirm={confirmVoid}
        loading={voiding}
        title="إلغاء الفاتورة؟"
        description={`تُلغى الفاتورة ${toVoid?.receipt_code ? `#${toVoid.receipt_code} ` : ""}وتعود مكوناتها إلى المخزون. يبقى أثر الإلغاء في سجل المخزون.`}
        confirmLabel="إلغاء الفاتورة"
      />
    </PageShell>
  )
}

function SaleAvatar({ sale: s }: { sale: Sale }) {
  const avatar = (s as { customer_avatar?: string }).customer_avatar
  return (
    <Avatar className="size-9 shrink-0">
      {avatar ? <AvatarImage src={avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn("text-sm font-bold", s.customer_name ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        {s.customer_name?.trim().charAt(0) || <ReceiptText className="size-4" />}
      </AvatarFallback>
    </Avatar>
  )
}

function CustomerCell({ sale: s }: { sale: Sale }) {
  return (
    <div className="flex items-center gap-2.5">
      <SaleAvatar sale={s} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-semibold">
          {s.customer_name || <span className="font-normal text-muted-foreground">زبون بدون اسم</span>}
          {isLocalSale(s.id) ? (
            <span className="pill pill-warning shrink-0 gap-1 text-[10px]" title="سُجّلت أثناء انقطاع الاتصال وستُرفع تلقائياً">
              <CloudOff className="size-3" />
              {LOCAL_SALE_LABEL}
            </span>
          ) : null}
          {(s.revision_count ?? 0) > 0 ? (
            <span className="pill pill-warning shrink-0 gap-1 text-[10px]" title={`عُدّلت ${s.revision_count} مرة`}>
              <Pencil className="size-3" />
              معدّلة
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {s.receipt_code ? `#${s.receipt_code}` : formatDate(s.created_at)}
        </p>
      </div>
    </div>
  )
}

function PayPill({ sale }: { sale: Sale }) {
  if (sale.is_return) return <span className="pill pill-danger">إرجاع</span>
  return (
    <span className={cn("pill", payPill(sale.payment_method))}>{payLabel(sale.payment_method)}</span>
  )
}

function Menu({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
            {label}
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => onChange(o.id)}>
            <Check className={cn("size-4", value === o.id ? "opacity-100" : "opacity-0")} />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const stamp = (v: string) =>
  new Date(v).toLocaleString("ar-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/** One filter: from a moment to a moment — date, hour and minute. */
function TimeWindow({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  useEffect(() => {
    if (open) {
      setF(from)
      setT(to)
    }
  }, [open, from, to])
  const on = Boolean(from || to)
  const bad = Boolean(f && t && f > t)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 rounded-xl", on && "border-primary bg-primary/5 text-primary")}>
            <Clock className="size-3.5" />
            {on ? `${from ? stamp(from) : "…"} ← ${to ? stamp(to) : "الآن"}` : "الوقت"}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">من</span>
          <Input type="datetime-local" dir="ltr" value={f} onChange={(e) => setF(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">إلى</span>
          <Input type="datetime-local" dir="ltr" value={t} onChange={(e) => setT(e.target.value)} />
        </label>
        {bad ? <p className="text-xs text-destructive">«من» بعد «إلى».</p> : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={bad || (!f && !t)}
            onClick={() => {
              onChange(f, t)
              setOpen(false)
            }}
          >
            تطبيق
          </Button>
          {on ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange("", "")
                setOpen(false)
              }}
            >
              مسح
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
