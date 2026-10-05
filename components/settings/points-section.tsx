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
import { Calculator, Coins, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { fetchEarnRules, saveEarnRules } from "@/api/finance"
import { SettingsCard } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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

  const addBand = () => {
    setDirty(true)
    setBands((b) => {
      const lastMax = b.length ? Number(chain(b)[b.length - 1].min_total) + 50 : 20
      const copy = b.map((x, j) => (j === b.length - 1 ? { ...x, max_total: String(lastMax) } : x))
      return [...copy, { min_total: String(lastMax), max_total: null, rate_percent: b.length ? b[b.length - 1].rate_percent : "2" }]
    })
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <SettingsCard
        className="lg:col-span-3"
        icon={Coins}
        title="كم يكسب الزبون من كل فاتورة"
        hint={
          <>
            الفاتورة الأكبر تكسب نسبة أكبر، والنسبة تُحسب على الفاتورة كلها.{" "}
            <b className="text-foreground">{formatNumber(POINTS_PER_ILS)} نقاط = 1 ₪</b> دائماً.
          </>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : chained.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <span>
              الآن كل الفواتير تكسب <b>{defaultPct}%</b>.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDirty(true)
                setBands(STARTER)
              }}
            >
              ابدأ بشرائح مقترحة
            </Button>
          </div>
        ) : (
          <ol className="space-y-2">
            {chained.map((b, i) => {
              const last = i === chained.length - 1
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-muted/40 p-2.5 ps-3.5 text-sm animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">من</span>
                    <span className="w-16 rounded-lg bg-card px-2 py-1.5 text-center font-semibold tabular-nums">
                      {formatNumber(Number(b.min_total))} ₪
                    </span>
                    <span className="text-muted-foreground">إلى</span>
                    {last ? (
                      <span className="w-20 rounded-lg bg-card px-2 py-1.5 text-center text-xs text-muted-foreground">أي مبلغ</span>
                    ) : (
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        className="h-8 w-20 bg-card text-center"
                        value={bands[i].max_total ?? ""}
                        onChange={(e) => edit(i, { max_total: e.target.value })}
                        aria-label={`نهاية الشريحة ${i + 1}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">← تكسب</span>
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      className="h-8 w-16 bg-card text-center font-semibold"
                      value={b.rate_percent}
                      onChange={(e) => edit(i, { rate_percent: e.target.value })}
                      aria-label={`نسبة الشريحة ${i + 1}`}
                    />
                    <span>%</span>
                  </div>
                  <button
                    type="button"
                    aria-label="حذف الشريحة"
                    onClick={() => {
                      setDirty(true)
                      setBands((x) => x.filter((_, j) => j !== i))
                    }}
                    className="ms-auto grid size-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {err ? <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{err}</p> : null}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-4">
          <Button size="sm" variant="outline" className="gap-1" onClick={addBand} disabled={isLoading}>
            <Plus className="size-3.5" />
            شريحة
          </Button>
          <Button className="bg-brand-gradient gap-1.5" disabled={!dirty || saving || Boolean(err)} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ الشرائح
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard className="lg:col-span-2" icon={Calculator} title="جرّب قبل أن تحفظ" hint="اكتب مبلغ فاتورة وشاهد ما يكسبه الزبون.">
        <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
          <div className="relative w-28 shrink-0">
            <Input
              inputMode="decimal"
              dir="ltr"
              className="h-11 bg-card pe-7 text-center text-base font-semibold"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              aria-label="مبلغ الفاتورة"
            />
            <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₪</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">يكسب</p>
            <p className="font-heading text-2xl font-bold leading-none tabular-nums text-primary">
              {formatNumber(pts)} <span className="text-sm font-semibold">نقطة</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">قيمتها {formatMoney(pts / POINTS_PER_ILS)}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-border/70 text-sm">
          {[10, 25, 45, 60, 120].map((a) => {
            const p = pointsFor(chained, a, defaultPct)
            return (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => setSample(String(a))}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-start transition hover:bg-muted/50"
                >
                  <span className="text-muted-foreground">فاتورة {formatMoney(a)}</span>
                  <span className="tabular-nums">
                    <b>{formatNumber(p)}</b> نقطة <span className="text-[11px] text-muted-foreground">({formatMoney(p / POINTS_PER_ILS)})</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </SettingsCard>
    </div>
  )
}
