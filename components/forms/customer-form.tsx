"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Minus, Plus, Save, Sparkles, UserRound } from "lucide-react"
import { toast } from "sonner"

import { FormModal } from "@/components/form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ImageField } from "@/components/image-field"
import { ENDPOINTS, upsert } from "@/lib/mutate"
import { sendOrQueue } from "@/lib/offline/outbox"
import { cn } from "@/lib/utils"
import type { Customer, GenderEnum } from "@/api/generated/model"
import { adjustCustomerPoints } from "@/api/points"
import { formatMoney, formatNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { uuid } from "@/lib/offline/queue"
import { pointsValue } from "@/lib/points"

type FormValues = { name: string; phone: string; notes: string }

const GENDERS: { value: GenderEnum; label: string }[] = [
  { value: "male", label: "ذكر" },
  { value: "female", label: "أنثى" },
]


export function CustomerForm({
  open,
  onOpenChange,
  customer,
  onSaved,
  offline = false,
  onSavedLocal,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  customer?: Customer | null
  onSaved?: (c: Customer) => void
  /** The till: a NEW customer may be created with the internet down. They
   *  are kept on this device and sent before the sales that name them. */
  offline?: boolean
  onSavedLocal?: (c: { clientUuid: string; name: string; phone: string }) => void
}) {
  const qc = useQueryClient()
  const editing = Boolean(customer)
  const [gender, setGender] = useState<GenderEnum>("male")
  /* Only a gender someone actually picked counts as known — the default
     "male" on a fresh row is not information. */
  const [genderSet, setGenderSet] = useState(false)
  const [birth, setBirth] = useState("")
  const [status, setStatus] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  // Owner only: correct the points balance by hand (a signed move on the
  // ledger, never an overwrite). Employees never see this — points are
  // worked out from purchases.
  const isOwner = useIsOwner()
  const [ptsMode, setPtsMode] = useState<"add" | "remove">("add")
  const [ptsAmount, setPtsAmount] = useState("")
  const [ptsNote, setPtsNote] = useState("")
  const balance = Number((customer as { points?: number } | null | undefined)?.points ?? 0)
  const ptsN = Math.max(0, Math.floor(Number(ptsAmount) || 0))
  const ptsDelta = ptsMode === "add" ? ptsN : -Math.min(ptsN, balance)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: "", phone: "", notes: "" },
  })

  useEffect(() => {
    if (!open) return
    if (customer) {
      reset({
        name: customer.name ?? "",
        phone: customer.phone ?? "",
        notes: customer.notes ?? "",
      })
      setGender((customer.gender as GenderEnum) ?? "male")
      setGenderSet(Boolean((customer as unknown as { gender_set?: boolean }).gender_set))
      setBirth((customer as unknown as { birth_date?: string | null }).birth_date ?? "")
      setStatus(customer.status ?? "")
      setAvatarUrl(customer.avatar ?? "")
    } else {
      reset({ name: "", phone: "", notes: "" })
      setGender("male")
      setGenderSet(false)
      setBirth("")
      setStatus("")
      setAvatarUrl("")
    }
    setAvatarFile(null)
    setPtsMode("add")
    setPtsAmount("")
    setPtsNote("")
  }, [open, customer, reset])

  async function onSubmit(v: FormValues) {
    if (offline && !customer && !avatarFile) {
      try {
        const res = await sendOrQueue<Customer>(
          "customer",
          ENDPOINTS.customers,
          { name: v.name.trim(), phone: v.phone.trim(), gender, gender_set: genderSet, status, notes: v.notes },
          `زبون: ${v.name.trim()}`,
        )
        qc.invalidateQueries({ queryKey: ["customers"] })
        qc.invalidateQueries({ queryKey: ["customers-quick"] })
        if (res.status === "sent") {
          toast.success("تمت إضافة الزبون")
          onSaved?.(res.data)
        } else {
          toast.success("حُفظ الزبون على الجهاز — يُرفع عند عودة الاتصال")
          onSavedLocal?.({ clientUuid: res.op.id, name: v.name.trim(), phone: v.phone.trim() })
        }
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
      }
      return
    }
    try {
      const res = await upsert(
        ENDPOINTS.customers,
        customer?.id,
        {
          name: v.name.trim(),
          phone: v.phone.trim(),
          gender,
          gender_set: genderSet,
          ...(customer ? { birth_date: birth || null } : {}),
          status,
          notes: v.notes,
          avatar: avatarFile ? undefined : avatarUrl.trim(),
        },
        { avatar_file: avatarFile },
      )
      if (customer && isOwner && ptsDelta !== 0) {
        try {
          await adjustCustomerPoints(customer.id, ptsDelta, ptsNote.trim() || "تعديل من المالك", uuid())
          qc.invalidateQueries({ queryKey: ["customers", "points", customer.id] })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "حُفظ الزبون، لكن تعذّر تعديل النقاط")
        }
      }
      toast.success(editing ? "تم تحديث الزبون" : "تمت إضافة الزبون")
      qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
      onSaved?.((res as unknown as { data: Customer }).data)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "تعديل زبون" : "إضافة زبون"}
      icon={<UserRound className="size-4.5" />}
      footer={
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={isSubmitting}
            data-form-primary
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5" data-tour="customer-name">
        <Label>الاسم</Label>
        <Input autoFocus={!editing} placeholder="مثال: لين عودة" {...register("name", { required: "اكتب اسم الزبون" })} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5" data-tour="customer-phone">
        <Label>
          رقم الهاتف <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
        </Label>
        <Input
          dir="ltr"
          placeholder="059…"
          inputMode="tel"
          className="text-start"
          {...register("phone")}
        />
      </div>

      {/* Creation stays minimal (name, phone, ذكر/أنثى); the photo and notes
          live in the edit form. Whether a customer is new, a regular or has
          stopped coming is worked out from their visits — never typed. */}
      <div className="flex flex-col gap-1.5">
          <Label>
            الجنس <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
          </Label>
          <RadioGroup
            value={gender}
            onValueChange={(v) => { setGender(v as GenderEnum); setGenderSet(true) }}
            className="grid grid-cols-2 gap-2"
          >
            {GENDERS.map((g) => (
              <Label
                key={g.value}
                onClick={() => { setGender(g.value); setGenderSet(true) }}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-normal transition-colors",
                  genderSet && gender === g.value
                    ? "border-primary bg-primary/8 font-semibold text-primary"
                    : "hover:bg-muted",
                )}
              >
                <RadioGroupItem value={g.value} className="sr-only" />
                {g.label}
              </Label>
            ))}
          </RadioGroup>
        </div>

      {editing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer-birth">
            تاريخ الميلاد <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
          </Label>
          <Input id="customer-birth" type="date" dir="ltr" value={birth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirth(e.target.value)} />
        </div>
      )}

      {editing && (
        <>
          <ImageField
            label="الصورة"
            shape="circle"
            url={avatarUrl}
            onUrlChange={setAvatarUrl}
            file={avatarFile}
            onFileChange={setAvatarFile}
          />

          {isOwner ? (
            <div className="space-y-2.5 rounded-2xl border p-3" data-tour="customer-points">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-500" />
                  النقاط
                </Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  الآن {formatNumber(balance)} نقطة · {formatMoney(pointsValue(balance))}
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1" role="radiogroup" aria-label="إضافة أو خصم">
                  {(
                    [
                      { v: "add", label: "إضافة", Icon: Plus },
                      { v: "remove", label: "خصم", Icon: Minus },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={ptsMode === o.v}
                      onClick={() => setPtsMode(o.v)}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        ptsMode === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <o.Icon className="size-3.5" />
                      {o.label}
                    </button>
                  ))}
                </div>
                <Input
                  inputMode="numeric"
                  dir="ltr"
                  className="text-end tabular-nums"
                  placeholder="0"
                  value={ptsAmount}
                  onChange={(e) => setPtsAmount(e.target.value.replace(/[^\d]/g, ""))}
                  aria-label="عدد النقاط"
                />
              </div>
              {ptsN > 0 ? (
                <>
                  <Input value={ptsNote} onChange={(e) => setPtsNote(e.target.value)} placeholder="السبب (اختياري): هدية، تصحيح…" />
                  <p className="text-xs text-muted-foreground">
                    بعد الحفظ: <b className="text-foreground tabular-nums">{formatNumber(balance + ptsDelta)}</b> نقطة
                    {ptsMode === "remove" && ptsN > balance ? " — لا يمكن الخصم أكثر من الرصيد" : ""}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={3} placeholder="مثلاً: يحب قهوته بلا سكر" {...register("notes")} />
          </div>
        </>
      )}
    </FormModal>
  )
}
