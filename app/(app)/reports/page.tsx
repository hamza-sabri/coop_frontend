"use client"

/**
 * التقارير — one question per tab, one period bar for all of them.
 *
 *   نظرة عامة  the four numbers that matter, one chart, the top drinks
 *   الأرباح    the statement: sales → what came off → costs → profit
 *   الأصناف    every drink: cups, revenue, profit, margin; tap for its page
 *   الأوقات    by hour × category, and the average weekday
 *   الورديات   the shifts side by side
 *   الزبائن    regulars, newcomers, points
 *   المرتجعات  what came back, and why
 *
 * The page used to be one long scroll (التقارير as a single "café report")
 * and the owner had to know where on it each answer lived. A tab per question
 * means each answer is the whole screen, and the period bar above them means
 * switching tab never loses the month you were looking at.
 *
 * Owner only — the server refuses every endpoint to employees as well.
 */
import { useEffect, useState } from "react"

import { Chip, customQuery, PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import type { PayFilter, PnlQuery } from "@/api/finance"
import { PageShell } from "@/components/page-shell"
import { ItemReportSheet } from "@/components/reports/item-report"
import { SURFACE } from "@/components/reports/kit"
import { CustomersTab } from "@/components/reports/tabs/customers"
import { ItemsTab } from "@/components/reports/tabs/items"
import { OverviewTab } from "@/components/reports/tabs/overview"
import { ProfitTab } from "@/components/reports/tabs/profit"
import { ReturnsTab } from "@/components/reports/tabs/returns"
import { ShiftsTab } from "@/components/reports/tabs/shifts"
import { TimesTab } from "@/components/reports/tabs/times"
import { SegmentedTabs, type SegmentedTab } from "@/components/segmented-tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { hasModule, useModules, useOwnerState } from "@/lib/modules"
import { businessToday } from "@/lib/period"
import { track } from "@/lib/analytics"

/** «الكل» · نقدي · بطاقة — and the delivery apps, shown but off until they
 *  are connected. */
const PAYS: { value: PayFilter | null; label: string; soon?: boolean }[] = [
  { value: null, label: "الكل" },
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
]
const SOON = ["هات", "ويلز"]

const TABS: (SegmentedTab & { pnl?: boolean })[] = [
  { id: "overview", label: "نظرة عامة" },
  { id: "profit", label: "الأرباح", pnl: true },
  { id: "items", label: "الأصناف" },
  { id: "times", label: "الأوقات" },
  { id: "shifts", label: "الورديات", pnl: true },
  { id: "customers", label: "الزبائن" },
  { id: "returns", label: "المرتجعات" },
]

export default function ReportsPage() {
  const ownerState = useOwnerState()
  const { modules } = useModules()
  const pnlOn = hasModule(modules, "pnl")
  const tabs = TABS.filter((t) => !t.pnl || pnlOn)
  const today = businessToday()
  const [tab, setTab] = useState("overview")
  const [period, setPeriod] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })
  const [pay, setPay] = useState<PayFilter | null>(null)
  const [item, setItem] = useState<{ id: number; name: string } | null>(null)

  // ?tab= deep link (read after mount — no Suspense boundary needed).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t && TABS.some((x) => x.id === t)) setTab(t)
  }, [])
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id

  // Which reports are actually read (product analytics, no figures sent).
  useEffect(() => {
    if (ownerState === "owner") track("Report Opened", { report: active })
  }, [active, ownerState])

  function pick(id: string) {
    setTab(id)
    const u = new URL(window.location.href)
    u.searchParams.set("tab", id)
    window.history.replaceState(null, "", u)
  }

  if (ownerState === "loading") {
    return (
      <div className="mx-auto w-full max-w-7xl pt-4">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (ownerState !== "owner") {
    return (
      <PageShell title="التقارير">
        <p className={`${SURFACE} mx-auto max-w-xl p-8 text-center text-sm text-muted-foreground`}>التقارير والأرقام المالية للمالك فقط.</p>
      </PageShell>
    )
  }

  const q: PnlQuery = period.custom
    ? { period: "custom", ...customQuery(period.custom), pay }
    : { period: period.period, date: period.anchor, pay }
  const openItem = (id: number, name = "") => setItem({ id, name })

  return (
    <PageShell title="التقارير">
      {/* One row: which question (tabs) · which period. */}
      {/* With «فترة» open the bar is too wide to share the row with the tabs. */}
      <div className={period.custom ? "flex flex-col gap-3" : "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"}>
        <SegmentedTabs tabs={tabs} active={active} onChange={pick} className="mb-0 min-w-0 xl:w-fit" />
        <div data-tour="reports-period" className="shrink-0">
          <PeriodBar value={period} onChange={setPeriod} today={today} allowCustom />
        </div>
      </div>

      {/* Which sales: all, cash only, card only. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="pay-filter">
        <span className="me-1 text-xs text-muted-foreground">طريقة الدفع</span>
        {PAYS.map((p) => (
          <Chip key={p.label} on={pay === p.value} onClick={() => setPay(p.value)}>
            {p.label}
          </Chip>
        ))}
        {SOON.map((name) => (
          <span
            key={name}
            aria-disabled="true"
            title="قريباً — بعد الربط مع التطبيق"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground/60"
          >
            {name}
            <span className="text-[10px] font-normal">قريباً</span>
          </span>
        ))}
      </div>

      {active === "overview" && <OverviewTab q={q} onOpenItem={(id) => openItem(id)} goTo={pick} />}
      {active === "profit" && <ProfitTab q={q} />}
      {active === "items" && <ItemsTab q={q} onOpenItem={openItem} />}
      {active === "times" && <TimesTab q={q} />}
      {active === "shifts" && <ShiftsTab q={q} />}
      {active === "customers" && <CustomersTab q={q} />}
      {active === "returns" && <ReturnsTab q={q} />}

      <ItemReportSheet productId={item?.id ?? null} name={item?.name} q={q} onClose={() => setItem(null)} />
    </PageShell>
  )
}
