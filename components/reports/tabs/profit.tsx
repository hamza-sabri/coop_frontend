"use client"

/* الأرباح — said the way an owner says it, in one line:
 *
 *   دخل الصندوق  −  ما صرفته  =  ربحك
 *
 * then where the spending went, each line with "of every 100 ₪ that came in,
 * this much went here". No floating bars, no accounting order to decode.
 * A shift chip narrows it to one shift, where "ما صرفته" carries that shift's
 * wages instead of the month's bills. */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Coffee, Equal, Info, Minus, Receipt, Trash2, Wallet } from "lucide-react"

import { fetchPnl, type PnlQuery } from "@/api/finance"
import { Bars } from "@/components/charts"
import { CountUp } from "@/components/count-up"
import { Failed, Panel, TabSkeleton } from "@/components/reports/kit"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Cost = {
  key: string
  label: string
  explain: string
  amount: number
  Icon: typeof Coffee
  tint: string
  detail?: { label: string; amount: number }[]
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
  const isShift = Boolean(data.shift)
  const income = toNumber(L.net_revenue)
  const offTill = toNumber(L.discounts) + toNumber(L.points_redeemed) + toNumber(L.returns)
  const lost = toNumber(L.waste) + toNumber(L.remakes) + toNumber(L.count_shortfall)
  const left = isShift ? toNumber(L.contribution) : toNumber(L.net_profit)
  const per100 = (v: number) => (income > 0 ? (v / income) * 100 : 0)

  const costs: Cost[] = [
    {
      key: "drinks",
      label: "مكوّنات ما بعته",
      explain: "حليب، بن، أكواب… بحسب تكلفة كل مشروب",
      amount: toNumber(L.cogs),
      Icon: Coffee,
      tint: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    },
    ...(lost > 0
      ? [
          {
            key: "lost",
            label: "هدر وتلف",
            explain: "ما رُمي أو أُعيد تحضيره أو نقص في الجرد",
            amount: lost,
            Icon: Trash2,
            tint: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
            detail: [
              { label: "هدر", amount: toNumber(L.waste) },
              { label: "إعادة تحضير", amount: toNumber(L.remakes) },
              { label: "نقص في الجرد", amount: toNumber(L.count_shortfall) },
            ].filter((x) => x.amount),
          },
        ]
      : []),
    isShift
      ? {
          key: "wages",
          label: "أجور الوردية",
          explain: `${formatMoney(data.shift?.wage_per_day)} يومياً × ${formatNumber(data.range.days)} ${data.range.days === 1 ? "يوم" : "أيام"}`,
          amount: toNumber(L.shift_wages),
          Icon: Wallet,
          tint: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        }
      : {
          key: "opex",
          label: "المصاريف",
          explain: "إيجار، رواتب، كهرباء… حصة هذه الأيام من الشهر",
          amount: toNumber(L.opex),
          Icon: Receipt,
          tint: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        },
  ]
  const gain = lost < 0 ? -lost : 0 // the count found more than the books said
  // What came off, net of any stock a count found extra — so that
  // دخل الصندوق − ما صرفته is EXACTLY the profit, to the agora.
  const spent = costs.reduce((a, c) => a + c.amount, 0) - gain
  const opex = (data.opex ?? []).filter((o) => toNumber(o.amount) > 0)
  const days = `${formatNumber(data.range.days)} ${data.range.days === 1 ? "يوم" : "أيام"}${data.range.elapsed_end < data.range.end ? " حتى اليوم" : ""}`

  return (
    <div className="space-y-4">
      {/* ── the one line ─────────────────────────────────────────────── */}
      <Panel
        title={isShift ? `وردية ${data.shift?.name}` : "حساب الفترة"}
        hint={days}
        action={
          data.shifts.length > 0 ? (
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
        <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <Term
            i={0}
            label="دخل الصندوق"
            value={income}
            sub={offTill ? `بعد ${formatMoney(offTill)} خصومات ونقاط ومرتجعات` : "كل ما دفعه الزبائن"}
          />
          <Op i={1}>
            <Minus className="size-4" />
          </Op>
          <Term i={2} label="ما صرفته" value={spent} sub={costs.map((c) => c.label).join(" · ")} tone="spent" />
          <Op i={3}>
            <Equal className="size-4" />
          </Op>
          <Term
            i={4}
            label={isShift ? "ما بقي من الوردية" : left >= 0 ? "ربحك" : "خسارتك"}
            value={Math.abs(left)}
            sub={
              income > 0 && left > 0
                ? `من كل ١٠٠ ₪ دخلت، بقي لك ${formatNumber(Math.round(per100(left)))} ₪`
                : gain
                  ? `منها ${formatMoney(gain)} زيادة وُجدت في الجرد`
                  : "صرفت أكثر مما دخل"
            }
            tone={left >= 0 ? "good" : "bad"}
          />
        </div>
      </Panel>

      {/* ── where the spending went ──────────────────────────────────── */}
      <div className={cn("grid items-start gap-4", !isShift && opex.length && "lg:grid-cols-5")}>
        <Panel className="lg:col-span-3" title="أين ذهب ما صرفته" hint="ومن كل ١٠٠ ₪ دخلت الصندوق، كم ذهب لكل بند">
          <ul className="divide-y divide-border/70">
            {costs.map((c, i) => (
              <li
                key={c.key}
                className="flex items-start gap-3 py-3 first:pt-0 animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", c.tint)}>
                  <c.Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground">{c.explain}</p>
                  {c.detail && c.detail.length > 1 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.detail.map((d) => `${d.label} ${formatMoney(d.amount)}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-semibold tabular-nums">{formatMoney(c.amount)}</p>
                  {income > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {formatNumber(Math.round(per100(c.amount) * 10) / 10)} ₪ من كل ١٠٠
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {/* Things worth knowing that do not change the profit above. */}
          {!isShift && (data.memo.points_outstanding > 0 || toNumber(data.memo.purchases) > 0) ? (
            <div className="mt-3 flex gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                {toNumber(data.memo.purchases) > 0 ? (
                  <>
                    اشتريت مخزوناً بـ <b className="text-foreground">{formatMoney(data.memo.purchases)}</b> — يُحسب أعلاه فقط حين يُستخدم في مشروب.{" "}
                  </>
                ) : null}
                {data.memo.points_outstanding > 0 ? (
                  <>
                    وعند الزبائن نقاط قيمتها <b className="text-foreground">{formatMoney(data.memo.points_outstanding_value)}</b> لم يستخدموها بعد.
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </Panel>

        {!isShift && opex.length ? (
          <Panel className="lg:col-span-2" title="المصاريف حسب النوع" hint="حصة هذه الأيام من كل مصروف">
            <Bars
              height={230}
              showValues
              data={opex.map((o) => ({ label: o.name, value: toNumber(o.amount) }))}
              format={(v) => formatMoney(v)}
            />
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

function Term({
  i,
  label,
  value,
  sub,
  tone,
}: {
  i: number
  label: string
  value: number
  sub: string
  tone?: "spent" | "good" | "bad"
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-4 animate-in fade-in zoom-in-95 fill-mode-both duration-500",
        tone === "good"
          ? "border-emerald-500/25 bg-emerald-500/8"
          : tone === "bad"
            ? "border-rose-500/25 bg-rose-500/8"
            : "border-border/80 bg-muted/30",
      )}
      style={{ animationDelay: `${i * 90}ms` }}
    >
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-bold tabular-nums md:text-[28px]",
          tone === "good" && "text-emerald-700 dark:text-emerald-300",
          tone === "bad" && "text-rose-700 dark:text-rose-300",
        )}
      >
        <CountUp value={value} decimals={2} suffix=" ₪" />
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  )
}

function Op({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <div
      className="grid place-items-center animate-in fade-in fill-mode-both duration-500 max-md:py-0.5"
      style={{ animationDelay: `${i * 90}ms` }}
      aria-hidden
    >
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">{children}</span>
    </div>
  )
}
