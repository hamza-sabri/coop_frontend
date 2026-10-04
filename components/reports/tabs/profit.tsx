"use client"

/* الأرباح — the statement, read top to bottom: what was sold, what came off
 * it, what it cost, what was left. A shift chip narrows it to one shift and
 * swaps net profit for what the shift contributed after its wages. */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"

import { fetchPnl, type PnlQuery } from "@/api/finance"
import { Failed, Panel, TabSkeleton } from "@/components/reports/kit"
import { Bars, Waterfall, type Step } from "@/components/charts"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ProfitTab({ q }: { q: PnlQuery }) {
  const [shiftId, setShiftId] = useState<number | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "pnl", q.period, q.date, shiftId],
    queryFn: () => fetchPnl({ ...q, shift: shiftId }).then((r) => r.data),
    placeholderData: (p) => p,
  })
  if (isLoading && !data) return <TabSkeleton />
  if (!data) return <Failed />

  const L = data.lines
  const net = toNumber(L.net_revenue)
  const isShift = Boolean(data.shift)
  const gross = toNumber(L.gross_sales)
  const offTill = toNumber(L.discounts) + toNumber(L.points_redeemed) + toNumber(L.returns)
  const drinks = toNumber(L.cogs)
  const lost = toNumber(L.waste) + toNumber(L.remakes) + toNumber(L.count_shortfall)
  const last = isShift ? toNumber(L.shift_wages) : toNumber(L.opex)
  const left = isShift ? toNumber(L.contribution) : toNumber(L.net_profit)

  const steps: Step[] = [
    { label: "بعت", value: gross, kind: "start" },
    ...(offTill ? [{ label: "خصومات ونقاط", value: offTill, kind: "minus" as const }] : []),
    { label: "كلفة المشروبات", value: drinks, kind: "minus" },
    ...(lost > 0 ? [{ label: "هدر وتلف", value: lost, kind: "minus" as const }] : lost < 0 ? [{ label: "زيادة جرد", value: -lost, kind: "plus" as const }] : []),
    { label: isShift ? "أجور الوردية" : "المصاريف", value: last, kind: "minus" },
    { label: "بقي لك", value: left, kind: "total" },
  ]

  type Line = { label: string; hint?: string; amount: number; minus?: boolean; strong?: boolean; detail?: { label: string; amount: number }[] }
  const lines: Line[] = [
    { label: "بعت بسعر المنيو", amount: gross },
    ...(offTill
      ? [
          {
            label: "خصومات ونقاط ومرتجعات",
            amount: offTill,
            minus: true,
            detail: [
              { label: "خصم الكاشير", amount: toNumber(L.discounts) },
              { label: "دُفع بالنقاط", amount: toNumber(L.points_redeemed) },
              { label: "مرتجعات أُعيد ثمنها", amount: toNumber(L.returns) },
            ].filter((x) => x.amount),
          },
        ]
      : []),
    { label: "دخل الصندوق", hint: "ما دخل فعلاً", amount: net, strong: true },
    { label: "كلفة المشروبات المباعة", amount: drinks, minus: true },
    ...(lost
      ? [
          {
            label: lost > 0 ? "هدر وتلف ونقص في الجرد" : "زيادة في الجرد",
            amount: Math.abs(lost),
            minus: lost > 0,
            detail: [
              { label: "هدر", amount: toNumber(L.waste) },
              { label: "إعادة تحضير", amount: toNumber(L.remakes) },
              { label: "نقص في الجرد", amount: toNumber(L.count_shortfall) },
            ].filter((x) => x.amount),
          },
        ]
      : []),
    isShift
      ? { label: "أجور الوردية", hint: `${formatMoney(data.shift?.wage_per_day)} × ${data.range.days} يوم`, amount: last, minus: true }
      : { label: "المصاريف", hint: "إيجار، رواتب، فواتير — حصة هذه الأيام", amount: last, minus: true },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={isShift ? `ماذا بقي من وردية ${data.shift?.name}` : "من البيع إلى الربح"}
          hint={`${data.range.days} ${data.range.days === 1 ? "يوم" : "أيام"}${data.range.elapsed_end < data.range.end ? " حتى اليوم" : ""} — كل عمود يُطرح مما قبله`}
          action={
            data.shifts.length > 0 ? (
              // Which shift — beside the chart it changes, never a row of its own.
              <div className="inline-flex shrink-0 rounded-xl border border-border bg-card p-0.5" role="tablist" aria-label="الوردية">
                {[{ id: null as number | null, name: "كل اليوم", start: "", end: "" }, ...data.shifts].map((sh) => (
                  <button
                    key={sh.id ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={shiftId === sh.id}
                    title={sh.start ? `${sh.start}–${sh.end}` : undefined}
                    onClick={() => setShiftId(sh.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      shiftId === sh.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {sh.name}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          <Waterfall steps={steps} format={(v) => formatMoney(v)} height={280} />
        </Panel>

        <Panel className="lg:col-span-2" title="الحساب بالتفصيل">
          <ul className="divide-y divide-border/70 text-sm">
            {lines.map((l) => (
              <li key={l.label} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn(l.strong ? "font-semibold" : l.minus ? "text-muted-foreground" : "")}>
                    {l.minus ? "− " : ""}
                    {l.label}
                    {l.hint ? <span className="ms-1.5 text-[11px] text-muted-foreground">{l.hint}</span> : null}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", l.strong ? "font-bold" : "font-semibold")}>{formatMoney(l.amount)}</span>
                </div>
                {l.detail && l.detail.length > 1 ? (
                  <ul className="mt-1 space-y-0.5 ps-3 text-[11px] text-muted-foreground">
                    {l.detail.map((x) => (
                      <li key={x.label} className="flex justify-between">
                        <span>{x.label}</span>
                        <span className="tabular-nums">{formatMoney(x.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <div
            className={cn(
              "mt-2 flex items-baseline justify-between rounded-xl px-3 py-3",
              left >= 0 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300",
            )}
          >
            <span className="font-semibold">{isShift ? "ما بقي من الوردية" : left >= 0 ? "ربحك" : "خسارتك"}</span>
            <span className="font-heading text-xl font-bold tabular-nums">{formatMoney(Math.abs(left))}</span>
          </div>
        </Panel>
      </div>

      {!isShift ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel className="lg:col-span-3" title="المصاريف حسب النوع" hint="حصة هذه الأيام من كل مصروف">
            {(data.opex ?? []).filter((o) => toNumber(o.amount) > 0).length ? (
              <Bars
                height={200}
                showValues
                data={(data.opex ?? []).filter((o) => toNumber(o.amount) > 0).map((o) => ({ label: o.name, value: toNumber(o.amount) }))}
                format={(v) => formatMoney(v)}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">لا مصاريف مسجلة — أضفها من صفحة المصاريف.</p>
            )}
          </Panel>
          <Panel className="lg:col-span-2" title={<span className="flex items-center gap-1.5"><Info className="size-4 text-muted-foreground" />للعلم — لا يُطرح من الربح</span>}>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt>
                  نقاط عند الزبائن لم تُستخدم بعد
                  <p className="text-[11px] text-muted-foreground">{formatNumber(data.memo.points_outstanding)} نقطة — ستُخصم حين يستخدمونها</p>
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoney(data.memo.points_outstanding_value)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt>
                  اشتريت مخزوناً بقيمة
                  <p className="text-[11px] text-muted-foreground">يُحسب في الربح حين يُباع في مشروب، لا يوم الشراء</p>
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoney(data.memo.purchases)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
