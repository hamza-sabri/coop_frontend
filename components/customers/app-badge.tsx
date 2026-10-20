"use client"
/* Is this customer in the app? And a one-tap way to text them the link.

   Three states: in the app · link sent (not opened yet) · not registered.
   Sending costs one SMS, so the button asks once before it sends again to
   someone who already got a link. */
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, MessageSquareText, Smartphone } from "lucide-react"

import { sendAppLink } from "@/api/customer-profile"
import { cn } from "@/lib/utils"

export function AppBadge({
  app,
  invitedAt,
  className,
}: {
  app: boolean
  invitedAt?: string | null
  className?: string
}) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
  if (app) {
    return (
      <span className={cn(base, "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400", className)} title="سجّل في التطبيق">
        <Smartphone className="size-3" /> بالتطبيق
      </span>
    )
  }
  if (invitedAt) {
    return (
      <span
        className={cn(base, "bg-amber-500/12 text-amber-700 dark:text-amber-400", className)}
        title={`أُرسل الرابط ${new Date(invitedAt).toLocaleString("ar")}`}
      >
        أُرسل الرابط
      </span>
    )
  }
  return <span className={cn(base, "bg-muted text-muted-foreground", className)}>غير مسجّل</span>
}

export function SendAppLinkButton({
  id,
  name,
  phone,
  app,
  invitedAt,
  compact = true,
}: {
  id: number
  name: string
  phone: string
  app: boolean
  invitedAt?: string | null
  compact?: boolean
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  if (app || !phone) return null

  async function send(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (busy) return
    if (invitedAt && !window.confirm(`أُرسل الرابط لـ${name} من قبل. نرسله مرة ثانية؟ (رسالة SMS جديدة)`)) return
    setBusy(true)
    try {
      const r = await sendAppLink(id)
      toast.success(r.data.dry_run ? "الرابط جاهز (وضع التجربة — لم تُرسل رسالة)" : `أُرسل رابط التطبيق لـ${name}`)
      qc.invalidateQueries({ queryKey: ["customers"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الإرسال")
    } finally {
      setBusy(false)
    }
  }

  return (
    // A span, not a <button>: it sits inside table rows that are themselves
    // buttons, and a button inside a button is invalid HTML (hydration error).
    <span
      role="button"
      tabIndex={0}
      onClick={send}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void send(e) }}
      aria-disabled={busy}
      data-track="customer-send-app-link-button"
      aria-label={`أرسل رابط التطبيق لـ${name}`}
      title="أرسل رابط التطبيق برسالة SMS"
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold text-primary transition hover:bg-primary/5 aria-disabled:opacity-50",
        !compact && "px-3 py-1 text-xs",
      )}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <MessageSquareText className="size-3" />}
      {invitedAt ? "إعادة" : "أرسل الرابط"}
    </span>
  )
}
