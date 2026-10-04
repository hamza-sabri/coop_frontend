"use client"

/* الورديات — the stretches of the day the shop runs in. They say WHEN, not
 * who: reports split takings by them, and the shift view weighs a shift's
 * takings against what its staff cost per day. A shift whose end is before
 * its start runs past midnight (19:00 → 02:00). */
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Clock, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteShift, fetchShifts, saveShift, type Shift } from "@/api/finance"
import { hourShort } from "@/components/charts"
import { SettingsCard } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type Draft = { id: number | null; name: string; start: string; end: string; wage_per_day: string }

const toDraft = (s: Shift): Draft => ({
  id: s.id,
  name: s.name,
  start: s.start.slice(0, 5),
  end: s.end.slice(0, 5),
  wage_per_day: s.wage_per_day != null ? String(Number(s.wage_per_day)) : "",
})

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
/** The business day starts at 4am (see the backend's finance.bounds). */
const DAY_START = 4 * 60

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
/** Minutes since 4am, 0‥1440. */
const sinceOpen = (t: string) => (minutes(t) - DAY_START + 1440) % 1440
const length = (start: string, end: string) => (minutes(end) - minutes(start) + 1440) % 1440 || 1440

export function ShiftsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["shifts"], queryFn: () => fetchShifts().then((r) => r.data) })
  const [adding, setAdding] = useState<Draft | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shifts"] })
    qc.invalidateQueries({ queryKey: ["reports"] })
  }
  const shifts = data ?? []

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <SettingsCard
        className="lg:col-span-3"
        icon={Clock}
        title="الورديات"
        hint="تقسيم يوم العمل. التقارير تعرض البيع لكل وردية وتطرح منها أجرها اليومي. الرواتب الكاملة تُسجّل في المصاريف."
        action={
          adding ? null : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setAdding({ id: null, name: "", start: "13:00", end: "19:00", wage_per_day: "" })}
            >
              <Plus className="size-3.5" />
              وردية
            </Button>
          )
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {shifts.map((s, i) => (
              <ShiftRow key={s.id} initial={toDraft(s)} color={COLORS[i % COLORS.length]} onDone={refresh} />
            ))}
            {adding ? (
              <ShiftRow
                initial={adding}
                color={COLORS[shifts.length % COLORS.length]}
                onDone={() => {
                  setAdding(null)
                  refresh()
                }}
                onCancel={() => setAdding(null)}
              />
            ) : shifts.length === 0 ? (
              <p className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                لا ورديات بعد — اليوم كله وردية واحدة. أضف «صباحي» و«مسائي» لتقارن بينهما.
              </p>
            ) : null}
          </div>
        )}
      </SettingsCard>

      <SettingsCard className="lg:col-span-2" icon={CalendarClock} title="يوم العمل" hint="من الرابعة فجراً إلى الرابعة فجراً التالية.">
        <DayBar shifts={shifts} />
        <ul className="mt-4 divide-y divide-border/70 text-sm">
          {shifts.map((s, i) => {
            const mins = length(s.start.slice(0, 5), s.end.slice(0, 5))
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{formatNumber(Math.round((mins / 60) * 10) / 10)} ساعات</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.wage_per_day && Number(s.wage_per_day) ? `${formatMoney(s.wage_per_day)} يومياً` : "بلا أجر"}
                </span>
              </li>
            )
          })}
          {shifts.length ? (
            <li className="flex items-center justify-between gap-3 py-2.5 font-semibold">
              <span>أجور اليوم كله</span>
              <span className="tabular-nums">{formatMoney(shifts.reduce((a, s) => a + (Number(s.wage_per_day) || 0), 0))}</span>
            </li>
          ) : null}
        </ul>
      </SettingsCard>
    </div>
  )
}

/** A 24-hour strip with each shift painted on it. Time runs left → right. */
function DayBar({ shifts }: { shifts: Shift[] }) {
  const ticks = [4, 8, 12, 16, 20, 0, 4]
  return (
    <div dir="ltr">
      <div className="relative h-9 overflow-hidden rounded-xl bg-muted/60">
        {shifts.flatMap((s, i) => {
          const a = sinceOpen(s.start.slice(0, 5))
          const len = length(s.start.slice(0, 5), s.end.slice(0, 5))
          // A shift that runs past 4am wraps to the start of the strip.
          const parts = a + len > 1440 ? [[a, 1440 - a], [0, a + len - 1440]] : [[a, len]]
          return parts.map(([x, w], k) => (
            <div
              key={`${s.id}-${k}`}
              title={`${s.name} ${s.start.slice(0, 5)}–${s.end.slice(0, 5)}`}
              className="animate-bar absolute inset-y-1 rounded-lg"
              style={{
                left: `${(x / 1440) * 100}%`,
                width: `calc(${(w / 1440) * 100}% - 2px)`,
                background: COLORS[i % COLORS.length],
                opacity: 0.85,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        {ticks.map((h, i) => (
          <span key={i}>{hourShort(h)}</span>
        ))}
      </div>
    </div>
  )
}

function ShiftRow({ initial, color, onDone, onCancel }: { initial: Draft; color: string; onDone: () => void; onCancel?: () => void }) {
  const [d, setD] = useState(initial)
  const [busy, setBusy] = useState(false)
  const changed = JSON.stringify(d) !== JSON.stringify(initial)
  const crosses = d.end <= d.start

  async function save() {
    if (!d.name.trim()) return toast.error("أدخل اسم الوردية")
    setBusy(true)
    try {
      await saveShift(d.id, {
        name: d.name.trim(),
        start: d.start,
        end: d.end,
        wage_per_day: (Number(d.wage_per_day) || 0).toFixed(2),
      })
      toast.success("حُفظت الوردية")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="grid grid-cols-2 items-end gap-2 rounded-xl border-s-4 bg-muted/40 p-3 animate-in fade-in slide-in-from-bottom-1 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
      style={{ borderInlineStartColor: color }}
    >
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <Label className="text-[11px]">الاسم</Label>
        <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="صباحي" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px]">من</Label>
        <Input type="time" dir="ltr" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px]">إلى {crosses ? <span className="text-muted-foreground">(بعد منتصف الليل)</span> : null}</Label>
        <Input type="time" dir="ltr" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px]">أجر الوردية يومياً (₪)</Label>
        <Input inputMode="decimal" dir="ltr" className="text-end" value={d.wage_per_day} onChange={(e) => setD({ ...d, wage_per_day: e.target.value })} placeholder="0" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" className={cn(!changed && d.id != null && "invisible")} disabled={busy} onClick={save} aria-label="حفظ">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-rose-600"
          aria-label="حذف"
          onClick={async () => {
            if (d.id == null) return onCancel?.()
            try {
              await deleteShift(d.id)
              toast.success("حُذفت")
              onDone()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "تعذر الحذف")
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
