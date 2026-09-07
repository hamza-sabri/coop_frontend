"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { salesDaySummary } from "@/api/sales"
import { Card } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { formatMoney, formatNumber } from "@/lib/format"

/**
 * "What did we take between these two dates?" — as one more card in the row.
 *
 * This was a panel of its own: a strip of period chips over a single wide card
 * reading «إجمالي المبيعات», sitting above six period cards that already said
 * اليوم, أمس, آخر ٧ أيام, هذا الشهر, الشهر الماضي and الإجمالي. Three of its
 * chips duplicated three of those cards, its جوال/دخان groups were kiosk
 * categories a café has none of, so it rendered one lonely card in a
 * three-column grid. Two rows of chrome for one number already on screen.
 *
 * What was NOT duplicated is the hand-picked range, so that is all that is
 * left, shaped like its neighbours.
 *
 * The window still belongs to the SERVER. Nothing here computes a date: the
 * trading day rolls over on the shop's cutover hour, not at midnight, and a
 * till with a wrong clock would otherwise report a different period than the
 * owner's books — silently, which is the only way this goes wrong.
 */
export function CustomRangeCard() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  // A range only counts once BOTH ends are set. A half-filled picker would
  // otherwise fall back to "today" while the field on screen said otherwise.
  const ranged = Boolean(from && to)

  const { data, isFetching } = useQuery({
    queryKey: ["sales-day-summary", `${from}:${to}`],
    queryFn: () => salesDaySummary({ from, to }).then((r) => r.data),
    enabled: ranged,
    staleTime: 30_000,
  })

  return (
    <Card className="sale-stat clay-card gap-0 border-0 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        فترة مخصصة
        {isFetching && <Loader2 className="size-3 animate-spin" />}
      </p>
      <p className="mt-0.5 font-heading text-lg font-bold tracking-tight">
        {ranged && data ? formatMoney(data.total.amount) : "—"}
      </p>
      {ranged && data ? (
        <p className="text-[10px] text-muted-foreground">
          {formatNumber(data.total.count)} عملية
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">اختر تاريخين</p>
      )}
      {/* One field for both ends. Two separate date boxes let a cashier set an
          end before a start, or set one and wonder why nothing changed. */}
      <div className="mt-1.5">
        <DateRangePicker
          value={{ from, to }}
          onChange={(r) => {
            setFrom(r.from)
            setTo(r.to)
          }}
          placeholder="اختر فترة"
        />
      </div>
    </Card>
  )
}
