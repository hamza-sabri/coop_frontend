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
import { useEffect, useState } from "react"
import { CalendarRange, Check, ChevronDown } from "lucide-react"

import { CafeTab } from "@/components/reports/cafe-tab"
import { HoursTab } from "@/components/finance/hours-tab"
import { PnlTab } from "@/components/finance/pnl-tab"
import { SegmentedTabs, type SegmentedTab } from "@/components/segmented-tabs"
import { hasModule, useModules, useOwnerState } from "@/lib/modules"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
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

const TABS: SegmentedTab[] = [
  { id: "pnl", label: "الأرباح" },
  { id: "sales", label: "المبيعات" },
  { id: "hours", label: "الساعات" },
]

export default function ReportsPage() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30)
  const ownerState = useOwnerState()
  const isOwner = ownerState === "owner"
  const { modules } = useModules()
  const pnlOn = hasModule(modules, "pnl")
  const tabs = TABS.filter((t) => t.id !== "pnl" || pnlOn)
  const [tab, setTab] = useState<string>("pnl")

  // ?tab= deep link (read after mount — no Suspense boundary needed).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab")
    if (q && TABS.some((t) => t.id === q)) setTab(q)
  }, [])
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id

  function pick(id: string) {
    setTab(id)
    const u = new URL(window.location.href)
    u.searchParams.set("tab", id)
    window.history.replaceState(null, "", u)
  }

  if (ownerState === "loading") {
    return <div className="mx-auto w-full max-w-6xl pt-6"><Skeleton className="h-64 rounded-[26px]" /></div>
  }
  if (!isOwner) {
    return (
      <div className="mx-auto w-full max-w-xl pt-10">
        <PageHeader title="التقارير" />
        <p className="clay-card p-8 text-center text-sm text-muted-foreground">
          التقارير والأرقام المالية للمالك فقط.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* The period picker had a row to itself under the heading. It is an
          action, so it goes where the actions go — and only the sales tab
          uses it; the others carry their own day/week/month bar. */}
      <PageHeader
        title="التقارير"
        action={
          active === "sales" ? <PeriodDropdown days={days} onChange={setDays} /> : undefined
        }
      />
      <SegmentedTabs tabs={tabs} active={active} onChange={pick} />
      {active === "pnl" ? <PnlTab /> : active === "hours" ? <HoursTab /> : <CafeTab days={days} />}
    </div>
  )
}
