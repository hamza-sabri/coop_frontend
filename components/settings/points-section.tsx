"use client"

/* النقاط — how much of each receipt comes back as points.
 *
 * A ladder: bigger receipts earn a bigger share, and the step a receipt lands
 * on sets the rate for ALL of it. Each band starts where the one above it
 * ends, so the owner only types where a band stops and what it pays; the last
 * band has no top. Ten points are always one shekel — that is shown, not
 * editable, because changing it would silently re-price every balance. */
import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Coins, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { fetchEarnRules, saveEarnRules } from "@/api/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatNumber } from "@/lib/format"
import { chain, pointsFor, problem, type Band } from "@/lib/points-bands"
import { POINTS_PER_ILS } from "@/lib/points"

const STARTER: Band[] = [
  { min_total: "0", max_total: "20", rate_percent: "1" },
  { min_total: "20", max_total: "50", rate_percent: "2" },
  { min_total: "50", max_total: "100", rate_percent: "5" },
  { min_total: "100", max_total: null, rate_percent: "5" },
]

export function PointsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["points-rules"],
    queryFn: () => fetchEarnRules().then((r) => r.data),
  })
  const [bands, setBands] = useState<Band[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sample, setSample] = useState("35")

  useEffect(() => {
    if (data && !dirty) {
      setBands(
        data.rules.map((r) => ({
          min_total: String(Number(r.min_total)),
          max_total: r.max_total == null ? null : String(Number(r.max_total)),
          rate_percent: String(Number(r.rate_percent)),
        })),
      )
    }
  }, [data, dirty])

  const chained = chain(bands)
  const err = problem(chained)
  const defaultPct = Number(data?.default_rate_percent ?? 2)
  const amount = Number(sample) || 0
  const pts = pointsFor(chained, amount, defaultPct)

  function edit(i: number, patch: Partial<Band>) {
    setDirty(true)
    setBands((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }

  async function save() {
    if (err) return toast.error(err)
    setSaving(true)
    try {
      await saveEarnRules(chained)
      toast.success("حُفظت شرائح النقاط — تُطبَّق على الفواتير الجديدة")
      setDirty(false)
      qc.invalidateQueries({ queryKey: ["points-rules"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Coins className="size-5 text-primary" />
        <h2 className="font-heading text-base font-bold">نقاط الزبائن</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        كل فاتورة تُرجع للزبون نسبة من المبلغ المدفوع نقداً كنقاط. الشريحة التي تقع فيها الفاتورة تحدد النسبة
        على الفاتورة كلها. <b className="text-foreground">{formatNumber(POINTS_PER_ILS)} نقاط = 1 ₪</b> دائماً.
      </p>

      {isLoading ? (
        <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          {chained.length === 0 ? (
            <div className="mb-3 rounded-xl bg-muted/50 p-3 text-sm">
              بدون شرائح: كل الفواتير تكسب <b>{defaultPct}%</b>.
              <Button
                size="sm"
                variant="outline"
                className="ms-2"
                onClick={() => {
                  setDirty(true)
                  setBands(STARTER)
                }}
              >
                ابدأ بشرائح مقترحة
              </Button>
            </div>
          ) : (
            <ol className="mb-3 space-y-2">
              {chained.map((b, i) => {
                const last = i === chained.length - 1
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">شريحة {i + 1}</span>
                    <span>من</span>
                    <span className="w-16 rounded-lg bg-card px-2 py-1.5 text-center font-semibold tabular-nums">
                      {formatNumber(Number(b.min_total))} ₪
                    </span>
                    <span>إلى</span>
                    {last ? (
                      <span className="w-20 rounded-lg bg-card px-2 py-1.5 text-center text-xs text-muted-foreground">
                        بلا حد
                      </span>
                    ) : (
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        className="h-8 w-20 text-center"
                        value={bands[i].max_total ?? ""}
                        onChange={(e) => edit(i, { max_total: e.target.value })}
                      />
                    )}
                    <span className="ms-auto">تكسب</span>
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      className="h-8 w-16 text-center font-semibold"
                      value={b.rate_percent}
                      onChange={(e) => edit(i, { rate_percent: e.target.value })}
                    />
                    <span>%</span>
                    <button
                      type="button"
                      aria-label="حذف الشريحة"
                      onClick={() => {
                        setDirty(true)
                        setBands((x) => x.filter((_, j) => j !== i))
                      }}
                      className="grid size-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setDirty(true)
                setBands((b) => {
                  const lastMax = b.length ? Number(chain(b)[b.length - 1].min_total) + 50 : 20
                  const copy = b.map((x, j) => (j === b.length - 1 ? { ...x, max_total: String(lastMax) } : x))
                  return [...copy, { min_total: String(lastMax), max_total: null, rate_percent: b.length ? b[b.length - 1].rate_percent : "2" }]
                })
              }}
            >
              <Plus className="size-3.5" />
              شريحة
            </Button>
            {err ? <p className="text-xs text-rose-600">{err}</p> : null}
          </div>

          <div className="mt-4 rounded-xl border border-dashed p-3">
            <p className="mb-2 text-xs font-semibold">جرّب:</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              فاتورة بـ
              <Input inputMode="decimal" dir="ltr" className="h-8 w-20 text-center" value={sample} onChange={(e) => setSample(e.target.value)} />
              ₪ تكسب
              <b className="font-heading text-lg text-primary tabular-nums">{formatNumber(pts)}</b>
              نقطة
              <span className="text-xs text-muted-foreground">(= {formatMoney(pts / POINTS_PER_ILS)})</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[10, 25, 45, 60, 120].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setSample(String(a))}
                  className="clay-chip rounded-full px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {a} ₪ → {formatNumber(pointsFor(chained, a, defaultPct))}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button className="bg-brand-gradient gap-1.5" disabled={!dirty || saving || Boolean(err)} onClick={save}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ الشرائح
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
