"use client"

/* One cash drawer record: the counts, the breakdown, who, and every
   operation while it was open. The owner can correct who opened or closed
   (staff share a till) and print the record. */
import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CreditCard, Loader2, Pencil, Printer, Save } from "lucide-react"
import { toast } from "sonner"

import { cashDrawerDetail, cashDrawerEdit, DENOMINATIONS, type CashSession, type Counts } from "@/api/cash-drawer"
import { Breakdown, CardCheck, differenceWords, WhoPicker } from "@/components/pos/cash-drawer"
import { Enter, PageShell } from "@/components/page-shell"
import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { printCashRecord } from "@/lib/print/cash-record"
import { cn } from "@/lib/utils"

const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "—"
const when = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${time(iso)}` : "—")
const KIND: Record<string, string> = { sale: "بيع", return: "إرجاع", refund: "استرجاع", in: "إدخال نقد", out: "إخراج نقد" }
const PAY: Record<string, string> = { cash: "نقدي", card: "بطاقة", debt: "دين" }

function CountsCard({ title, total, counts }: { title: string; total: string; counts?: Counts }) {
  const rows = DENOMINATIONS.filter((d) => Number(counts?.[d]) > 0)
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">{title}</p><p className="font-heading text-xl font-bold tabular-nums">{formatMoney(total)}</p></div>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-border/60 text-sm">
          {rows.map((d) => (
            <li key={d} className="flex items-center justify-between py-1.5"><span className="tabular-nums">{d} ₪ × {formatNumber(Number(counts![d]))}</span><span className="tabular-nums text-muted-foreground">{formatMoney(Number(d) * Number(counts![d]))}</span></li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">أُدخل المبلغ دون تفصيل الفئات.</p>
      )}
    </div>
  )
}

export default function CashRecordPage() {
  const { id } = useParams<{ id: string }>()
  const sid = Number(id)
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cash-drawer", "detail", sid],
    queryFn: () => cashDrawerDetail(sid).then((r) => r.data),
    enabled: Number.isFinite(sid),
  })
  const s = data ?? null
  const [editing, setEditing] = useState(false)
  const [openedBy, setOpenedBy] = useState<number | null>(null)
  const [closedBy, setClosedBy] = useState<number | null>(null)
  const [note, setNote] = useState("")
  useEffect(() => {
    if (!s) return
    setOpenedBy(s.opened_by_id ?? null)
    setClosedBy(s.closed_by_id ?? null)
    setNote(s.note ?? "")
  }, [s])
  const save = useMutation({
    mutationFn: () => cashDrawerEdit(sid, { opened_by: openedBy, closed_by: closedBy, note: note.trim() }),
    onSuccess: () => {
      toast.success("حُفظ السجل")
      setEditing(false)
      qc.invalidateQueries({ queryKey: ["cash-drawer"] })
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "تعذّر الحفظ"),
  })

  const d = s?.difference != null ? differenceWords(toNumber(s.difference)) : null

  return (
    <PageShell
      title={s ? `سجل الصندوق ${s.id}` : "سجل الصندوق"}
      action={
        <div className="flex gap-2">
          {isOwner && s ? (
            <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
              <Pencil className="size-4" /> {editing ? "إلغاء" : "تعديل"}
            </Button>
          ) : null}
          <Button size="sm" className="bg-brand-gradient" onClick={() => void printCashRecord(sid)} disabled={!s}>
            <Printer className="size-4" /> اطبع
          </Button>
        </div>
      }
    >
      <Enter i={0}>
        <Link href="/cash-drawer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> كل السجلات
        </Link>
      </Enter>
      {isError && !s ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading && !s ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : s ? (
        <>
          <Enter i={1}>
            <div className={cn("grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-center", d?.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : d ? "border-rose-500/30 bg-rose-500/5" : "bg-card")}>
              <div>
                <p className="text-[11px] text-muted-foreground">فُتح</p>
                <p className="font-semibold">{when(s.opened_at)}</p>
                <p className="text-sm">{s.opened_by || "—"} · بدأ بـ <b className="tabular-nums">{formatMoney(s.opening_amount)}</b></p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">أُغلق</p>
                <p className="font-semibold">{when(s.closed_at)}</p>
                <p className="text-sm">{s.closed_by || "—"} · عُدّ <b className="tabular-nums">{formatMoney(s.counted_amount ?? "0")}</b></p>
              </div>
              {d ? <span className={cn("pill justify-self-start text-sm md:justify-self-end", d.tone === "ok" ? "pill-success" : "pill-danger")}>{d.text}</span> : null}
            </div>
          </Enter>

          {editing && isOwner ? (
            <Enter i={2}>
              <div className="grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 md:grid-cols-3">
                <WhoPicker id="rec-open" label="من فتح الصندوق" value={openedBy} onChange={setOpenedBy} />
                {s.closed_at ? <WhoPicker id="rec-close" label="من أغلق الصندوق" value={closedBy} onChange={setClosedBy} /> : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-note">ملاحظة</Label>
                  <Input id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-11" />
                </div>
                <div className="md:col-span-3">
                  <Button className="bg-brand-gradient" disabled={save.isPending} onClick={() => save.mutate()}>
                    {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
                  </Button>
                </div>
              </div>
            </Enter>
          ) : s.note ? (
            <Enter i={2}><p className="text-sm text-muted-foreground">ملاحظة: {s.note}</p></Enter>
          ) : null}

          <Enter i={3}>
            <div className="grid gap-3 md:grid-cols-2">
              <CountsCard title="الفكّة عند الفتح" total={s.opening_amount} counts={s.opening_counts} />
              <CountsCard title="المعدود عند الإغلاق" total={s.counted_amount ?? "0"} counts={s.closing_counts} />
            </div>
          </Enter>

          <Enter i={4}>
            <div className="grid gap-3 md:grid-cols-2">
              {s.figures ? <Breakdown s={{ ...s, figures: { ...s.figures, expected: s.expected_amount ?? s.figures.expected } }} /> : null}
              <div className="space-y-3">
                <CardCheck s={s} />
                {s.card_counted == null && s.figures ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"><span className="flex items-center gap-2"><CreditCard className="size-4 text-muted-foreground" /> مبيعات البطاقة في النظام</span><span className="tabular-nums">{formatMoney(s.figures.card_sales)}</span></div>
                ) : null}
              </div>
            </div>
          </Enter>

          <Enter i={5}>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-semibold">العمليات</p>
                <p className="text-xs text-muted-foreground">{formatNumber(s.operations?.length ?? 0)} عملية</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    <tr><th className="px-3 py-2 text-start">الوقت</th><th className="px-3 py-2 text-start">النوع</th><th className="px-3 py-2 text-start">الدفع</th><th className="px-3 py-2 text-start">الفاتورة</th><th className="px-3 py-2 text-start">الزبون / السبب</th><th className="px-3 py-2 text-start">الموظف</th><th className="px-3 py-2 text-end">المبلغ</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(s.operations ?? []).map((o, i) => {
                      const v = toNumber(o.amount)
                      return (
                        <tr key={i}>
                          <td className="px-3 py-1.5 tabular-nums">{time(o.at)}</td>
                          <td className="px-3 py-1.5">{KIND[o.kind] ?? o.kind}</td>
                          <td className="px-3 py-1.5">{PAY[o.payment] ?? o.payment}</td>
                          <td className="px-3 py-1.5 tabular-nums">{o.sale_id ? <Link href={`/orders?search=${o.ref}`} className="text-primary hover:underline">{o.ref}</Link> : "—"}</td>
                          <td className="px-3 py-1.5">{o.customer || o.note || ""}</td>
                          <td className="px-3 py-1.5">{o.who}</td>
                          <td className={cn("px-3 py-1.5 text-end tabular-nums", v < 0 ? "text-rose-700 dark:text-rose-300" : "")}>{formatMoney(o.amount)}</td>
                        </tr>
                      )
                    })}
                    {!s.operations?.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">لا عمليات في هذه الفترة.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </Enter>
        </>
      ) : null}
    </PageShell>
  )
}
