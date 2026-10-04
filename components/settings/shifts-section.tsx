"use client"

/* الورديات — the stretches of the day the shop runs in. They say WHEN, not
 * who: reports split takings by them, and the shift view weighs a shift's
 * takings against what its staff cost per day. A shift whose end is before
 * its start runs past midnight (19:00 → 02:00). */
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteShift, fetchShifts, saveShift, type Shift } from "@/api/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Draft = { id: number | null; name: string; start: string; end: string; wage_per_day: string }

const toDraft = (s: Shift): Draft => ({
  id: s.id,
  name: s.name,
  start: s.start.slice(0, 5),
  end: s.end.slice(0, 5),
  wage_per_day: s.wage_per_day != null ? String(Number(s.wage_per_day)) : "",
})

export function ShiftsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["shifts"], queryFn: () => fetchShifts().then((r) => r.data) })
  const [adding, setAdding] = useState<Draft | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shifts"] })
    qc.invalidateQueries({ queryKey: ["reports"] })
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Clock className="size-5 text-primary" />
        <h2 className="font-heading text-base font-bold">الورديات</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        تقسيم يوم العمل. التقارير تعرض المبيعات لكل وردية، وأجر الوردية اليومي يُطرح منها لتعرف ما تساهم به.
        الرواتب الكاملة تُسجّل في المصاريف.
      </p>
      {isLoading ? (
        <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((s) => (
            <ShiftRow key={s.id} initial={toDraft(s)} onDone={refresh} />
          ))}
          {adding ? (
            <ShiftRow initial={adding} onDone={() => { setAdding(null); refresh() }} onCancel={() => setAdding(null)} />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setAdding({ id: null, name: "", start: "13:00", end: "19:00", wage_per_day: "" })}
            >
              <Plus className="size-3.5" />
              وردية
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

function ShiftRow({ initial, onDone, onCancel }: { initial: Draft; onDone: () => void; onCancel?: () => void }) {
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
    <div className="grid grid-cols-2 items-end gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
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
        <Button size="sm" disabled={busy || (!changed && d.id != null)} onClick={save} aria-label="حفظ">
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
