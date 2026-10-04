"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, ReceiptText, Store, Upload } from "lucide-react"
import { toast } from "sonner"

import { updateBranding } from "@/api/branding-settings"
import { useBranding } from "@/hooks/use-branding"
import { BrandMark } from "@/components/brand"
import { SettingsCard } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LS_KEY = "pharma_branding_v1"

export function BrandingSection() {
  const qc = useQueryClient()
  const { name: currentName, logo: currentLogo } = useBranding()

  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Prefill the name once branding loads (currentName may arrive after mount).
  useEffect(() => setName(currentName), [currentName])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = "" // allow re-picking the same file
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const nameChanged = name.trim().length > 0 && name.trim() !== currentName
  const canSave = Boolean(file) || nameChanged

  const saveMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (file) fd.append("logo_file", file)
      if (nameChanged) fd.append("name", name.trim())
      return updateBranding(fd)
    },
    onSuccess: () => {
      toast.success("تم تحديث هوية المتجر")
      try {
        window.localStorage.removeItem(LS_KEY) // drop the mirror so it can't mask the change
      } catch {
        /* private mode */
      }
      void qc.invalidateQueries({ queryKey: ["public-branding"] })
      void qc.invalidateQueries({ queryKey: ["/api/v1/auth/me/"] })
      setFile(null)
      setPreview("")
    },
    onError: (e) =>
      toast.error(e instanceof Error && e.message ? e.message : "تعذّر التحديث"),
  })

  const shownLogo = preview || currentLogo
  const shownName = name.trim() || currentName

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingsCard icon={Store} title="هوية المتجر" hint="الشعار والاسم الظاهران للزبائن على الفاتورة وصفحة الأسعار.">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted transition hover:border-primary/50"
            aria-label="اختر شعاراً"
          >
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="" className="size-full object-contain" />
            ) : (
              <BrandMark className="size-10 opacity-60" />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <ImagePlus className="size-5" />
            </span>
          </button>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> {shownLogo ? "تغيير الشعار" : "اختر شعاراً"}
            </Button>
            <span className="max-w-[14rem] truncate text-[11px] text-muted-foreground" dir={file ? "ltr" : undefined}>
              {file ? file.name : "صورة مربعة بخلفية شفافة تظهر أوضح"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="brand-name">اسم المتجر</Label>
          <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={currentName} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <span className="text-[11px] text-muted-foreground">{canSave ? "لديك تغييرات لم تُحفظ" : "كل شيء محفوظ"}</span>
          <Button className="bg-brand-gradient gap-1.5" onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            حفظ
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard icon={ReceiptText} title="هكذا تظهر على الفاتورة" hint="معاينة — تتغير وأنت تكتب.">
        <div className="mx-auto w-full max-w-[280px] rounded-xl border border-dashed bg-white p-4 text-center font-mono text-[11px] text-neutral-800 shadow-sm">
          <div className="mx-auto mb-2 grid size-12 place-items-center overflow-hidden">
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="" className="size-full object-contain grayscale" />
            ) : (
              <BrandMark className="size-9 opacity-70" />
            )}
          </div>
          <p className="font-sans text-sm font-bold">{shownName}</p>
          <p className="mt-0.5 text-neutral-500">فاتورة #1042 · 4/10 ‏9:41</p>
          <div className="my-2 border-t border-dashed border-neutral-300" />
          <div className="space-y-1 text-start">
            <p className="flex justify-between"><span>سبانش لاتيه</span><span>20.00</span></p>
            <p className="flex justify-between"><span>تشيز كيك</span><span>22.00</span></p>
          </div>
          <div className="my-2 border-t border-dashed border-neutral-300" />
          <p className="flex justify-between font-bold"><span>المجموع</span><span>42.00 ₪</span></p>
          <div
            aria-hidden
            className="mx-auto mt-3 h-7 w-40"
            style={{ background: "repeating-linear-gradient(90deg,#222 0 2px,transparent 2px 4px,#222 4px 5px,transparent 5px 8px)" }}
          />
        </div>
      </SettingsCard>
    </div>
  )
}
