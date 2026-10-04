"use client"

/* One person's account, in the app's drawer (an object opens in a drawer —
 * see FormModal). Everything about them is here: name, how they sign in, a
 * new password, owner or employee, and which pages an employee can open.
 *
 * What an employee can open is asked as plain pages ("البيع والفواتير"),
 * only the pages this café has, all ticked by default. Ticking everything is
 * saved as "no limit", so a page added to the plan later is open to them too. */
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Crown, Eye, EyeOff, Loader2, Save, UserRound } from "lucide-react"
import { toast } from "sonner"

import { staffCreate, staffUpdate, type StaffPayload, type StaffRole, type StaffUser } from "@/api/staff"
import { FormModal } from "@/components/form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useModules } from "@/lib/modules"
import { cn } from "@/lib/utils"

/** The pages an employee can be given, in the café's words. */
const PAGES: { key: string; label: string; hint: string }[] = [
  { key: "pos", label: "البيع والفواتير", hint: "شاشة البيع وسجل الفواتير" },
  { key: "inventory", label: "المنيو والمخزون", hint: "الأصناف، تسجيل الهدر والجرد" },
  { key: "customers", label: "الزبائن", hint: "ملفات الزبائن ونقاطهم" },
  { key: "online_orders", label: "طلبات التطبيق", hint: "الطلبات القادمة من تطبيق الزبائن" },
]

type Form = {
  display_name: string
  username: string
  phone: string
  password: string
  role: StaffRole
  pages: string[]
  is_active: boolean
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export function StaffForm({
  open,
  onOpenChange,
  user,
  isMe,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: StaffUser | null
  isMe: boolean
}) {
  const qc = useQueryClient()
  const { modules } = useModules()
  // useModules hands back a new Set on every render — key the list on its
  // contents, or the reset effect below would run forever.
  const modKey = modules ? [...modules].sort().join(",") : "*"
  const pages = useMemo(
    () => PAGES.filter((p) => modKey === "*" || modKey.split(",").includes(p.key)),
    [modKey],
  )
  const [f, setF] = useState<Form>(blank(pages))
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!open) return
    setShow(false)
    if (!user) return setF(blank(pages))
    const granted = (user.allowed_modules ?? []).filter((k) => pages.some((p) => p.key === k))
    setF({
      display_name: user.display_name ?? "",
      username: user.username,
      phone: user.phone ?? "",
      password: "",
      role: user.role,
      pages: user.allowed_modules?.length ? granted : pages.map((p) => p.key),
      is_active: user.is_active,
    })
  }, [open, user, pages])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const everything = pages.every((p) => f.pages.includes(p.key))
  const problem = !f.display_name.trim()
    ? "اكتب اسم الموظف"
    : !/^[\w.@+-]+$/.test(f.username.trim())
      ? "اسم الدخول بحروف إنجليزية أو أرقام، بلا مسافات"
      : !user && f.password.length < 4
        ? "كلمة المرور ٤ أحرف على الأقل"
        : user && f.password && f.password.length < 4
          ? "كلمة المرور الجديدة ٤ أحرف على الأقل"
          : f.role === "employee" && f.pages.length === 0
            ? "اختر صفحة واحدة على الأقل"
            : null

  const save = useMutation({
    mutationFn: () => {
      const payload: StaffPayload = {
        display_name: f.display_name.trim(),
        username: f.username.trim(),
        phone: f.phone.trim(),
        role: f.role,
        // All ticked = no limit (also covers pages added to the plan later).
        allowed_modules: f.role === "owner" || everything ? [] : f.pages,
        ...(user ? { is_active: f.is_active } : {}),
        ...(f.password ? { password: f.password } : {}),
      }
      return user ? staffUpdate(user.id, payload) : staffCreate(payload)
    },
    onSuccess: () => {
      toast.success(user ? `حُفظ حساب ${f.display_name.trim()}` : `أُضيف ${f.display_name.trim()} — يستطيع الدخول الآن`)
      qc.invalidateQueries({ queryKey: ["staff"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
  })

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={user ? `تعديل ${user.display_name || user.username}` : "موظف جديد"}
      icon={<UserRound className="size-4.5" />}
      footer={
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={save.isPending || Boolean(problem)}
            data-form-primary
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {user ? "حفظ" : "إضافة الموظف"}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-name">الاسم</Label>
            <Input id="st-name" value={f.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="مثال: ليان" autoFocus={!user} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-phone">
              الهاتف <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
            </Label>
            <Input id="st-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" inputMode="tel" placeholder="059…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-user">اسم الدخول</Label>
            <Input
              id="st-user"
              value={f.username}
              onChange={(e) => set("username", e.target.value.replace(/\s/g, ""))}
              dir="ltr"
              autoComplete="off"
              placeholder="layan"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-pass">{user ? "كلمة مرور جديدة" : "كلمة المرور"}</Label>
            <div className="relative">
              <Input
                id="st-pass"
                type={show ? "text" : "password"}
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                placeholder={user ? "بلا تغيير" : "٤ أحرف على الأقل"}
                className="pe-9"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>الدور</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: "employee", title: "موظف", hint: "يبيع ويخدم. لا يرى التكاليف والأرباح والمصاريف.", Icon: UserRound },
                { v: "owner", title: "مالك", hint: "يرى كل شيء: التقارير، المصاريف، الموظفين.", Icon: Crown },
              ] as const
            ).map((o) => {
              const on = f.role === o.v
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={on}
                  disabled={isMe && o.v === "employee"}
                  onClick={() => set("role", o.v)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-start transition disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <o.Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground">{o.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {f.role === "employee" ? (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-baseline justify-between">
              <Label>ماذا يستطيع أن يفتح</Label>
              <span className="text-[11px] text-muted-foreground">{everything ? "كل صفحات الموظفين" : `${f.pages.length} من ${pages.length}`}</span>
            </div>
            <div className="divide-y divide-border/70 overflow-hidden rounded-xl border">
              {pages.map((p) => {
                const on = f.pages.includes(p.key)
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => set("pages", on ? f.pages.filter((k) => k !== p.key) : [...f.pages, p.key])}
                    className={cn(
                      "flex w-full items-start gap-2.5 p-3 text-start transition",
                      on ? "bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{p.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {user ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">يستطيع الدخول</p>
              <p className="text-[11px] text-muted-foreground">
                {isMe ? "لا يمكنك إيقاف حسابك." : "أوقفه حين يترك العمل — فواتيره السابقة تبقى باسمه."}
              </p>
            </div>
            <Switch checked={f.is_active} disabled={isMe} onCheckedChange={(v) => set("is_active", Boolean(v))} aria-label="يستطيع الدخول" />
          </div>
        ) : null}

        {problem && (f.display_name || f.username || f.password) ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{problem}</p>
        ) : null}
      </div>
    </FormModal>
  )
}

function blank(pages: { key: string }[]): Form {
  return { display_name: "", username: "", phone: "", password: "", role: "employee", pages: pages.map((p) => p.key), is_active: true }
}
