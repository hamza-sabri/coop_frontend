"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, RefreshCw } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandingSection } from "@/components/settings/branding-section"
import { StaffSection } from "@/components/settings/staff-section"
import { PlanLockedSection } from "@/components/settings/plan-locked-section"
import { PrintSection } from "@/components/settings/print-section"
import { TillSound } from "@/components/settings/till-sound"
import { ScannerSection } from "@/components/settings/scanner-section"
import { PointsSection } from "@/components/settings/points-section"
import { ShiftsSection } from "@/components/settings/shifts-section"
import { SegmentedTabs, type SegmentedTab } from "@/components/segmented-tabs"
import { useModules, hasModule, useIsOwner } from "@/lib/modules"
import {
  SYNC_MODES,
  getSyncMode,
  setSyncMode,
  onSyncModeChange,
  beginManualSync,
  endManualSync,
  type SyncMode,
} from "@/lib/offline/sync-mode"
import { onQueueChange, pendingCount } from "@/lib/offline/queue"
import { flushPendingSales } from "@/lib/offline/sync"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Neither staff management nor sync-mode control is part of what this store
 * bought. Both stay in the tree behind these switches so turning one back on
 * is one line, not a re-implementation.
 */
const STAFF_ENABLED = false
const SYNC_CONTROLS_ENABLED = false

/** One tab per reason to open this page, in the order they are opened — the
 *  al-rahmah layout. The staff tab arrives with the employees page (week two);
 *  until then it is absent, not a locked teaser. */
const TABS: SegmentedTab[] = [
  { id: "device", label: "هذا الجهاز" },
  { id: "print", label: "الطباعة" },
  { id: "sync", label: "المزامنة" },
  { id: "points", label: "النقاط", ownerOnly: true },
  { id: "shifts", label: "الورديات", ownerOnly: true },
  { id: "brand", label: "الهوية", ownerOnly: true },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const { modules } = useModules()
  const isOwner = useIsOwner()
  // null = unknown/legacy backend → don't lock anyone out (mirrors OfflineGate).
  const offlineOn = modules === null || hasModule(modules, "offline")

  const [tab, setTab] = useState("device")
  // Deep link: /settings?tab=print. Read once after mount rather than through
  // useSearchParams, which would force a Suspense boundary on the whole page.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t && TABS.some((x) => x.id === t)) setTab(t)
  }, [])

  const [mode, setMode] = useState<SyncMode>("auto")
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setMode(getSyncMode())
    return onSyncModeChange(() => setMode(getSyncMode()))
  }, [])
  useEffect(() => {
    void pendingCount().then(setPending)
    return onQueueChange(() => void pendingCount().then(setPending))
  }, [])

  function pick(m: SyncMode) {
    setSyncMode(m)
    setMode(m)
  }

  async function syncNow() {
    setSyncing(true)
    beginManualSync() // override the valves so a manual sync is always full
    try {
      await flushPendingSales()
      setPending(await pendingCount())
      await qc.invalidateQueries()
    } finally {
      endManualSync()
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="الإعدادات" description="المظهر والمزامنة" />

      <SegmentedTabs
        tabs={TABS.filter((t) => !t.ownerOnly || isOwner)}
        active={tab}
        onChange={setTab}
      />

      {/* «هذا الجهاز» — settings that belong to the MACHINE, not the account:
          the counter's tablet and the owner's phone answer them differently. */}
      {tab === "device" && (
      <>
      {/* Appearance */}
      <section className="mb-5 rounded-2xl border bg-card p-5">
        <h2 className="mb-1 font-heading text-base font-bold">المظهر</h2>
        <p className="mb-3 text-xs text-muted-foreground">فاتح، داكن، أو حسب النظام</p>
        <ThemeToggle tone="surface" />
      </section>

      {/* Till sound. It used to be a speaker button in the POS header, one tap
          from a cashier's elbow — and a muted till is a till that stops telling
          you a scan landed. It is a preference, so it lives with the other
          preferences. */}
      <section className="mb-5 rounded-2xl border bg-card p-5">
        <h2 className="mb-1 font-heading text-base font-bold">صوت الكاشير</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          نغمة قصيرة عند إضافة صنف أو مسح باركود
        </p>
        <TillSound />
      </section>

      <ScannerSection />
      </>
      )}

      {/* Owner-only, double-checked: filtered out of the tab list AND
          re-checked here. The server refuses either way. */}
      {tab === "points" && isOwner && <PointsSection />}
      {tab === "shifts" && isOwner && <ShiftsSection />}
      {tab === "brand" && isOwner && <BrandingSection />}
      {tab === "brand" && isOwner && STAFF_ENABLED && <StaffSection />}

      {/* Printing. Also in the POS's printer dialog, but that is only reachable
          from the till — the owner sets the shop up from here. */}
      {tab === "print" && <PrintSection />}

      {/* Sync */}
      {tab === "sync" && (SYNC_CONTROLS_ENABLED ? (
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-bold">المزامنة</h2>
            {offlineOn && (
              <span className="pill pill-neutral">
                {pending > 0 ? `${formatNumber(pending)} بانتظار المزامنة` : "لا شيء بانتظار"}
              </span>
            )}
          </div>

          {!offlineOn ? (
            <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              العمل دون اتصال والتحكم بالمزامنة متاحان في الباقة الأعلى.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                تحكّم بمتى تُرفع فواتيرك وتُنزَّل التحديثات — مفيد على الاتصال الضعيف. السحابة تبقى
                المصدر الأساسي، وفواتيرك تُحفظ محلياً دائماً.
              </p>
              <div className="flex flex-col gap-2">
                {SYNC_MODES.map((o) => {
                  const active = mode === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick(o.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-start transition",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                          active ? "border-primary" : "border-muted-foreground/40",
                        )}
                      >
                        {active && <span className="size-2.5 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{o.label}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {o.hint}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={syncing}
                className="clay-btn mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
              >
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                زامن الآن
              </button>
            </>
          )}
        </section>
      ) : (
        <PlanLockedSection
          title="المزامنة"
          description="تحكّم بمتى تُرفع فواتيرك وتُنزَّل التحديثات — مفيد على الاتصال الضعيف"
        />
      ))}
    </div>
  )
}
