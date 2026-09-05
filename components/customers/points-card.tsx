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
import { formatMoney, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

/** Quick amounts, because a barista is not going to type "10" fifty times. */
const QUICK = [5, 10, 25, 50]

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-bold tabular-nums">{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function PointsCard({ customerId }: { customerId: number }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

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
      qc.invalidateQueries({ queryKey: ["customers", "points", customerId] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "تعذّر تعديل النقاط"),
  })

  const n = Math.abs(Math.floor(Number(amount) || 0))
  const canSubmit = n > 0 && !adjust.isPending

  if (isError) return null

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-lime" />
        <h3 className="font-heading text-lg font-bold">النقاط</h3>
      </div>

      {isLoading || !points ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure
            label="الرصيد"
            value={formatNumber(points.balance)}
            hint={`تساوي ${formatMoney(points.value_ils)}`}
          />
          <Figure label="مجموع المكتسب" value={formatNumber(points.earned)} />
          <Figure
            label="المستخدَم"
            value={formatNumber(points.spent)}
            hint={`${formatNumber(points.redemptions)} مرة`}
          />
          <Figure
            label="قيمة المستخدَم"
            value={formatMoney(points.spent / (points.points_per_ils || 10))}
          />
        </div>
      )}

      {/* the manual adjustment */}
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="عدد النقاط"
            className="h-10 w-32"
          />
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted"
            >
              {q}
            </button>
          ))}
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="السبب (اختياري) — مثلاً: تعويض عن كوب"
          className="h-10"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => adjust.mutate({ delta: n })}
            className="flex-1"
          >
            {adjust.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            إضافة
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canSubmit}
            onClick={() => adjust.mutate({ delta: -n })}
            className="flex-1"
          >
            <Minus className="size-4" />
            خصم
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          الخصم لا ينزل بالرصيد تحت الصفر — يتوقف عند ما هو موجود.
        </p>
      </div>

      {/* the ledger */}
      {points && points.activity.length > 0 && (
        <div className="flex flex-col">
          <span className="mb-2 text-xs text-muted-foreground">سجل النقاط</span>
          <div className="max-h-64 overflow-y-auto rounded-2xl border">
            {points.activity.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {m.note || REASON_LABEL[m.reason] || m.reason}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(m.at).toLocaleString("ar", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {REASON_LABEL[m.reason] ?? m.reason}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <span
                    className={
                      m.delta >= 0
                        ? "font-heading text-sm font-bold text-lime"
                        : "font-heading text-sm font-bold text-muted-foreground"
                    }
                  >
                    {m.delta >= 0 ? "+" : "−"}
                    {formatNumber(Math.abs(m.delta))}
                  </span>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatNumber(m.balance_after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
