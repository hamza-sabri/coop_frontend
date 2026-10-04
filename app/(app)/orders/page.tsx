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
import { Check, ChevronDown, CloudOff, Coins, Pencil, ReceiptText, ShoppingBag, StickyNote } from "lucide-react"
import { toast } from "sonner"

import { saleItemName, salesDelete, salesList, salesStats, salesSummary, type Sale } from "@/api/sales"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable, type Column } from "@/components/data-table"
import { Enter, PageShell } from "@/components/page-shell"
import { PaginationBar } from "@/components/pagination-bar"
import { SaleDetail } from "@/components/sales/sale-detail"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { usePagedList } from "@/hooks/use-paged-list"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { LOCAL_SALE_LABEL, isLocalSale } from "@/lib/offline/local-sale"
import { businessToday } from "@/lib/period"
import { invalidateSaleData } from "@/lib/sale-queries"
import { cn } from "@/lib/utils"

/* The list is left open on the counter screen, so it polls. */
const LIVE_MS = 15_000
const PAGE_SIZE = 20

type PeriodId = "today" | "yesterday" | "week" | "month" | "all"
type PayId = "all" | "cash" | "return"

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
  const [page, setPage] = useState(1)
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
      ...periodRange(period, today),
      item: search || undefined,
      payment_method: pay === "cash" ? "cash" : undefined,
      is_return: pay === "return" ? true : pay === "cash" ? false : undefined,
      created_by: cashier?.id,
      ordering: "-created_at",
    }),
    [period, today, search, pay, cashier],
  )
  useEffect(() => setPage(1), [params])

  const { results, count, pageCount, isLoading, isFetching, isPlaceholderData } = usePagedList<Sale>(
    ["sales"],
    salesList,
    params,
    page,
    PAGE_SIZE,
    true,
    LIVE_MS,
  )
  // What the current filter shows, counted by the server.
  const summary = useQuery({
    queryKey: ["sales", "summary", params],
    queryFn: () => salesSummary(params).then((r) => r.data),
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
      const next = new Map(prev)
      for (const s of results) if (s.created_by != null && s.created_by_name) next.set(s.created_by, s.created_by_name)
      return next
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
      await salesDelete(toVoid.id)
      toast.success("أُلغيت الفاتورة وعادت المكونات إلى المخزون")
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
          {summary.data ? `${formatNumber(summary.data.count)} فاتورة` : "…"}
        </p>
        {isOwner && summary.data?.total != null ? (
          <p className="text-lg font-semibold tabular-nums text-muted-foreground">· {formatMoney(summary.data.total)}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {{ today: "اليوم", yesterday: "أمس", week: "في آخر ٧ أيام", month: "هذا الشهر", all: "منذ البداية" }[period]}
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
            filter: period,
            onFilter: (id) => setPeriod(id as PeriodId),
          }}
          toolbar={
            <>
              <Menu
                label={{ all: "كل الفواتير", cash: "المبيعات فقط", return: "المرتجعات فقط" }[pay]}
                options={[
                  { id: "all", label: "كل الفواتير" },
                  { id: "cash", label: "المبيعات فقط" },
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
            pageCount > 1 ? (
              <div className="border-t border-border/60 px-4 py-2">
                <PaginationBar page={page} pageCount={pageCount} count={count} onPage={setPage} loading={isFetching} />
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
    <span className={cn("pill", sale.payment_method === "cash" ? "pill-success" : "pill-warning")}>
      {sale.payment_method === "cash" ? "نقدي" : "دين"}
    </span>
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
