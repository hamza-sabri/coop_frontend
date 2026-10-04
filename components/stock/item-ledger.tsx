"use client"

/* One raw material's statement for a period — the page to open when someone
 * asks "where did the milk go?".
 *
 *   الرصيد أول الفترة
 *   + شراء  − بيع  − إعادة تحضير  − هدر  ± جرد  ± تعديل
 *   = الرصيد آخر الفترة
 *
 * It adds up to the unit, and the server checks the shelf figure against the
 * sum of every movement ever recorded (مطابق). "بيع" is broken down by drink,
 * and every movement names its receipt. */
import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { formatQty, itemLedger, type InventoryItem } from "@/api/inventory"
import { PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { businessToday } from "@/lib/period"
import { cn } from "@/lib/utils"

const TONE: Record<string, string> = {
  purchase: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  sale: "bg-primary/10 text-primary",
  remake: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  waste: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  count: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  adjust: "bg-muted text-muted-foreground",
}

function signed(q: number, unit: InventoryItem["unit"]) {
  if (q === 0) return formatQty(0, unit, true)
  return `${q > 0 ? "+" : "−"}${formatQty(Math.abs(q), unit, true)}`
}

export function ItemLedger({ item, owner }: { item: InventoryItem; owner: boolean }) {
  const today = businessToday()
  const [p, setP] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "ledger", item.id, p.period, p.anchor],
    queryFn: () => itemLedger(item.id, { period: p.period, date: p.anchor }).then((r) => r.data),
    placeholderData: (x) => x,
  })
  const unit = item.unit

  return (
    <div className="space-y-3 pb-6">
      <PeriodBar value={p} onChange={setP} today={today} />
      {isLoading && !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !data ? null : (
        <>
          <div className="rounded-2xl border border-border/80 bg-card">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">الرصيد أول الفترة</span>
              <b className="tabular-nums">{formatQty(data.opening, unit, true)}</b>
            </div>
            {data.rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">لا حركة في هذه الفترة.</p>
            ) : (
              data.rows.map((r) => (
                <div key={r.kind} className="flex items-center gap-3 border-b border-border/50 px-4 py-2 text-sm">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE[r.kind])}>{r.label}</span>
                  <span className="text-[11px] text-muted-foreground">{r.moves} حركة</span>
                  <span className="ms-auto font-semibold tabular-nums" dir="ltr">{signed(toNumber(r.quantity), unit)}</span>
                  {owner && r.cost != null ? (
                    <span className="w-24 text-end text-[11px] tabular-nums text-muted-foreground">{formatMoney(r.cost)}</span>
                  ) : null}
                </div>
              ))
            )}
            <div className="flex items-center justify-between bg-muted/40 px-4 py-2.5 text-sm">
              <span className="font-semibold">الرصيد آخر الفترة</span>
              <b className="font-heading text-base tabular-nums">{formatQty(data.closing, unit, true)}</b>
            </div>
          </div>

          <p
            className={cn(
              "flex items-start gap-1.5 text-xs",
              data.consistent ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
            )}
          >
            {data.consistent ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
            {data.consistent
              ? `مطابق: الرصيد الحالي ${formatQty(data.stock_now, unit, true)} يساوي مجموع كل الحركات المسجلة.`
              : "غير مطابق — الرصيد الحالي لا يساوي مجموع الحركات. تواصل مع الدعم."}
          </p>

          {data.used_by.length ? (
            <div className="rounded-2xl border border-border/80 bg-card p-4">
              <p className="mb-2 text-sm font-semibold">استُخدم في</p>
              <ul className="space-y-1.5 text-sm">
                {data.used_by.map((u) => (
                  <li key={`${u.product_id}-${u.name}`} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{u.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatQty(u.quantity, unit, true)}
                      <span className="ms-1.5 text-[11px] text-muted-foreground">{u.receipts} فاتورة</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.used_in.length ? (
            <p className="text-xs text-muted-foreground">
              في الوصفات: {data.used_in.map((u) => `${u.name} (${formatQty(u.quantity, unit, true)})`).join("، ")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">ليس في أي وصفة — لا يُخصم مع البيع، يُتابع بالجرد.</p>
          )}

          <div className="rounded-2xl border border-border/80 bg-card">
            <p className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold">الحركات</p>
            {data.moves.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">لا حركات في هذه الفترة.</p> : null}
            <ul className="divide-y divide-border/50">
              {data.moves.map((m) => {
                const q = toNumber(m.quantity)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2">
                    <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE[m.kind])}>{m.kind_label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">
                        {m.product_name || m.reason || "—"}
                        {m.sale ? (
                          <Link href={`/orders?search=${m.receipt_code || m.sale}`} className="ms-1.5 text-primary hover:underline" dir="ltr">
                            #{m.receipt_code || m.sale}
                          </Link>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(m.created_at)} {new Date(m.created_at).toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
                        {m.created_by_name ? ` · ${m.created_by_name}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-xs font-semibold tabular-nums" dir="ltr">{signed(q, unit)}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">الرصيد {formatQty(m.stock_after, unit, true)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            {data.moves.length >= 150 ? (
              <p className="px-4 py-2 text-[11px] text-muted-foreground">آخر ١٥٠ حركة في الفترة — اختر فترة أقصر للمزيد.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
