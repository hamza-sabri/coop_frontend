"use client"
/* "Alert my phone even when the app is closed" — employees only. */
import { BellRing } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useStaffPush } from "@/lib/staff-push"

export function StaffPushCard({ compact = false }: { compact?: boolean }) {
  const { state, enable } = useStaffPush()
  if (state === "not-employee" || state === "unsupported") return null
  if (state === "on") {
    return compact ? null : (
      <p className="rounded-2xl bg-lime/10 px-4 py-2.5 text-sm font-semibold text-lime">
        <BellRing className="me-1.5 inline size-4" />
        تنبيه الطلبات مفعّل على هذا الجهاز — حتى لو التطبيق مسكّر.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
      <BellRing className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">نبّهني على الجوال لما يوصل طلب — حتى لو التطبيق مسكّر</p>
        {state === "needs-install" ? (
          <p className="text-xs text-muted-foreground">
            على الآيفون: من Safari اضغط مشاركة ← «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من الأيقونة، ثم فعّل من هون.
          </p>
        ) : state === "denied" ? (
          <p className="text-xs text-muted-foreground">
            الإشعارات محظورة لهذا الموقع — اسمح بها من إعدادات المتصفح ثم ارجع هون.
          </p>
        ) : null}
      </div>
      {state === "off" && (
        <Button
          size="sm"
          onClick={async () => {
            const r = await enable()
            if (r.ok) toast.success("تمام — رح يوصلك تنبيه مع كل طلب جديد")
            else toast.error(r.error || "ما زبط التفعيل", { duration: 12000 })
          }}
        >
          فعّل
        </Button>
      )}
    </div>
  )
}
