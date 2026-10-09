"use client"

/* ==========================================================================
   A customer's points, at the counter.

   Three questions the shop actually gets asked, and the old النقاط tile could
   answer none of them:

     "how many do I have?"        — the balance, and what it is worth in shekels
     "how many have I used?"      — earned and spent, all-time
     "can you fix it, that order gave me nothing?"
                                  — a signed adjustment, written to the ledger

   The adjustment is a DELTA, never a new total. Overwriting a balance loses
   the reason it changed; "+20 · remade his latte" survives, and the ledger
   underneath stays a true account of every point that ever moved.
   ========================================================================== */
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Minus, Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  adjustCustomerPoints,
  customerPoints,
  REASON_LABEL,
  type CustomerPoints,
} from "@/api/points"
import { CountUp } from "@/components/count-up"
import { formatMoney, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useIsOwner } from "@/lib/modules"

/** Quick amounts, because a barista is not going to type "10" fifty times. */
const QUICK = [5, 10, 25, 50]

export function PointsCard({ customerId }: { customerId: number }) {
  const qc = useQueryClient()
  // Points are worked out from purchases; only the owner corrects by hand.
  const isOwner = useIsOwner()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [adjusting, setAdjusting] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", "points", customerId],
    queryFn: () => customerPoints(customerId),
    enabled: Number.isFinite(customerId),
  })
  const points = data?.data as CustomerPoints | undefined

  const adjust = useMutation({
    mutationFn: ({ delta }: { delta: number }) =>
      adjustCustomerPoints(
        customerId,
        delta,
        note.trim(),
        // One key per attempt: a retry of THIS click must not credit twice,
        // but a second, deliberate +20 later today must land.
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${customerId}-${Date.now()}-${Math.random()}`,
      ),
    onSuccess: (res) => {
      const moved = res.data.moved
      toast.success(
        moved >= 0
          ? `أُضيفت ${formatNumber(moved)} نقطة`
          : `خُصمت ${formatNumber(Math.abs(moved))} نقطة`,
      )
      setAmount("")
      setNote("")
      setAdjusting(false)
      qc.invalidateQueries({ queryKey: ["customers", "points", customerId] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "تعذّر تعديل النقاط"),
  })

  const n = Math.abs(Math.floor(Number(amount) || 0))
  const canSubmit = n > 0 && !adjust.isPending

  if (isError) return null

  const moves = points?.activity ?? []
  const shown = showAll ? moves : moves.slice(0, 4)

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-heading text-[15px] font-bold">
          <Sparkles className="size-4 text-amber-500" />
          النقاط
        </h3>
        {isOwner ? (
        <button
          type="button"
          onClick={() => setAdjusting((v) => !v)}
          className={cn(
            "rounded-lg px-2 py-1 text-xs font-semibold transition",
            adjusting ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {adjusting ? "إغلاق" : "إضافة / خصم"}
        </button>
        ) : null}
      </header>

      {isLoading || !points ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-heading text-3xl font-bold tabular-nums leading-none">
              <CountUp value={points.balance} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">تساوي {formatMoney(points.value_ils)}</p>
          </div>
          <dl className="flex gap-4 text-end text-xs">
            <div>
              <dt className="text-muted-foreground">اكتسب</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(points.earned)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">استخدم</dt>
              <dd className="font-semibold tabular-nums">
                {formatNumber(points.spent)}
                <span className="ms-1 font-normal text-muted-foreground">({formatNumber(points.redemptions)}×)</span>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {adjusting && isOwner ? (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed p-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="عدد النقاط"
              className="h-9 w-28"
              autoFocus
            />
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition hover:bg-muted",
                  amount === String(q) && "border-primary bg-primary/5 text-primary",
                )}
              >
                {q}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="السبب — مثلاً: تعويض عن كوب"
            className="h-9"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!canSubmit} onClick={() => adjust.mutate({ delta: n })} className="flex-1">
              {adjust.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              إضافة
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={!canSubmit} onClick={() => adjust.mutate({ delta: -n })} className="flex-1">
              <Minus className="size-4" />
              خصم
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">الخصم يتوقف عند الصفر.</p>
        </div>
      ) : null}

      {moves.length > 0 ? (
        <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
          {shown.map((m, i) => (
            <li key={`${m.at}-${i}`} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px]">{m.note || REASON_LABEL[m.reason] || m.reason}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(m.at).toLocaleString("ar-u-nu-latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-heading text-sm font-bold tabular-nums",
                  m.delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                )}
                dir="ltr"
              >
                {m.delta >= 0 ? "+" : "−"}
                {formatNumber(Math.abs(m.delta))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {moves.length > 4 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 w-full rounded-lg py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {showAll ? "أقل" : `كل السجل (${formatNumber(moves.length)})`}
        </button>
      ) : null}
    </section>
  )
}
