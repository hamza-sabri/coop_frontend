"use client"

import { useEffect, useRef, useState } from "react"
import { ImageUp, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import {
  FONT_SCALE,
  loadPrintSettings,
  savePrintSettings,
  type FontSize,
  type PaperWidth,
  type PrintSettings,
} from "@/lib/print/settings"
import { deliverAndToast } from "@/lib/print/deliver"
import { DOTS } from "@/lib/print/escpos"
import { loadReceiptLogo, renderReceiptCanvas } from "@/lib/print/receipt-canvas"
import type { ReceiptData } from "@/lib/print/receipt"
import { PrintAgentCard } from "@/components/print/print-agent-card"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/* The receipt the preview and the test print both use, so what the owner sees
   on screen is what comes out of the printer. */
const SAMPLE: ReceiptData = {
  saleId: "TEST",
  receiptCode: "261015000123",
  items: [
    { name: "لاتيه — كبير", quantity: 2, unitPrice: "14.00", note: "بدون سكر" },
    { name: "امريكانو", quantity: 1, unitPrice: "9.00" },
    { name: "كيك جزر", quantity: 1, unitPrice: "12.00" },
  ],
  total: 49,
  discountedTotal: 45,
  beansSpent: 40,
  beansValue: 4,
  paymentMethod: "cash",
  customerName: "ليان",
  cashierName: "تجربة",
  note: "تيك أواي",
  createdAt: new Date(),
}

/** The receipt as the printer will draw it, redrawn whenever a setting changes. */
function ReceiptPreview({ s, storeName, logoUrl }: { s: PrintSettings; storeName: string; logoUrl: string }) {
  const [src, setSrc] = useState("")
  const [h, setH] = useState(0)
  useEffect(() => {
    let alive = true
    void (async () => {
      const logo = s.printLogo ? await loadReceiptLogo(s.logoDataUrl || logoUrl) : null
      if (!alive) return
      try {
        const c = renderReceiptCanvas(SAMPLE, {
          width: DOTS[s.paper === "58" ? "58" : "80"],
          storeName,
          phone: s.phone || undefined,
          address: s.address || undefined,
          barcode: s.receiptBarcode,
          scale: FONT_SCALE[s.fontSize] || 1,
          logo,
        })
        setSrc(c.toDataURL("image/png"))
        setH(c.height / c.width)
      } catch {
        setSrc("")
      }
    })()
    return () => { alive = false }
  }, [s.paper, s.fontSize, s.printLogo, s.logoDataUrl, s.phone, s.address, s.receiptBarcode, storeName, logoUrl])
  // Shown at the roll's real width on screen: 58 mm ≈ 220px, 80 mm ≈ 302px.
  const w = s.paper === "58" ? 220 : 302
  return (
    <div className="flex justify-center rounded-2xl bg-muted/50 p-4">
      <div className="overflow-hidden rounded-sm bg-white shadow-[0_8px_24px_-10px_rgba(0,0,0,.45)]" style={{ width: w, minHeight: h ? w * h : 320 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="معاينة الفاتورة" className="block w-full" />
        ) : (
          <div className="grid h-80 place-items-center text-xs text-muted-foreground">جارٍ الرسم…</div>
        )}
      </div>
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })
}

export function PrintSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { user } = useMe()
  // The generated User type is stale; /me/ also returns these tenant fields.
  const me = user as
    | {
        pharmacy_name?: string
        pharmacy_phone?: string
        pharmacy_address?: string
        pharmacy_logo?: string
      }
    | undefined
  // Header name + logo come from the account (backend); the fallback is
  // the deployment brand.
  const pharmacyName = me?.pharmacy_name?.trim() || "فارما"
  const pharmacyLogo = me?.pharmacy_logo || ""
  const [s, setS] = useState<PrintSettings>(loadPrintSettings)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-read stored settings each time the dialog opens, prefilling phone/address
  // from the tenant record so a fresh counter isn't empty.
  useEffect(() => {
    if (!open) return
    const stored = loadPrintSettings()
    setS({
      ...stored,
      phone: stored.phone || me?.pharmacy_phone || "",
      address: stored.address || me?.pharmacy_address || "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function patch(p: Partial<PrintSettings>) {
    setS((prev) => ({ ...prev, ...p }))
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة")
      return
    }
    if (file.size > 400_000) {
      toast.error("الشعار كبير — استخدم صورة أصغر من 400KB")
      return
    }
    try {
      patch({ logoDataUrl: await fileToDataUrl(file) })
    } catch {
      toast.error("تعذّر قراءة الصورة")
    }
  }

  function save() {
    savePrintSettings(s)
    toast.success("تم حفظ إعدادات الطباعة")
    onOpenChange(false)
  }

  function testPrint() {
    // Persist first so the test reflects what the cashier just changed.
    savePrintSettings(s)
    void deliverAndToast(
      SAMPLE,
      pharmacyName,
      s,
      pharmacyLogo,
      "فاتورة تجريبية",
    )
  }

  const segBtn = (active: boolean) =>
    cn(
      "flex-1 rounded-lg py-2 text-sm font-semibold transition",
      active ? "bg-ink text-white shadow-sm" : "bg-muted text-muted-foreground",
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>إعدادات الطباعة</DialogTitle>
          <DialogDescription>
            تُحفظ لكل جهاز — اضبط مقاس الورق وحجم الخط والشعار، والمعاينة تتغير معك.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_minmax(0,340px)]">
        <div className="space-y-4 min-w-0">
          {/* Logo slot */}
          <div className="space-y-1.5">
            <Label>الشعار</Label>
            <div className="flex items-center gap-3">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/40">
                {s.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoDataUrl} alt="" className="size-full object-contain" />
                ) : (
                  <span className="px-1 text-center font-heading text-sm font-bold text-primary">
                    {pharmacyName.slice(0, 10)}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageUp className="size-4" />
                  {s.logoDataUrl ? "تغيير" : "رفع شعار"}
                </Button>
                {s.logoDataUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => patch({ logoDataUrl: "" })}
                  >
                    <Trash2 className="size-4" />
                    إزالة
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickLogo}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              يُطبع بالأبيض والأسود على الورق الحراري — شعار بسيط وداكن يخرج أوضح. PNG بخلفية شفافة أفضل نتيجة.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-phone">الهاتف</Label>
              <Input
                id="ps-phone"
                dir="ltr"
                className="text-start"
                value={s.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="09-..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-addr">العنوان</Label>
              <Input
                id="ps-addr"
                value={s.address}
                onChange={(e) => patch({ address: e.target.value })}
                placeholder="قلقيلية"
              />
            </div>
          </div>

          <PrintAgentCard />

          {/* Where a receipt goes */}
          <div className="space-y-1.5">
            <Label>عند الطباعة</Label>
            <div className="flex gap-2">
              {(
                [
                  ["print", "أطبع على الطابعة"],
                  ["download", "نزّل الفاتورة (لا توجد طابعة)"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => patch({ deliver: v })}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    s.deliver === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              المتصفح لا يستطيع معرفة إن كانت هناك طابعة موصولة. إن لم تكن هناك
              طابعة على هذا الجهاز، اختر «نزّل الفاتورة» ولن تظهر نافذة الطباعة
              أبداً.
            </p>
          </div>

          {/* Paper width */}
          <div className="space-y-1.5">
            <Label>مقاس الورق</Label>
            <div className="flex gap-2">
              {(["58", "80"] as PaperWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={segBtn(s.paper === w)}
                  onClick={() => patch({ paper: w })}
                >
                  {w} ملم
                </button>
              ))}
            </div>
          </div>

          {/* Letter size */}
          <div className="space-y-1.5">
            <Label>حجم الخط</Label>
            <div className="flex gap-2">
              {(
                [
                  ["s", "صغير"],
                  ["m", "عادي"],
                  ["l", "كبير"],
                ] as [FontSize, string][]
              ).map(([v, label]) => (
                <button key={v} type="button" className={segBtn(s.fontSize === v)} onClick={() => patch({ fontSize: v })}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">الكبير أسهل قراءة للزبون، لكنه يستهلك ورقاً أكثر.</p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-2.5">
            <span className="text-sm font-medium">طباعة الشعار أعلى الفاتورة</span>
            <Switch checked={s.printLogo} onCheckedChange={(v) => patch({ printLogo: Boolean(v) })} />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-2.5">
            <span className="text-sm font-medium">طباعة الفاتورة تلقائياً بعد كل بيع</span>
            <Switch
              checked={s.autoPrint}
              onCheckedChange={(v) => patch({ autoPrint: Boolean(v) })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-2.5">
            <span className="text-sm font-medium">باركود رقم الفاتورة أسفل الإيصال</span>
            <Switch
              checked={s.receiptBarcode}
              onCheckedChange={(v) => patch({ receiptBarcode: Boolean(v) })}
            />
          </label>
        </div>

        <div className="md:sticky md:top-0 md:self-start">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">معاينة — هكذا تخرج من الطابعة</p>
          <ReceiptPreview s={s} storeName={pharmacyName} logoUrl={pharmacyLogo} />
        </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={testPrint}>
            <Printer className="size-4" />
            طباعة تجريبية
          </Button>
          <Button type="button" onClick={save}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
