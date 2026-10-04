"use client"

/**
 * المصاريف — what it costs to keep the doors open. Owner only.
 *
 * Two kinds, because the owner thinks of them as two kinds:
 *   ثابتة كل شهر — rent, salaries, internet. Typed ONCE, counted every month
 *     until an end month is set.
 *   هذا الشهر — the electricity bill, a repair, an ad. Each belongs to the
 *     month it COVERS, which is not always the month it was paid: October's
 *     electricity paid on 5 November is October's cost.
 *
 * The P&L reads both, prorated by day, so a day view carries a day's rent.
 */
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Save,
  Trash2,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"

import {
  createExpenseCategory,
  deleteExpense,
  deleteRecurring,
  fetchExpenseCategories,
  fetchExpenseMonth,
  saveExpense,
  saveRecurring,
  type Expense,
  type RecurringExpense,
} from "@/api/finance"
import { ConfirmDelete } from "@/components/confirm-delete"
import { FormModal } from "@/components/form-modal"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlatToggle } from "@/components/flat-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { useOwnerState } from "@/lib/modules"
import { businessToday, label as periodLabel, monthName, shift } from "@/lib/period"
import { cn } from "@/lib/utils"

type Editing =
  | { kind: "once"; row: Expense | null }
  | { kind: "monthly"; row: RecurringExpense | null }
  | null

export default function ExpensesPage() {
  const ownerState = useOwnerState()
  const isOwner = ownerState === "owner"
  const today = businessToday()
  const [anchor, setAnchor] = useState(today.slice(0, 8) + "01")
  const month = anchor.slice(0, 7)
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<{ kind: "once" | "monthly"; id: number } | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => fetchExpenseMonth(month).then((r) => r.data),
    enabled: isOwner,
    placeholderData: (p) => p,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] })
    qc.invalidateQueries({ queryKey: ["reports"] })
  }

  const maxCat = useMemo(
    () => Math.max(1, ...(data?.by_category ?? []).map((c) => toNumber(c.amount))),
    [data],
  )

  if (ownerState === "loading") {
    return <div className="mx-auto w-full max-w-6xl pt-6"><Skeleton className="h-64 rounded-[26px]" /></div>
  }
  if (!isOwner) {
    return (
      <div className="mx-auto w-full max-w-xl pt-10">
        <PageHeader title="المصاريف" />
        <p className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">المصاريف للمالك فقط.</p>
      </div>
    )
  }

  const total = toNumber(data?.total)
  const prevTotal = toNumber(data?.previous_total)
  const atNow = month >= today.slice(0, 7)

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="المصاريف"
        action={
          <Button
            size="sm"
            className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25"
            onClick={() => setEditing({ kind: "once", row: null })}
          >
            <Plus className="size-4" />
            مصروف
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="border border-border bg-card inline-flex items-center rounded-full p-1">
          <button
            type="button"
            aria-label="الشهر السابق"
            onClick={() => setAnchor(shift("month", anchor, -1))}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="min-w-28 px-2 text-center text-xs font-semibold">
            {periodLabel("month", anchor)}
          </span>
          <button
            type="button"
            aria-label="الشهر التالي"
            disabled={atNow}
            onClick={() => setAnchor(shift("month", anchor, 1))}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-[26px]" />
          <Skeleton className="h-48 rounded-[26px] lg:col-span-2" />
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── the month at a glance ───────────────────────────────── */}
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <p className="text-[11px] text-muted-foreground">مصاريف {monthName(anchor)}</p>
            <p className="font-heading text-3xl font-bold tabular-nums">{formatMoney(total)}</p>
            {prevTotal > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                الشهر السابق {formatMoney(prevTotal)}
                <span
                  className={cn(
                    "ms-1.5 font-semibold",
                    total > prevTotal ? "text-rose-600" : "text-emerald-600",
                  )}
                  dir="ltr"
                >
                  {total > prevTotal ? "+" : ""}
                  {(((total - prevTotal) / prevTotal) * 100).toFixed(0)}%
                </span>
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {data.by_category.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">لا مصاريف بعد لهذا الشهر.</p>
              ) : (
                data.by_category.map((c) => (
                  <div key={c.category_id} className="relative overflow-hidden rounded-xl">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 start-0 rounded-xl bg-primary/12"
                      style={{ width: `${Math.max(4, (toNumber(c.amount) / maxCat) * 100)}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{c.name}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(c.amount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            {/* ── recurring ───────────────────────────────────────────── */}
            <section className="rounded-2xl border border-border/80 bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                  <Repeat className="size-4 text-primary" />
                  ثابتة كل شهر
                </h3>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ kind: "monthly", row: null })}>
                  <Plus className="size-3.5" />
                  مصروف ثابت
                </Button>
              </div>
              {data.recurring.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  الإيجار والرواتب والإنترنت — أدخلها مرة واحدة وتُحسب كل شهر.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.recurring.map((r) => (
                    <Line
                      key={r.id}
                      chip={r.category_name}
                      title={r.name || r.category_name}
                      sub={`منذ ${periodLabel("month", r.start_month)}${r.end_month ? ` حتى ${periodLabel("month", r.end_month)}` : ""}`}
                      amount={r.amount}
                      onEdit={() => setEditing({ kind: "monthly", row: r })}
                      onDelete={() => setToDelete({ kind: "monthly", id: r.id })}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* ── one-offs ────────────────────────────────────────────── */}
            <section className="rounded-2xl border border-border/80 bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                  <Receipt className="size-4 text-primary" />
                  فواتير ومصاريف {monthName(anchor)}
                </h3>
              </div>
              {data.expenses.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-xs text-muted-foreground">الكهرباء، المياه، صيانة، إعلان… كل ما دُفع عن هذا الشهر.</p>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ kind: "once", row: null })}>
                    <Plus className="size-3.5" />
                    مصروف
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.expenses.map((e) => (
                    <Line
                      key={e.id}
                      chip={e.category_name}
                      title={e.note || e.category_name}
                      sub={e.paid_on ? `دُفع ${formatDate(e.paid_on)}` : "لم يُسجّل تاريخ الدفع"}
                      amount={e.amount}
                      onEdit={() => setEditing({ kind: "once", row: e })}
                      onDelete={() => setToDelete({ kind: "once", id: e.id })}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <ExpenseForm editing={editing} month={anchor} onClose={() => setEditing(null)} onSaved={refresh} />

      <ConfirmDelete
        open={toDelete != null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="حذف المصروف؟"
        description="يُحذف من قائمة الأرباح لكل الأشهر التي يغطيها."
        onConfirm={async () => {
          if (!toDelete) return
          try {
            if (toDelete.kind === "once") await deleteExpense(toDelete.id)
            else await deleteRecurring(toDelete.id)
            toast.success("حُذف")
            refresh()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذر الحذف")
          }
          setToDelete(null)
        }}
      />
    </div>
  )
}

function Line({
  chip,
  title,
  sub,
  amount,
  onEdit,
  onDelete,
}: {
  chip: string
  title: string
  sub: string
  amount: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
        {chip}
      </span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </button>
      <span className="font-heading text-sm font-bold tabular-nums">{formatMoney(amount)}</span>
      <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
        <button type="button" aria-label="تعديل" onClick={onEdit} className="grid size-8 place-items-center rounded-lg hover:bg-muted">
          <Pencil className="size-3.5" />
        </button>
        <button type="button" aria-label="حذف" onClick={onDelete} className="grid size-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/10">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  )
}

function ExpenseForm({
  editing,
  month,
  onClose,
  onSaved,
}: {
  editing: Editing
  month: string
  onClose: () => void
  onSaved: () => void
}) {
  const open = editing != null
  const [kind, setKind] = useState<"once" | "monthly">("once")
  const [category, setCategory] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [period, setPeriod] = useState(month.slice(0, 7))
  const [paidOn, setPaidOn] = useState("")
  const [note, setNote] = useState("")
  const [name, setName] = useState("")
  const [endMonth, setEndMonth] = useState("")
  const [newCat, setNewCat] = useState("")
  const [saving, setSaving] = useState(false)
  const [seenFor, setSeenFor] = useState<Editing>(null)

  const cats = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => fetchExpenseCategories().then((r) => r.data),
    enabled: open,
  })

  // Reset the form whenever a different row (or a new one) is opened.
  if (open && editing !== seenFor) {
    setSeenFor(editing)
    setKind(editing.kind)
    if (editing.kind === "once") {
      const r = editing.row
      setCategory(r?.category ?? null)
      setAmount(r?.amount ?? "")
      setPeriod((r?.period ?? month).slice(0, 7))
      setPaidOn(r?.paid_on ?? "")
      setNote(r?.note ?? "")
      setName("")
      setEndMonth("")
    } else {
      const r = editing.row
      setCategory(r?.category ?? null)
      setAmount(r?.amount ?? "")
      setPeriod((r?.start_month ?? month).slice(0, 7))
      setEndMonth(r?.end_month?.slice(0, 7) ?? "")
      setName(r?.name ?? "")
      setNote("")
      setPaidOn("")
    }
  }
  if (!open && seenFor !== null) setSeenFor(null)

  const isEdit = Boolean(editing?.row)

  async function addCategory() {
    const n = newCat.trim()
    if (!n) return
    try {
      const r = await createExpenseCategory(n)
      await cats.refetch()
      setCategory(r.data.id)
      setNewCat("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إضافة التصنيف")
    }
  }

  async function save() {
    if (!category) return toast.error("اختر التصنيف")
    if (!(toNumber(amount) > 0)) return toast.error("أدخل المبلغ")
    setSaving(true)
    try {
      if (kind === "once") {
        await saveExpense(editing?.kind === "once" && editing.row ? editing.row.id : null, {
          category,
          amount: toNumber(amount).toFixed(2),
          period: `${period}-01`,
          paid_on: paidOn || null,
          note: note.trim(),
        })
      } else {
        await saveRecurring(editing?.kind === "monthly" && editing.row ? editing.row.id : null, {
          category,
          amount: toNumber(amount).toFixed(2),
          name: name.trim(),
          start_month: `${period}-01`,
          end_month: endMonth ? `${endMonth}-01` : null,
        })
      }
      toast.success("حُفظ")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? "تعديل مصروف" : "مصروف جديد"}
      icon={<Wallet className="size-4.5" />}
      footer={
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={saving}
            data-form-primary
            onClick={save}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      {!isEdit ? (
        <FlatToggle
          className="w-full"
          options={[
            { value: "once", label: "مرة واحدة" },
            { value: "monthly", label: "ثابت كل شهر" },
          ]}
          value={kind}
          onChange={setKind}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>التصنيف</Label>
        <div className="flex flex-wrap gap-1.5">
          {(cats.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                category === c.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          <Input
            placeholder="تصنيف جديد…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                e.stopPropagation()
                addCategory()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCategory} disabled={!newCat.trim()}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {kind === "monthly" ? (
        <div className="flex flex-col gap-1.5">
          <Label>الاسم (اختياري)</Label>
          <Input placeholder="إيجار المحل، راتب ليان…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>{kind === "monthly" ? "المبلغ الشهري" : "المبلغ"}</Label>
        <Input inputMode="decimal" dir="ltr" className="text-end" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {kind === "monthly" ? "يبدأ من شهر" : "عن شهر"}
          </Label>
          <Input type="month" dir="ltr" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        {kind === "monthly" ? (
          <div className="flex flex-col gap-1.5">
            <Label>ينتهي في (اختياري)</Label>
            <Input type="month" dir="ltr" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>تاريخ الدفع</Label>
            <Input type="date" dir="ltr" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
        )}
      </div>

      {kind === "once" ? (
        <div className="flex flex-col gap-1.5">
          <Label>ملاحظة</Label>
          <Input placeholder="فاتورة الكهرباء، صيانة الماكينة…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {kind === "monthly"
          ? "يُحسب في كل شهر حتى شهر النهاية، ويوزَّع على أيام الشهر في تقرير الأرباح."
          : "يُحسب على الشهر الذي يغطيه، حتى لو دُفع لاحقاً."}
      </p>
    </FormModal>
  )
}
