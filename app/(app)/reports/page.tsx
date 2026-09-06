"use client"

/**
 * التقارير — the coffee shop's report, and only that.
 *
 * This page used to carry four tabs: an inventory audit (zero-priced, below
 * cost, expiring, no barcode, dead stock), deep sales analytics, and a
 * price-check log. All three are real, and all three were written for a shop
 * that holds stock and answers to a pharmacist. A café holds a menu. Asking
 * كوب's owner to scroll past "باركود مكسور" to reach "الأكثر مبيعاً" was asking
 * him to look at somebody else's business.
 *
 * The tabs are gone from the navigation, not from the codebase: the endpoints,
 * `components/reports/sales-tab.tsx` and `scan-tab.tsx` are all untouched, so
 * a vertical that needs them gets them back by restoring the switcher.
 */
import { useState } from "react"
import { CalendarRange, Check, ChevronDown } from "lucide-react"

import { CafeTab } from "@/components/reports/cafe-tab"
import { PageHeader } from "@/components/page-header"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const DAY_OPTIONS = [7, 30, 90] as const

const DAY_LABEL = (d: number) =>
  d === 7 ? "آخر ٧ أيام" : d === 30 ? "آخر ٣٠ يوماً" : "آخر ٩٠ يوماً"

function PeriodDropdown({
  days,
  onChange,
}: {
  days: number
  onChange: (d: (typeof DAY_OPTIONS)[number]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="clay-chip inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium"
          >
            <CalendarRange className="size-3.5" />
            {DAY_LABEL(days)}
            <ChevronDown className="size-3.5 opacity-70" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-40 rounded-2xl p-1.5">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              onChange(d)
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition hover:bg-muted/60",
              days === d && "font-semibold text-primary",
            )}
          >
            {DAY_LABEL(d)}
            {days === d && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default function ReportsPage() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30)

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="التقارير"
        description="ماذا يُباع، متى تزدحم، وماذا يكلّفك برنامج النقاط"
      />
      <div className="mb-2 flex min-h-9 items-center justify-end gap-2">
        <PeriodDropdown days={days} onChange={setDays} />
      </div>
      <CafeTab days={days} />
    </div>
  )
}
