"use client"

/**
 * الزبائن — everyone who has ever been rung up by name, as one table.
 *
 *   [ابحث بالاسم أو الهاتف…] [الكل 100][دائمون 22][جدد 9][غابوا 14][على التطبيق 3]
 *   الزبون · الحالة · الزيارات · آخر زيارة · صرف · النقاط
 *
 * The filters are the questions an owner asks: who are my regulars, who is
 * new, who stopped coming. A row opens the customer's profile.
 */
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Eye, MoreVertical, Pencil, Smartphone, Trash2, UserPlus } from "lucide-react"

import { customersTable, type CustomerRow } from "@/api/customer-profile"
import { customersRetrieve } from "@/api/generated/customers/customers"
import type { Customer } from "@/api/generated/model"
import { ConfirmDelete } from "@/components/confirm-delete"
import { StatusPill, ago } from "@/components/customers/status"
import { DataTable, type Column } from "@/components/data-table"
import { Fab } from "@/components/fab"
import { ErrorState } from "@/components/states"
import { CustomerForm } from "@/components/forms/customer-form"
import { Enter, PageShell } from "@/components/page-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { ENDPOINTS, remove } from "@/lib/mutate"

export default function CustomersPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const isOwner = useIsOwner()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customers", "table"],
    queryFn: () => customersTable().then((r) => r.data.results),
    placeholderData: (p) => p,
  })
  const rows = useMemo(() => data ?? [], [data])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  async function openEdit(c: CustomerRow) {
    try {
      const full = await customersRetrieve(String(c.id))
      setEditing(full.data as Customer)
      setFormOpen(true)
    } catch {
      toast.error("تعذر فتح بيانات الزبون")
    }
  }
  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(ENDPOINTS.customers, toDelete.id)
      toast.success(`حُذف «${toDelete.name}»`)
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["customers-quick"] })
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "الزبون",
      sort: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Face c={c} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {c.name}
              {c.app ? (
                <span title="سجّل في تطبيق كوب" className="text-muted-foreground">
                  <Smartphone className="size-3.5" />
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {c.phone || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      width: "w-32",
      sort: (c) => ["regular", "active", "new", "fading", "no_visits"].indexOf(c.status),
      cell: (c) => <StatusPill status={c.status} female={c.gender === "female"} />,
    },
    {
      key: "visits",
      header: "الزيارات",
      width: "w-32",
      sort: (c) => c.visits,
      cell: (c) => (
        <div>
          <p className="font-semibold tabular-nums">{formatNumber(c.visits)}</p>
          {c.visits_30d ? <p className="text-[11px] text-muted-foreground">{formatNumber(c.visits_30d)} هذا الشهر</p> : null}
        </div>
      ),
    },
    {
      key: "last",
      header: "آخر زيارة",
      width: "w-32",
      sort: (c) => -(c.days_since ?? 99999),
      cell: (c) => <span className="text-sm text-muted-foreground">{c.last_visit ? ago(c.days_since) : "لم يزر بعد"}</span>,
    },
    ...(isOwner
      ? [
          {
            key: "spent",
            header: "صرف عندنا",
            width: "w-32",
            align: "end" as const,
            hideBelow: "lg" as const,
            sort: (c: CustomerRow) => toNumber(c.spent),
            cell: (c: CustomerRow) => <span className="tabular-nums">{formatMoney(c.spent)}</span>,
          },
        ]
      : []),
    {
      key: "points",
      header: "النقاط",
      width: "w-28",
      align: "end",
      sort: (c) => c.points,
      cell: (c) => (
        <div>
          <p className="font-semibold tabular-nums">{formatNumber(c.points)}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">= {formatMoney(c.points / 10)}</p>
        </div>
      ),
    },
    {
      key: "menu",
      header: "",
      width: "w-12",
      align: "end",
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-8" aria-label={`خيارات ${c.name}`}>
                  <MoreVertical className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/customers/${c.id}`)}>
                <Eye className="size-4" />
                فتح الملف
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openEdit(c)}>
                <Pencil className="size-4" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setToDelete(c)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const has = (s: CustomerRow["status"]) => rows.some((c) => c.status === s)

  return (
    <PageShell
      title="الزبائن"
      action={
        <Button size="sm" className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25" onClick={openAdd} data-tour="page-add">
          <UserPlus className="size-4" />
          زبون
        </Button>
      }
    >
      {/* A failed request is never shown as "no customers yet". */}
      {isError && !data ? <ErrorState onRetry={() => refetch()} /> : null}
      <Enter i={0} className={isError && !data ? "hidden" : undefined}>
        <DataTable<CustomerRow>
          rows={rows}
          rowKey={(c) => c.id}
          columns={columns}
          loading={isLoading}
          onRowClick={(c) => router.push(`/customers/${c.id}`)}
          searchText={(c) => `${c.name} ${c.phone}`}
          searchPlaceholder="ابحث بالاسم أو رقم الهاتف…"
          defaultSort={{ key: "visits", dir: "desc" }}
          filters={[
            { id: "all", label: "الكل" },
            { id: "regular", label: "دائمون", test: (c) => c.status === "regular" },
            { id: "new", label: "جدد", test: (c) => c.status === "new" },
            { id: "fading", label: "غابوا عنّا", test: (c) => c.status === "fading", tone: "warn" },
            { id: "app", label: "على التطبيق", test: (c) => c.app },
            ...(has("no_visits") ? [{ id: "none", label: "لم يزوروا بعد", test: (c: CustomerRow) => c.status === "no_visits" }] : []),
          ]}
          empty={
            rows.length ? (
              "لا زبون يطابق."
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p>لا زبائن بعد. أضف أول زبون ليجمع النقاط مع كل طلب.</p>
                <Button size="sm" variant="outline" className="gap-1" onClick={openAdd}>
                  <UserPlus className="size-4" />
                  إضافة زبون
                </Button>
              </div>
            )
          }
          mobileRow={(c) => (
            <div className="flex items-center gap-3">
              <Face c={c} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {formatNumber(c.visits)} زيارة · {c.last_visit ? `آخرها ${ago(c.days_since)}` : "لم يزر بعد"}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <StatusPill status={c.status} female={c.gender === "female"} />
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{formatNumber(c.points)} نقطة</p>
              </div>
            </div>
          )}
        />
      </Enter>

      <Fab onClick={openAdd} label="إضافة زبون" />
      <CustomerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["customers"] })
          qc.invalidateQueries({ queryKey: ["customers-quick"] })
        }}
      />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={toDelete ? `حذف «${toDelete.name}»؟` : "حذف الزبون"}
        description="يُحذف ملف الزبون ونقاطه. فواتيره السابقة تبقى في السجل بدون اسم."
      />
    </PageShell>
  )
}

function Face({ c }: { c: CustomerRow }) {
  return (
    <Avatar className="size-10 shrink-0">
      {c.avatar ? <AvatarImage src={c.avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">{c.name.charAt(0)}</AvatarFallback>
    </Avatar>
  )
}
