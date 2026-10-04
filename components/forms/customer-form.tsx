"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, UserRound } from "lucide-react"
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
  const [status, setStatus] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

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
      setStatus(customer.status ?? "")
      setAvatarUrl(customer.avatar ?? "")
    } else {
      reset({ name: "", phone: "", notes: "" })
      setGender("male")
      setStatus("")
      setAvatarUrl("")
    }
    setAvatarFile(null)
  }, [open, customer, reset])

  async function onSubmit(v: FormValues) {
    if (offline && !customer && !avatarFile) {
      try {
        const res = await sendOrQueue<Customer>(
          "customer",
          ENDPOINTS.customers,
          { name: v.name.trim(), phone: v.phone.trim(), gender, status, notes: v.notes },
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
          status,
          notes: v.notes,
          avatar: avatarFile ? undefined : avatarUrl.trim(),
        },
        { avatar_file: avatarFile },
      )
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
      <div className="flex flex-col gap-1.5">
        <Label>الاسم</Label>
        <Input autoFocus={!editing} placeholder="مثال: لين عودة" {...register("name", { required: "اكتب اسم الزبون" })} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>
          رقم الهاتف <span className="text-xs font-normal text-muted-foreground">(ليجده الكاشير بسرعة)</span>
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
          <Label>الجنس</Label>
          <RadioGroup
            value={gender}
            onValueChange={(v) => setGender(v as GenderEnum)}
            className="grid grid-cols-2 gap-2"
          >
            {GENDERS.map((g) => (
              <Label
                key={g.value}
                onClick={() => setGender(g.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-normal transition-colors",
                  gender === g.value
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
        <>
          <ImageField
            label="الصورة"
            shape="circle"
            url={avatarUrl}
            onUrlChange={setAvatarUrl}
            file={avatarFile}
            onFileChange={setAvatarFile}
          />

          <div className="flex flex-col gap-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={3} placeholder="مثلاً: يحب قهوته بلا سكر" {...register("notes")} />
          </div>
        </>
      )}
    </FormModal>
  )
}
