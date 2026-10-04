"use client"

import { ScanBarcode } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { setScannerEnabled, useScannerEnabled } from "@/lib/scanner-pref"

/** The camera barcode scanner, per device, off by default. See lib/scanner-pref.ts. */
export function ScannerSection() {
  const on = useScannerEnabled()
  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ScanBarcode className="size-4.5" />
          </span>
          <div>
            <h2 className="mb-1 font-heading text-base font-bold">ماسح الباركود بالكاميرا</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              مطفأ افتراضياً: المشروبات تُختار من صورها. شغّله على هذا الجهاز فقط إذا كنت تبيع أصنافاً عليها باركود.
            </p>
          </div>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(v) => setScannerEnabled(Boolean(v))}
          aria-label="تشغيل ماسح الباركود بالكاميرا"
        />
      </div>
    </section>
  )
}
