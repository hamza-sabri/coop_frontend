"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Monitor, Moon, Palette, RefreshCw, Sun, Volume2 } from "lucide-react"
import { useTheme } from "next-themes"

import { PageShell } from "@/components/page-shell"
import { Choice, SettingsCard } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { BrandingSection } from "@/components/settings/branding-section"
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
 * Sync-mode control is not part of what this store bought. It stays in the
 * tree behind this switch so turning it back on is one line, not a
 * re-implementation. (Staff moved to its own page, الموظفون.)
 */
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
    <PageShell title="الإعدادات">
      <SegmentedTabs
        tabs={TABS.filter((t) => !t.ownerOnly || isOwner)}
        active={tab}
        onChange={setTab}
        className="mb-0 w-fit max-w-full"
      />

      {/* Each tab fades in on its own — switching never jumps. */}
      <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {/* «هذا الجهاز» — settings that belong to the MACHINE, not the account:
            the counter's tablet and the owner's phone answer them differently.
            Three cards, one row. */}
        {tab === "device" && (
          <div className="grid gap-4 md:grid-cols-3">
            <SettingsCard icon={Palette} title="المظهر" hint="فاتح للنهار، داكن للمساء، أو حسب إعداد الجهاز.">
              <ThemeChoice />
            </SettingsCard>
            {/* Till sound. It used to be a speaker button in the POS header, one
                tap from a cashier's elbow — a muted till stops telling you a
                scan landed. It is a preference, so it lives here. */}
            <SettingsCard icon={Volume2} title="صوت الكاشير" hint="نغمة قصيرة عند إضافة صنف للسلة أو مسح باركود.">
              <TillSound className="mt-auto self-start" />
            </SettingsCard>
            <ScannerSection />
          </div>
        )}

        {/* Owner-only, double-checked: filtered out of the tab list AND
            re-checked here. The server refuses either way. */}
        {tab === "points" && isOwner && <PointsSection />}
        {tab === "shifts" && isOwner && <ShiftsSection />}
        {tab === "brand" && isOwner && <BrandingSection />}

        {/* Printing. Also in the POS's printer dialog, but that is only reachable
            from the till — the owner sets the shop up from here. */}
        {tab === "print" && <PrintSection />}

        {tab === "sync" && (SYNC_CONTROLS_ENABLED ? (
          <SyncControls
            offlineOn={offlineOn}
            pending={pending}
            mode={mode}
            pick={pick}
            syncing={syncing}
            syncNow={syncNow}
          />
        ) : (
          <PlanLockedSection
            title="العمل دون إنترنت"
            description="يستمر البيع حين ينقطع الإنترنت، وتُرفع الفواتير وحدها حين يعود — ولا تضيع فاتورة واحدة."
            benefits={[
              "الكاشير يبيع ويطبع والإنترنت مقطوع",
              "الفواتير تُرفع تلقائياً عند عودة الاتصال",
              "تختار متى تتم المزامنة على الاتصال الضعيف",
              "ترى كم فاتورة تنتظر الرفع",
            ]}
          />
        ))}
      </div>
    </PageShell>
  )
}

function ThemeChoice() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <Choice
      className="mt-auto self-start"
      value={mounted ? (theme as "light" | "dark" | "system") : undefined}
      onChange={setTheme}
      options={[
        { value: "light", label: "فاتح", icon: Sun },
        { value: "dark", label: "داكن", icon: Moon },
        { value: "system", label: "تلقائي", icon: Monitor },
      ]}
    />
  )
}

function SyncControls({
  offlineOn,
  pending,
  mode,
  pick,
  syncing,
  syncNow,
}: {
  offlineOn: boolean
  pending: number
  mode: SyncMode
  pick: (m: SyncMode) => void
  syncing: boolean
  syncNow: () => Promise<void>
}) {
  return (
    <SettingsCard
      icon={RefreshCw}
      title="المزامنة"
      hint="تحكّم بمتى تُرفع فواتيرك وتُنزَّل التحديثات — مفيد على الاتصال الضعيف. فواتيرك تُحفظ على الجهاز دائماً."
      action={
        offlineOn ? (
          <span className="pill pill-neutral">{pending > 0 ? `${formatNumber(pending)} بانتظار المزامنة` : "لا شيء بانتظار"}</span>
        ) : undefined
      }
    >
      {!offlineOn ? (
        <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">العمل دون اتصال متاح في الباقة الأعلى.</p>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-3">
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
                    active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/50",
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
                    <span className="block text-xs leading-relaxed text-muted-foreground">{o.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <Button className="mt-4 self-start gap-2" onClick={() => void syncNow()} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            زامن الآن
          </Button>
        </>
      )}
    </SettingsCard>
  )
}
