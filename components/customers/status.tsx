"use client"

/* Where a customer stands, said the same way on the list and the profile. */
import type { CustomerStatus } from "@/api/customer-profile"
import { cn } from "@/lib/utils"

export const STATUS: Record<CustomerStatus, { m: string; f: string; cls: string; dot: string }> = {
  regular: { m: "زبون دائم", f: "زبونة دائمة", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  active: { m: "يزورنا", f: "تزورنا", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  new: { m: "جديد", f: "جديدة", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  fading: { m: "غاب عنّا", f: "غابت عنّا", cls: "bg-amber-500/12 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  no_visits: { m: "لم يزرنا بعد", f: "لم تزرنا بعد", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

export function StatusPill({ status, female, className }: { status: CustomerStatus; female?: boolean; className?: string }) {
  const s = STATUS[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", s.cls, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {female ? s.f : s.m}
    </span>
  )
}

/** 0 → «اليوم», 1 → «أمس», 2 → «منذ يومين», 9 → «منذ 9 أيام». */
export function ago(days: number | null | undefined): string {
  if (days == null) return "—"
  if (days <= 0) return "اليوم"
  if (days === 1) return "أمس"
  if (days === 2) return "منذ يومين"
  if (days <= 10) return `منذ ${days} أيام`
  return `منذ ${days} يوماً`
}
