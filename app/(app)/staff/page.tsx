"use client"

/**
 * الموظفون — who works here, and how their month is going.
 *
 *   ┌ من باع أكثر هذا الشهر ───────────────┐┌ الفريق ─────────────┐
 *   │ ▇ ▇ ▅ ▅                               ││ ٤ يعملون · رواتب ₪   │
 *   └───────────────────────────────────────┘└─────────────────────┘
 *   [ابحث…] [الكل][يعملون][موقوفون]
 *   الموظف · الدور · هذا الشهر · آخر بيع · الراتب · يستطيع الدخول · ⋯
 *
 * Owner only (and platform superusers, who never appear in the list).
 * Accounts are switched off, never deleted, so every past sale keeps the name
 * of whoever rang it. The salary is the one booked in المصاريف — this page
 * reads it, it does not keep a second copy.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, MoreVertical, Pencil, Plus, Trash2, UserPlus } from "lucide-react"

import { staffBoard, staffDelete, staffUpdate, type StaffBoardRow } from "@/api/staff"
import { Bars } from "@/components/charts"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable, type Column } from "@/components/data-table"
import { Fab } from "@/components/fab"
import { ErrorState } from "@/components/states"
import { Enter, PageShell } from "@/components/page-shell"
import { Panel } from "@/components/reports/kit"
import { StaffForm } from "@/components/staff/staff-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useMe } from "@/hooks/use-me"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useOwnerState } from "@/lib/modules"
import { cn } from "@/lib/utils"

const nameOf = (u: StaffBoardRow) => u.display_name || u.username

function lastSale(iso: string | null): string {
  if (!iso) return "لم يبع بعد"
  const t = new Date(iso)
  const now = new Date()
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(t.toDateString()).getTime()) / 86_400_000)
  const time = t.toLocaleTimeString("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" })
  if (days <= 0) return `اليوم ${time}`
  if (days === 1) return `أمس ${time}`
  if (days === 2) return "منذ يومين"
  if (days <= 10) return `منذ ${days} أيام`
  return t.toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "short" })
}

export default function StaffPage() {
  const qc = useQueryClient()
  const ownerState = useOwnerState()
  const { user: me } = useMe()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StaffBoardRow | null>(null)
  const [toDelete, setToDelete] = useState<StaffBoardRow | null>(null)
  const remove = useMutation({
    mutationFn: (u: StaffBoardRow) => staffDelete(u.id),
    onSuccess: (_r, u) => {
      toast.success(`حُذف حساب ${nameOf(u)}`)
      setToDelete(null)
      qc.invalidateQueries({ queryKey: ["staff"] })
    },
    // The server refuses for anyone with invoices and says why — show it as is.
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "تعذّر الحذف"),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["staff", "board"],
    queryFn: staffBoard,
    enabled: ownerState === "owner",
    placeholderData: (p) => p,
  })
  const rows = useMemo(() => data?.results ?? [], [data])

  const toggle = useMutation({
    mutationFn: (u: StaffBoardRow) => staffUpdate(u.id, { is_active: !u.is_active }),
    onMutate: async (u) => {
      // Flip it now; the server answer follows.
      qc.setQueryData<{ month: string; results: StaffBoardRow[] }>(["staff", "board"], (d) =>
        d ? { ...d, results: d.results.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)) } : d,
      )
    },
    onSuccess: (_r, u) => toast.success(u.is_active ? `أُوقف حساب ${nameOf(u)}` : `عاد ${nameOf(u)} يستطيع الدخول`),
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "تعذّر التحديث"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  })

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(u: StaffBoardRow) {
    setEditing(u)
    setFormOpen(true)
  }

  const active = rows.filter((u) => u.is_active)
  const salaries = active.reduce((a, u) => a + toNumber(u.salary), 0)
  const unpaid = active.filter((u) => u.role === "employee" && !u.salary)
  const chart = [...active]
    .filter((u) => u.month_sales > 0)
    .sort((a, b) => toNumber(b.month_total) - toNumber(a.month_total))
    .map((u) => ({ label: nameOf(u), value: toNumber(u.month_total), title: `${nameOf(u)} · ${formatNumber(u.month_sales)} فاتورة` }))

  const columns: Column<StaffBoardRow>[] = [
    {
      key: "name",
      header: "الموظف",
      sort: (u) => nameOf(u),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Face u={u} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {nameOf(u)}
              {u.id === me?.id ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">أنت</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {u.username}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "الدور",
      width: "w-28",
      sort: (u) => (u.role === "owner" ? 0 : 1),
      cell: (u) => (
        <span className={cn("pill", u.role === "owner" ? "pill-success" : "pill-neutral")}>{u.role === "owner" ? "مالك" : "موظف"}</span>
      ),
    },
    {
      key: "month",
      header: "بيع هذا الشهر",
      width: "w-36",
      align: "end",
      sort: (u) => toNumber(u.month_total),
      cell: (u) =>
        u.month_sales ? (
          <div>
            <p className="font-semibold tabular-nums">{formatMoney(u.month_total)}</p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(u.month_sales)} فاتورة</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "last",
      header: "آخر بيع",
      width: "w-32",
      hideBelow: "lg",
      sort: (u) => (u.last_sale ? new Date(u.last_sale).getTime() : 0),
      cell: (u) => <span className="text-sm text-muted-foreground">{lastSale(u.last_sale)}</span>,
    },
    {
      key: "salary",
      header: "الراتب الشهري",
      width: "w-32",
      align: "end",
      sort: (u) => toNumber(u.salary),
      cell: (u) =>
        u.salary ? (
          <span className="tabular-nums">{formatMoney(u.salary)}</span>
        ) : u.role === "employee" ? (
          <Link href="/expenses" onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-primary hover:underline">
            سجّله في المصاريف
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "active",
      header: "يستطيع الدخول",
      width: "w-32",
      align: "center",
      sort: (u) => (u.is_active ? 1 : 0),
      cell: (u) => (
        <div onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Switch
            checked={u.is_active}
            disabled={u.id === me?.id || toggle.isPending}
            onCheckedChange={() => toggle.mutate(u)}
            aria-label={u.is_active ? `إيقاف حساب ${nameOf(u)}` : `تفعيل حساب ${nameOf(u)}`}
          />
        </div>
      ),
    },
    {
      key: "menu",
      header: "",
      width: "w-12",
      align: "end",
      cell: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-8" aria-label={`خيارات ${nameOf(u)}`}>
                  <MoreVertical className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openEdit(u)}>
                <Pencil className="size-4" />
                تعديل وكلمة المرور
              </DropdownMenuItem>
              {u.id !== me?.id ? (
                <DropdownMenuItem onClick={() => setToDelete(u)} className="text-destructive focus:text-destructive">
                  <Trash2 className="size-4" />
                  حذف الحساب
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  if (ownerState !== "owner") {
    return (
      <PageShell title="الموظفون">
        {ownerState === "loading" ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <p className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">صفحة الموظفين للمالك فقط.</p>
        )}
      </PageShell>
    )
  }

  return (
    <PageShell
      title="الموظفون"
      action={
        <Button size="sm" className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25" onClick={openAdd}>
          <Plus className="size-4" />
          موظف
        </Button>
      }
    >
      {isError && !data ? <ErrorState onRetry={() => refetch()} /> : null}
      <Enter i={0} className={isError && !data ? "hidden" : undefined}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title="من باع أكثر هذا الشهر" hint="قيمة ما سجّله كل شخص على الكاشير منذ أول الشهر">
            {isLoading && !data ? (
              <Skeleton className="h-[180px] rounded-xl" />
            ) : chart.length ? (
              <Bars data={chart} height={180} showValues format={(v) => formatMoney(v)} />
            ) : (
              <p className="grid h-[180px] place-items-center text-sm text-muted-foreground">لا مبيعات هذا الشهر بعد.</p>
            )}
          </Panel>
          <Panel title="الفريق">
            <dl className="divide-y divide-border/70 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">يعملون الآن</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(active.length)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">رواتب كل شهر</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(salaries)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">مبيعاتهم هذا الشهر</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(active.reduce((a, u) => a + toNumber(u.month_total), 0))}</dd>
              </div>
            </dl>
            <Link
              href="/expenses"
              className={cn(
                "mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                unpaid.length ? "bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300" : "bg-muted/60 text-foreground hover:bg-muted",
              )}
            >
              {unpaid.length ? `${formatNumber(unpaid.length)} بلا راتب مسجّل — سجّله في المصاريف` : "الرواتب تُسجَّل وتُعدَّل في المصاريف"}
              <ArrowLeft className="size-3.5" />
            </Link>
          </Panel>
        </div>
      </Enter>

      <Enter i={1} className={isError && !data ? "hidden" : undefined}>
        <DataTable<StaffBoardRow>
          rows={rows}
          rowKey={(u) => u.id}
          columns={columns}
          loading={isLoading}
          onRowClick={openEdit}
          searchText={(u) => `${nameOf(u)} ${u.username} ${u.phone}`}
          searchPlaceholder="ابحث بالاسم…"
          defaultSort={{ key: "month", dir: "desc" }}
          rowClassName={(u) => (u.is_active ? undefined : "opacity-60")}
          filters={[
            { id: "all", label: "الكل" },
            { id: "on", label: "يعملون", test: (u) => u.is_active },
            { id: "off", label: "موقوفون", test: (u) => !u.is_active },
          ]}
          empty={
            <div className="flex flex-col items-center gap-3">
              <p>لا موظفين بعد. أضف من يعمل على الكاشير ليبيع بحسابه.</p>
              <Button size="sm" variant="outline" className="gap-1" onClick={openAdd}>
                <UserPlus className="size-4" />
                إضافة موظف
              </Button>
            </div>
          }
          mobileRow={(u) => (
            <div className="flex items-center gap-3">
              <Face u={u} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nameOf(u)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {u.role === "owner" ? "مالك" : "موظف"} · {lastSale(u.last_sale)}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-sm font-semibold tabular-nums">{u.month_sales ? formatMoney(u.month_total) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">{u.is_active ? "هذا الشهر" : "موقوف"}</p>
              </div>
            </div>
          )}
        />
      </Enter>

      <Fab onClick={openAdd} label="إضافة موظف" />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        loading={remove.isPending}
        title={toDelete ? `حذف حساب ${nameOf(toDelete)}؟` : "حذف الحساب"}
        description={
          toDelete?.month_sales || toDelete?.last_sale
            ? "له فواتير مسجّلة — لا يمكن حذفه، فقط إيقافه، لتبقى الفواتير باسمه."
            : "يُحذف الحساب نهائياً ولا يستطيع الدخول بعدها."
        }
      />
      <StaffForm open={formOpen} onOpenChange={setFormOpen} user={editing} isMe={editing?.id === me?.id} />
    </PageShell>
  )
}

function Face({ u }: { u: StaffBoardRow }) {
  return (
    <Avatar className="size-10 shrink-0">
      {u.photo ? <AvatarImage src={u.photo} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn("text-sm font-bold", u.role === "owner" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
        {nameOf(u).charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
