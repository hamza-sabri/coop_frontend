"use client"

/**
 * المصاريف — what it costs to keep the doors open. Owner only.
 *
 *   ‹ أكتوبر ٢٠٢٦ ›
 *   [ this month: total, against last month, by kind ]  [ the last six months ]
 *   [ one table: every cost that counts in this month — monthly and one-off ]
 *
 * Adding one starts with WHAT it is (a salary, the rent, a repair…), and the
 * form that follows asks only what that kind needs: a salary asks whose, a
 * bill asks which month it covers, a repair asks what was fixed. Monthly
 * costs are typed once and counted every month until they are stopped.
 */
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Droplet,
  Home,
  Loader2,
  Megaphone,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Save,
  StopCircle,
  Trash2,
  Users,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
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
  type ExpenseCategory,
  type RecurringExpense,
} from "@/api/finance"
import { staffList } from "@/api/staff"
import { Bars } from "@/components/charts"
import { ConfirmDelete } from "@/components/confirm-delete"
import { CountUp } from "@/components/count-up"
import { DataTable, type Column } from "@/components/data-table"
import { FormModal } from "@/components/form-modal"
import { Enter, PageShell } from "@/components/page-shell"
import { Panel } from "@/components/reports/kit"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatDate, formatMoney, toNumber } from "@/lib/format"
import { useOwnerState } from "@/lib/modules"
import { businessToday, label as periodLabel, monthName } from "@/lib/period"
import { MonthStepper } from "@/components/month-stepper"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

/* ── what each kind is, and what its form asks ─────────────────────────── */

type Kind = {
  icon: LucideIcon
  tint: string
  /** Counted every month by default. */
  monthly: boolean
  /** Can be switched between monthly and one-off (a bill or a repair cannot). */
  canRepeat?: boolean
  /** The question for `payee`, or null when not asked. */
  payee: { label: string; placeholder: string; chips?: string[] } | null
  /** The question for `note`, or null. Required when `noteRequired`. */
  note: { label: string; placeholder: string; chips?: string[] } | null
  noteRequired?: boolean
  /** A bill: ask which month it covers, separately from the day it was paid. */
  bill?: boolean
}

const KINDS: Record<string, Kind> = {
  salaries: { icon: Users, tint: "bg-violet-500/12 text-violet-700 dark:text-violet-300", monthly: true, canRepeat: true, payee: null, note: { label: "ملاحظة", placeholder: "مثلاً: مكافأة العيد" } },
  rent: { icon: Home, tint: "bg-sky-500/12 text-sky-700 dark:text-sky-300", monthly: true, canRepeat: true, payee: { label: "لمن يُدفع", placeholder: "صاحب العقار" }, note: null },
  electricity: { icon: Zap, tint: "bg-amber-500/15 text-amber-800 dark:text-amber-300", monthly: false, bill: true, payee: { label: "الجهة", placeholder: "شركة الكهرباء" }, note: null },
  water: { icon: Droplet, tint: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300", monthly: false, bill: true, payee: { label: "الجهة", placeholder: "البلدية" }, note: null },
  internet: { icon: Wifi, tint: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300", monthly: true, canRepeat: true, payee: { label: "الشركة", placeholder: "شركة الاتصالات" }, note: null },
  maintenance: {
    icon: Wrench,
    tint: "bg-orange-500/12 text-orange-700 dark:text-orange-300",
    monthly: false,
    payee: { label: "من صلّحه", placeholder: "فني الماكينات" },
    note: { label: "ماذا صُلّح؟", placeholder: "تصليح ماكينة القهوة", chips: ["ماكينة القهوة", "الثلاجة", "المكيّف", "الخلاط", "سباكة", "كهرباء المحل"] },
    noteRequired: true,
  },
  marketing: {
    icon: Megaphone,
    tint: "bg-pink-500/12 text-pink-700 dark:text-pink-300",
    monthly: false,
    payee: { label: "أين أعلنت؟", placeholder: "انستغرام", chips: ["انستغرام", "فيسبوك", "تيك توك", "منشورات مطبوعة", "لافتة"] },
    note: { label: "ملاحظة", placeholder: "عرض الافتتاح" },
  },
  other: {
    icon: Receipt,
    tint: "bg-muted text-muted-foreground",
    monthly: false,
    canRepeat: true,
    payee: { label: "لمن دُفع", placeholder: "المحل أو الشخص" },
    note: { label: "على ماذا؟", placeholder: "مستلزمات تنظيف" },
    noteRequired: true,
  },
}
const kindOf = (key: string | undefined) => KINDS[key ?? ""] ?? KINDS.other

/* ── rows of the table ────────────────────────────────────────────────── */

type Row =
  | { type: "monthly"; id: string; r: RecurringExpense }
  | { type: "once"; id: string; e: Expense }

function rowTitle(row: Row): string {
  if (row.type === "monthly") {
    const r = row.r
    if (r.category_key === "salaries" && r.staff_name) return `راتب ${r.staff_name}`
    return r.name || r.category_name
  }
  const e = row.e
  if (e.category_key === "salaries" && e.staff_name) return `${e.note || "دفعة"} — ${e.staff_name}`
  return e.note || e.category_name
}
function rowSub(row: Row): string {
  if (row.type === "monthly") {
    const r = row.r
    const since = `كل شهر منذ ${monthName(r.start_month)}`
    return [r.payee, r.end_month ? `${since} حتى ${monthName(r.end_month)}` : since].filter(Boolean).join(" · ")
  }
  const e = row.e
  return [e.payee, e.paid_on ? `دُفع ${formatDate(e.paid_on)}` : null].filter(Boolean).join(" · ") || "مرة واحدة"
}
const rowKey = (row: Row) => (row.type === "monthly" ? row.r.category_key : row.e.category_key)
const rowAmount = (row: Row) => toNumber(row.type === "monthly" ? row.r.amount : row.e.amount)
const rowCat = (row: Row) => (row.type === "monthly" ? row.r.category_name : row.e.category_name)

type Editing =
  | { mode: "new" }
  | { mode: "once"; row: Expense }
  | { mode: "monthly"; row: RecurringExpense }
  | null

export default function ExpensesPage() {
  const ownerState = useOwnerState()
  const isOwner = ownerState === "owner"
  const today = businessToday()
  const [anchor, setAnchor] = useState(today.slice(0, 8) + "01")
  const month = anchor.slice(0, 7)
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  const rows = useMemo<Row[]>(
    () => [
      ...(data?.recurring ?? []).map((r) => ({ type: "monthly" as const, id: `m${r.id}`, r })),
      ...(data?.expenses ?? []).map((e) => ({ type: "once" as const, id: `o${e.id}`, e })),
    ],
    [data],
  )

  function moveMonth(dir: -1 | 1) {
    const d = new Date(`${anchor}T00:00:00`)
    d.setMonth(d.getMonth() + dir)
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`)
  }

  async function stopFromNextMonth(r: RecurringExpense) {
    try {
      await saveRecurring(r.id, { end_month: `${month}-01` })
      toast.success(`«${rowTitle({ type: "monthly", id: "", r })}» يتوقف بعد ${monthName(`${month}-01`)}`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      if (toDelete.type === "monthly") await deleteRecurring(toDelete.r.id)
      else await deleteExpense(toDelete.e.id)
      toast.success("حُذف المصروف")
      refresh()
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  if (ownerState === "loading") {
    return (
      <PageShell title="المصاريف">
        <Skeleton className="h-64 rounded-2xl" />
      </PageShell>
    )
  }
  if (!isOwner) {
    return (
      <PageShell title="المصاريف">
        <p className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">المصاريف للمالك فقط.</p>
      </PageShell>
    )
  }

  const total = toNumber(data?.total)
  const prev = toNumber(data?.previous_total)
  const diff = total - prev
  const byKind = (data?.by_category ?? []).filter((c) => toNumber(c.amount) > 0)

  const columns: Column<Row>[] = [
    {
      key: "what",
      header: "المصروف",
      sort: (r) => rowTitle(r),
      cell: (r) => <WhatCell row={r} />,
    },
    {
      key: "kind",
      header: "يتكرر؟",
      width: "w-36",
      hideBelow: "lg",
      sort: (r) => rowCat(r),
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {r.type === "monthly" ? <Repeat className="size-3.5" /> : null}
          {r.type === "monthly" ? "كل شهر" : "مرة واحدة"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "المبلغ",
      align: "end",
      width: "w-36",
      sort: rowAmount,
      cell: (r) => <span className="font-heading font-bold tabular-nums">{formatMoney(rowAmount(r))}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "w-12",
      align: "end",
      cell: (r) => (
        <RowMenu
          row={r}
          onEdit={() => setEditing(r.type === "monthly" ? { mode: "monthly", row: r.r } : { mode: "once", row: r.e })}
          onStop={r.type === "monthly" && !r.r.end_month ? () => stopFromNextMonth(r.r) : undefined}
          onDelete={() => setToDelete(r)}
        />
      ),
    },
  ]

  return (
    <PageShell
      title="المصاريف"
      action={
        <>
          {/* The month the whole page is about — beside the title, never a row of its own. */}
          <MonthStepper size="sm" className="max-sm:hidden" value={month} onChange={(m) => setAnchor(`${m}-01`)} max={today.slice(0, 7)} />
          <Button
            size="sm"
            className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25"
            onClick={() => setEditing({ mode: "new" })}
            aria-label="إضافة مصروف"
          >
            <Plus className="size-4" />
            <span className="max-sm:hidden">مصروف</span>
          </Button>
        </>
      }
    >

      {/* the month at a glance, beside the last six months */}
      {isLoading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Enter i={0}>
            <Panel
              className="h-full"
              title={
                <>
                  <span className="sm:hidden">مصاريف الشهر</span>
                  <span className="max-sm:hidden">مصاريف {periodLabel("month", anchor)}</span>
                </>
              }
              hint="كل ما يُحسب على هذا الشهر، حسب النوع"
              // On a phone the top bar has no room for the month — it lives here.
              action={<MonthStepper size="sm" className="sm:hidden" value={month} onChange={(m) => setAnchor(`${m}-01`)} max={today.slice(0, 7)} />}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-heading text-3xl font-bold tabular-nums">
                  <CountUp value={total} decimals={2} suffix=" ₪" />
                </p>
                {prev > 0 ? (
                  <p className={cn("text-sm", diff > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
                    {diff > 0 ? "أكثر" : "أقل"} من الشهر الماضي بـ {formatMoney(Math.abs(diff))}
                  </p>
                ) : null}
              </div>
              {byKind.length ? (
                <Bars
                  className="mt-3"
                  height={190}
                  showValues={byKind.length <= 8}
                  data={byKind.map((c) => ({ label: c.name, value: toNumber(c.amount) }))}
                  format={(v) => formatMoney(v)}
                />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">لا مصاريف مسجلة لهذا الشهر بعد.</p>
              )}
            </Panel>
          </Enter>
          <Enter i={1}>
            <Panel className="h-full" title="آخر ستة أشهر" hint="مجموع المصاريف في كل شهر">
              <Bars
                height={240}
                showValues
                data={(data?.trend ?? []).map((t) => ({ label: monthName(`${t.month}-01`).split(" ")[0], title: monthName(`${t.month}-01`), value: toNumber(t.total) }))}
                format={(v) => formatMoney(v)}
              />
            </Panel>
          </Enter>
        </div>
      )}

      {/* every cost in this month */}
      <Enter i={2}>
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.id}
          columns={columns}
          loading={isLoading}
          searchText={(r) => `${rowTitle(r)} ${rowSub(r)} ${rowCat(r)}`}
          searchPlaceholder="ابحث في المصاريف…"
          defaultSort={{ key: "amount", dir: "desc" }}
          filters={[
            { id: "all", label: "الكل" },
            { id: "monthly", label: "كل شهر", test: (r) => r.type === "monthly" },
            { id: "once", label: "مرة واحدة", test: (r) => r.type === "once" },
            { id: "salaries", label: "الرواتب", test: (r) => rowKey(r) === "salaries" },
          ]}
          onRowClick={(r) => setEditing(r.type === "monthly" ? { mode: "monthly", row: r.r } : { mode: "once", row: r.e })}
          empty={
            <div className="flex flex-col items-center gap-3">
              <p>لا مصاريف لهذا الشهر بعد.</p>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ mode: "new" })}>
                <Plus className="size-4" />
                سجّل أول مصروف
              </Button>
            </div>
          }
          mobileRow={(r) => (
            <div className="flex items-center gap-3">
              <KindIcon k={rowKey(r)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{rowTitle(r)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{rowSub(r)}</p>
              </div>
              <span className="shrink-0 font-heading text-sm font-bold tabular-nums">{formatMoney(rowAmount(r))}</span>
            </div>
          )}
        />
      </Enter>

      <ExpenseForm editing={editing} month={month} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDelete
        open={toDelete != null}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={toDelete ? `حذف «${rowTitle(toDelete)}»؟` : ""}
        description={
          toDelete?.type === "monthly"
            ? "يُحذف من كل الأشهر، الماضية أيضاً. إذا توقف هذا المصروف فقط، اختر «إيقافه» بدل الحذف."
            : "يُحذف هذا المصروف من الشهر ومن التقارير."
        }
      />
    </PageShell>
  )
}

function KindIcon({ k }: { k: string }) {
  const kind = kindOf(k)
  const Icon = kind.icon
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", kind.tint)}>
      <Icon className="size-4" />
    </span>
  )
}

function WhatCell({ row }: { row: Row }) {
  return (
    <div className="flex items-center gap-3">
      <KindIcon k={rowKey(row)} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{rowTitle(row)}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-medium">{rowCat(row)}</span> · {rowSub(row)}
        </p>
      </div>
    </div>
  )
}

function RowMenu({ row, onEdit, onStop, onDelete }: { row: Row; onEdit: () => void; onStop?: () => void; onDelete: () => void }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" aria-label={`خيارات ${rowTitle(row)}`}>
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" />
            تعديل
          </DropdownMenuItem>
          {onStop ? (
            <DropdownMenuItem onClick={onStop}>
              <StopCircle className="size-4" />
              إيقافه بعد هذا الشهر
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" />
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ── the form: pick what it is, then answer only what that kind needs ── */

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
  const cats = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => fetchExpenseCategories().then((r) => r.data),
    enabled: open,
    staleTime: 60_000,
  })
  const staff = useQuery({ queryKey: ["staff"], queryFn: staffList, enabled: open, staleTime: 60_000 })

  const [cat, setCat] = useState<ExpenseCategory | null>(null)
  const [monthly, setMonthly] = useState(false)
  const [amount, setAmount] = useState("")
  const [period, setPeriod] = useState(month)
  const [paidOn, setPaidOn] = useState("")
  const [note, setNote] = useState("")
  const [payee, setPayee] = useState("")
  const [person, setPerson] = useState<number | null>(null)
  const [newCat, setNewCat] = useState("")
  const [saving, setSaving] = useState(false)
  const [seenFor, setSeenFor] = useState<Editing>(null)

  // Fill the form whenever a different row (or a new one) is opened.
  if (open && editing !== seenFor) {
    setSeenFor(editing)
    const todayIso = new Date().toISOString().slice(0, 10)
    if (editing.mode === "new") {
      setCat(null)
      setMonthly(false)
      setAmount("")
      setPeriod(month)
      setPaidOn(todayIso)
      setNote("")
      setPayee("")
      setPerson(null)
    } else if (editing.mode === "once") {
      const r = editing.row
      setCat({ id: r.category, name: r.category_name, key: r.category_key, position: 0 })
      setMonthly(false)
      setAmount(r.amount)
      setPeriod(r.period.slice(0, 7))
      setPaidOn(r.paid_on ?? "")
      setNote(r.note)
      setPayee(r.payee)
      setPerson(r.staff)
    } else {
      const r = editing.row
      setCat({ id: r.category, name: r.category_name, key: r.category_key, position: 0 })
      setMonthly(true)
      setAmount(r.amount)
      setPeriod(r.start_month.slice(0, 7))
      setNote(r.name)
      setPayee(r.payee)
      setPerson(r.staff)
    }
  }
  if (!open && seenFor !== null) setSeenFor(null)

  const isNew = editing?.mode === "new"
  const kind = kindOf(cat?.key)
  const isSalary = cat?.key === "salaries"
  const people = (staff.data ?? []).filter((u) => u.is_active)

  function pick(c: ExpenseCategory) {
    setCat(c)
    setMonthly(kindOf(c.key).monthly)
    if (kindOf(c.key).payee && !payee) setPayee("")
  }

  async function addCategory() {
    const n = newCat.trim()
    if (!n) return
    try {
      const r = await createExpenseCategory(n)
      await cats.refetch()
      pick(r.data)
      setNewCat("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إضافة النوع")
    }
  }

  async function save() {
    if (!cat) return toast.error("اختر نوع المصروف")
    if (isSalary && !person) return toast.error("اختر الموظف")
    if (!(toNumber(amount) > 0)) return toast.error("اكتب المبلغ")
    if (kind.noteRequired && !note.trim()) return toast.error(`اكتب ${kind.note?.label.replace("؟", "")}`)
    setSaving(true)
    try {
      if (monthly) {
        await saveRecurring(editing?.mode === "monthly" ? editing.row.id : null, {
          category: cat.id,
          amount: toNumber(amount).toFixed(2),
          name: isSalary ? "" : note.trim() || cat.name,
          staff: isSalary ? person : null,
          payee: payee.trim(),
          start_month: `${period}-01`,
        })
      } else {
        await saveExpense(editing?.mode === "once" ? editing.row.id : null, {
          category: cat.id,
          amount: toNumber(amount).toFixed(2),
          period: `${period}-01`,
          paid_on: paidOn || null,
          note: note.trim(),
          staff: isSalary ? person : null,
          payee: payee.trim(),
        })
      }
      toast.success(isNew ? "سُجّل المصروف" : "حُفظ التعديل")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const choosing = isNew && !cat
  const defaults = (cats.data ?? []).filter((c) => KINDS[c.key])
  const custom = (cats.data ?? []).filter((c) => !KINDS[c.key])

  return (
    <FormModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={choosing ? "ما نوع المصروف؟" : cat ? (isNew ? `مصروف جديد: ${cat.name}` : `تعديل: ${cat.name}`) : "مصروف"}
      icon={cat ? <KindIconBare k={cat.key} /> : <Receipt className="size-4.5" />}
      footer={
        choosing ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        ) : (
          <>
            <Button type="button" className="bg-brand-gradient flex-1 shadow-md shadow-primary/25" disabled={saving} data-form-primary onClick={save}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isNew ? "حفظ المصروف" : "حفظ التعديل"}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={isNew ? () => setCat(null) : onClose}>
              {isNew ? "رجوع" : "إلغاء"}
            </Button>
          </>
        )
      }
    >
      {choosing ? (
        <div key="choose" className="stagger space-y-3">
          {cats.isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {defaults.map((c, i) => {
                const k = kindOf(c.key)
                const Icon = k.icon
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/80 bg-card px-2 py-3 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] animate-in fade-in zoom-in-95 fill-mode-both"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className={cn("grid size-10 place-items-center rounded-xl", k.tint)}>
                      <Icon className="size-5" />
                    </span>
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
          {custom.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">أنواع أضفتها:</span>
              {custom.map((c) => (
                <button key={c.id} type="button" onClick={() => pick(c)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <Input
              placeholder="نوع غير موجود؟ اكتب اسمه…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  e.stopPropagation()
                  void addCategory()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addCategory} disabled={!newCat.trim()} className="gap-1">
              <Plus className="size-4" />
              إضافة
            </Button>
          </div>
        </div>
      ) : cat ? (
        <div key={`form-${cat.id}`} className="stagger space-y-4">
          {isSalary ? (
            <Field label="لمن الراتب؟">
              {people.length === 0 ? (
                <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  لا موظفين بعد — أضفهم من صفحة الموظفين أولاً.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {people.map((u) => {
                    const on = person === u.id
                    const name = u.display_name || u.username
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPerson(u.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border py-2 ps-2 pe-4 text-start text-sm transition",
                          on ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border/80 hover:bg-muted",
                        )}
                      >
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", on ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Field>
          ) : null}

          {kind.canRepeat ? (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/80 px-3 py-2.5">
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Repeat className="size-4 text-muted-foreground" />
                {isSalary ? "راتب شهري ثابت" : "يتكرر كل شهر"}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {monthly
                  ? "تكتبه مرة واحدة ويُحسب كل شهر حتى توقفه."
                  : isSalary
                    ? "دفعة لمرة واحدة: مكافأة، سلفة، أو راتب شهر واحد."
                    : "يُحسب على شهر واحد فقط."}
              </span>
            </span>
            <Switch checked={monthly} onCheckedChange={setMonthly} disabled={!isNew} />
          </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={monthly ? "المبلغ كل شهر" : "المبلغ"}>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  dir="ltr"
                  className="h-11 pe-9 text-end font-heading text-lg font-bold"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus={!isSalary}
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₪</span>
              </div>
            </Field>
            <Field label={monthly ? "يبدأ من شهر" : kind.bill ? "فاتورة أي شهر؟" : "عن شهر"}>
              <MonthStepper size="lg" value={period} onChange={setPeriod} />
            </Field>
          </div>

          {kind.note && !(monthly && isSalary) ? (
            <Field label={kind.note.label + (kind.noteRequired ? "" : " (اختياري)")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind.note.placeholder} />
              {kind.note.chips ? <Chips options={kind.note.chips} value={note} onPick={setNote} /> : null}
            </Field>
          ) : null}

          {kind.payee ? (
            <Field label={kind.payee.label + " (اختياري)"}>
              <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={kind.payee.placeholder} />
              {kind.payee.chips ? <Chips options={kind.payee.chips} value={payee} onPick={setPayee} /> : null}
            </Field>
          ) : null}

          {!monthly ? (
            <Field label="تاريخ الدفع (اختياري)">
              <DatePicker value={paidOn} onChange={setPaidOn} placeholder="متى دُفع؟" />
            </Field>
          ) : null}
        </div>
      ) : null}
    </FormModal>
  )
}

function KindIconBare({ k }: { k: string }) {
  const Icon = kindOf(k).icon
  return <Icon className="size-4.5" />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
    </div>
  )
}

function Chips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs transition",
            value === o ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border/80 text-muted-foreground hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
