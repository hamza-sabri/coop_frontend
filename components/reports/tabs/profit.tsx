"use client"

/* الأرباح — the statement, read top to bottom: what was sold, what came off
 * it, what it cost, what was left. A shift chip narrows it to one shift and
 * swaps net profit for what the shift contributed after its wages. */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"

import { fetchPnl, type PnlQuery } from "@/api/finance"
import { Chip } from "@/components/finance/period-bar"
import { BarList, Failed, Panel, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Row = { label: string; amount: number; kind: "line" | "less" | "total" | "grand"; hint?: string; hideIfZero?: boolean }

function pct(part: number, whole: number) {
  return whole ? `${((Math.abs(part) / whole) * 100).toFixed(1)}%` : ""
}

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
  const rows: Row[] = [
    { label: "المبيعات بسعر المنيو", amount: toNumber(L.gross_sales), kind: "line" },
    { label: "خصومات الكاشير", amount: -toNumber(L.discounts), kind: "less", hideIfZero: true },
    { label: "دُفع بالنقاط", amount: -toNumber(L.points_redeemed), kind: "less", hideIfZero: true },
    {
      label: "مرتجعات أُعيد ثمنها",
      amount: -toNumber(L.returns),
      kind: "less",
      hideIfZero: true,
    },
    { label: "صافي الإيراد", amount: net, kind: "total", hint: "ما دخل الصندوق فعلاً" },
    { label: "تكلفة المشروبات المباعة", amount: -toNumber(L.cogs), kind: "less" },
    { label: "هدر المخزون", amount: -toNumber(L.waste), kind: "less", hideIfZero: true },
    { label: "إجمالي الربح", amount: toNumber(L.gross_profit), kind: "total" },
  ]
  if (isShift) {
    rows.push(
      { label: "أجور الوردية", amount: -toNumber(L.shift_wages), kind: "less", hint: `${formatMoney(data.shift?.wage_per_day)} × ${data.range.days} يوم` },
      { label: "ما ساهمت به الوردية", amount: toNumber(L.contribution), kind: "grand" },
    )
  } else {
    rows.push(
      { label: "المصاريف", amount: -toNumber(L.opex), kind: "less", hint: "إيجار، رواتب، فواتير — حصة هذه الأيام" },
      { label: "صافي الربح", amount: toNumber(L.net_profit), kind: "grand" },
    )
  }

  return (
    <div className="space-y-3">
      {data.shifts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">الوردية:</span>
          <Chip on={shiftId == null} onClick={() => setShiftId(null)}>
            كل اليوم
          </Chip>
          {data.shifts.map((s) => (
            <Chip key={s.id} on={shiftId === s.id} onClick={() => setShiftId(s.id)} title={`${s.start}–${s.end}`}>
              {s.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={isShift ? `أرباح الوردية: ${data.shift?.name}` : "قائمة الأرباح"}
          hint={`${data.range.days} ${data.range.days === 1 ? "يوم" : "أيام"}${data.range.elapsed_end < data.range.end ? " حتى اليوم" : ""} · النسبة من صافي الإيراد`}
        >
          <div className="divide-y divide-border/70">
            {rows
              .filter((r) => !(r.hideIfZero && r.amount === 0))
              .map((r) => (
                <div
                  key={r.label}
                  className={cn(
                    "flex items-center gap-3",
                    r.kind === "grand" ? "mt-1 rounded-xl bg-muted/50 px-3 py-3" : "px-1 py-2.5",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      r.kind === "less" && "text-muted-foreground",
                      (r.kind === "total" || r.kind === "grand") && "font-semibold",
                    )}
                  >
                    {r.kind === "less" ? "− " : ""}
                    {r.label}
                    {r.hint ? <span className="ms-2 text-[11px] font-normal text-muted-foreground">{r.hint}</span> : null}
                  </span>
                  <span className="w-14 text-end text-[11px] tabular-nums text-muted-foreground">
                    {r.kind !== "line" ? pct(r.amount, net) : ""}
                  </span>
                  <span
                    className={cn(
                      "w-28 text-end tabular-nums",
                      r.kind === "grand" ? "font-heading text-lg font-bold" : "text-sm font-semibold",
                      r.amount < 0 && r.kind !== "less" && "text-rose-700 dark:text-rose-400",
                      r.kind === "grand" && r.amount >= 0 && "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {formatMoney(Math.abs(r.amount) === 0 ? 0 : r.kind === "less" ? Math.abs(r.amount) : r.amount)}
                  </span>
                </div>
              ))}
          </div>
        </Panel>

        <div className="space-y-3 lg:col-span-2">
          {!isShift ? (
            <Panel title="المصاريف حسب النوع" hint="حصة هذه الفترة من كل مصروف">
              <BarList
                rows={(data.opex ?? []).map((o) => ({ key: o.category_id, label: o.name, value: toNumber(o.amount) }))}
                format={(v) => formatMoney(v)}
                empty="لا مصاريف مسجلة — أضفها من صفحة المصاريف"
              />
            </Panel>
          ) : null}
          <Panel title={<span className="flex items-center gap-1.5"><Info className="size-4 text-muted-foreground" />للعلم — لا يُخصم من الربح</span>}>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt>
                  نقاط عند الزبائن لم تُستخدم
                  <p className="text-[11px] text-muted-foreground">{formatNumber(data.memo.points_outstanding)} نقطة — قيمة مستحقة عليك</p>
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoney(data.memo.points_outstanding_value)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt>
                  مشتريات المخزون
                  <p className="text-[11px] text-muted-foreground">تُحسب تكلفتها عند بيع المشروب، لا عند الشراء</p>
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoney(data.memo.purchases)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
