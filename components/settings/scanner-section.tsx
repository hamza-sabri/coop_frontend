"use client"

import { ScanBarcode } from "lucide-react"

import { Choice, SettingsCard } from "@/components/settings/kit"
import { setScannerEnabled, useScannerEnabled } from "@/lib/scanner-pref"

/** The camera barcode scanner, per device, off by default. See lib/scanner-pref.ts. */
export function ScannerSection() {
  const on = useScannerEnabled()
  return (
    <SettingsCard
      icon={ScanBarcode}
      title="ماسح الباركود بالكاميرا"
      hint="المشروبات تُختار من صورها. شغّله فقط إن كنت تبيع أصنافاً عليها باركود."
    >
      <Choice
        className="mt-auto self-start"
        value={on ? "on" : "off"}
        onChange={(v) => setScannerEnabled(v === "on")}
        options={[
          { value: "off", label: "مطفأ" },
          { value: "on", label: "مشغّل" },
        ]}
      />
    </SettingsCard>
  )
}
