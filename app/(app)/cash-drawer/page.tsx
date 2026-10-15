"use client"

/* سجل الصندوق — every opening and closing of the till's cash drawer.
   Who opened, who closed, with how much, and whether it matched. */
import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { CreditCard, Printer, Vault } from "lucide-react"

import { cashDrawerHistory, type CashSession } from "@/api/cash-drawer"
import { differenceWords } from "@/components/pos/cash-drawer"
import { Enter, PageShell } from "@/components/page-shell"
import { PaginationBar } from "@/components/pagination-bar"
import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { printCashRecord } from "@/lib/print/cash-record"
import { cn } from "@/lib/utils"

const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "—"

export default function CashDrawerHistoryPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["cash-drawer", "history", page],
    queryFn: () => cashDrawerHistory(page).then((r) => r.data),
    placeholderData: (p) => p,
  })
  const rows = data?.results ?? []
  const pageCount = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1

  return (
    <PageShell title="سجل الصندوق">
      <Enter i={0}>
        <p className="text-sm text-muted-foreground">
          كل فتح وإغلاق للصندوق: من فتحه وبكم، من أغلقه وبكم، والفرق. اضغط على سجل لرؤية كل العمليات وطباعته.
        </p>
      </Enter>
      <Enter i={1}>
        {isError && !data ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading && !data ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Vault className="size-7" /></span>
            <p className="font-heading text-base font-bold">لا إغلاقات بعد</p>
            <p className="max-w-sm text-sm text-muted-foreground">أول مرة يُغلق فيها الصندوق من شاشة البيع يظهر سجلها هنا.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold text-muted-foreground md:grid">
              <span>اليوم</span><span>فتح</span><span>أغلق</span><span className="text-end">بدأ بـ</span><span className="text-end">عُدّ</span><span className="text-end">المبيعات</span><span>الفرق</span>
            </div>
            <ul className="divide-y divide-border/70">
              {rows.map((r) => <Row key={r.id} r={r} />)}
            </ul>
            {pageCount > 1 ? (
              <div className="border-t border-border/60 px-4 py-2">
                <PaginationBar page={page} pageCount={pageCount} count={data?.count ?? 0} onPage={setPage} loading={isFetching} />
              </div>
            ) : null}
          </div>
        )}
      </Enter>
    </PageShell>
  )
}

function Row({ r }: { r: CashSession }) {
  const d = differenceWords(toNumber(r.difference ?? "0"))
  const card = r.card_difference != null ? differenceWords(toNumber(r.card_difference)) : null
  return (
    <li className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-3">
      <Link href={`/cash-drawer/${r.id}`} className="min-w-0 font-semibold hover:underline">
        {formatDate(r.closed_at ?? r.opened_at)}
        <span className="block text-[11px] font-normal text-muted-foreground">{time(r.opened_at)} ← {time(r.closed_at)}</span>
      </Link>
      <span className="truncate"><span className="text-[11px] text-muted-foreground md:hidden">فتح: </span>{r.opened_by || "—"}</span>
      <span className="truncate"><span className="text-[11px] text-muted-foreground md:hidden">أغلق: </span>{r.closed_by || "—"}</span>
      <span className="tabular-nums md:text-end"><span className="text-[11px] text-muted-foreground md:hidden">بدأ بـ </span>{formatMoney(r.opening_amount)}</span>
      <span className="tabular-nums md:text-end"><span className="text-[11px] text-muted-foreground md:hidden">عُدّ </span>{formatMoney(r.counted_amount ?? "0")}</span>
      <span className="tabular-nums md:text-end">
        <span className="text-[11px] text-muted-foreground md:hidden">المبيعات </span>
        {formatMoney(r.figures?.total_sales ?? r.figures?.cash_sales ?? "0")}
        {r.figures?.tickets != null ? <span className="block text-[11px] text-muted-foreground">{formatNumber(r.figures.tickets)} فاتورة</span> : null}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn("pill", d.tone === "ok" ? "pill-success" : "pill-danger")}>{d.text}</span>
        {card && card.tone !== "ok" ? <span className="pill pill-warning gap-1" title="فرق البطاقة"><CreditCard className="size-3" />{card.text}</span> : null}
        <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="اطبع السجل" onClick={() => void printCashRecord(r.id)}>
          <Printer className="size-4" />
        </Button>
      </span>
    </li>
  )
}
