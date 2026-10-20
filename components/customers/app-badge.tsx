"use client"
/* Is this customer in the app? And a one-tap way to text them the link.

   Three states: in the app · link sent (not opened yet) · not registered.
   Sending costs one SMS, so the button asks once before it sends again to
   someone who already got a link. */
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ExternalLink, Loader2, MessageSquareText, QrCode, RefreshCw, Smartphone } from "lucide-react"

import { appQr, sendAppLink } from "@/api/customer-profile"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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

/** QR on the customer screen: scan it in the shop and you are signed in.
 *  No SMS. Alive 5 minutes, single use. */
export function AppQrButton({ id, name, app }: { id: number; name: string; app: boolean }) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState<{ qr: string; url: string; until: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [open])

  if (app) return null

  async function make() {
    setBusy(true)
    try {
      const r = await appQr(id)
      setQr({ qr: r.data.qr, url: r.data.url, until: Date.now() + r.data.expires_in * 1000 })
      setNow(Date.now())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الرمز")
    } finally {
      setBusy(false)
    }
  }

  function openOnCustomerScreen() {
    if (!qr) return
    // A plain window the cashier drags to the customer's screen.
    const w = window.open("", "sijilli-customer-qr", "width=520,height=640")
    if (!w) return
    w.document.title = "امسح للدخول"
    w.document.body.innerHTML =
      `<div dir="rtl" style="font-family:system-ui;text-align:center;padding:24px;background:#fff;color:#111">` +
      `<h1 style="font-size:28px;margin:0 0 6px">امسح الرمز بكاميرا جوالك</h1>` +
      `<p style="font-size:18px;margin:0 0 16px">وادخل حسابك ونقاطك مباشرة</p>` +
      `<img src="${qr.qr}" style="width:420px;max-width:90vw;height:auto" alt="QR"/>` +
      `<p style="font-size:14px;color:#555">صالح لمدة 5 دقائق ولمرة وحدة</p></div>`
  }

  const left = qr ? Math.max(0, Math.round((qr.until - now) / 1000)) : 0
  const expired = qr !== null && left === 0

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(true); if (!qr || expired) void make() }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setOpen(true); void make() } }}
        data-track="customer-app-qr-button"
        aria-label={`رمز QR لدخول ${name}`}
        title="رمز QR للدخول من المحل (بدون رسالة)"
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold text-primary transition hover:bg-primary/5"
      >
        <QrCode className="size-3" /> QR
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogTitle className="text-center">امسح للدخول — {name}</DialogTitle>
          <div className="grid place-items-center gap-3 text-center">
            {qr && !expired ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.qr} alt="QR" className="size-64 rounded-xl bg-white p-2" />
            ) : (
              <div className="grid size-64 place-items-center rounded-xl border text-sm text-muted-foreground">
                {busy ? <Loader2 className="size-6 animate-spin" /> : "انتهت صلاحية الرمز"}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {qr && !expired
                ? `يمسحه الزبون بكاميرا جواله ويدخل مباشرة · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
                : "أنشئ رمزاً جديداً"}
            </p>
            <div className="flex gap-2">
              <span role="button" tabIndex={0} onClick={() => void make()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold">
                <RefreshCw className="size-3.5" /> رمز جديد
              </span>
              {qr && !expired ? (
                <span role="button" tabIndex={0} onClick={openOnCustomerScreen}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold">
                  <ExternalLink className="size-3.5" /> اعرضه على شاشة الزبون
                </span>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
