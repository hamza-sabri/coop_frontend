"use client"

import { useEffect, useState } from "react"
import { Printer, ReceiptText } from "lucide-react"

import { PrintAgentCard } from "@/components/print/print-agent-card"
import { Choice, SettingRow, SettingsCard } from "@/components/settings/kit"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_PRINT_SETTINGS,
  loadPrintSettings,
  savePrintSettings,
  type PaperWidth,
  type PrintSettings,
} from "@/lib/print/settings"
import { cn } from "@/lib/utils"

/**
 * Printing, on the settings page — two cards side by side:
 *
 *   الفاتورة            what a receipt looks like and when it prints
 *   الطباعة المباشرة    the small program that prints without a dialog
 *
 * These controls also live in the dialog behind the POS's printer icon, but
 * that dialog is only reachable from the till — the owner setting the shop up
 * on his own laptop needs them here. Settings are per browser (each counter
 * has its own printer and its own roll) and save the moment they change.
 */
export function PrintSection() {
  const [s, setS] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [ready, setReady] = useState(false)

  // localStorage is not available while the page is server-rendered; reading
  // it after mount keeps the first paint identical on both sides.
  useEffect(() => {
    setS(loadPrintSettings())
    setReady(true)
  }, [])

  function patch(p: Partial<PrintSettings>) {
    setS((prev) => {
      const next = { ...prev, ...p }
      savePrintSettings(next)
      return next
    })
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingsCard icon={ReceiptText} title="الفاتورة" hint="تُحفظ التغييرات فوراً، لهذا الجهاز فقط.">
        <div className={cn(!ready && "opacity-60")}>
          <SettingRow title="عند الطباعة" hint="إن لم تكن هناك طابعة، تُنزَّل الفاتورة كملف.">
            <Choice
              value={s.deliver}
              onChange={(v) => patch({ deliver: v })}
              options={[
                { value: "print", label: "أطبع على الطابعة" },
                { value: "download", label: "نزّل الفاتورة (لا توجد طابعة)" },
              ]}
            />
          </SettingRow>
          <SettingRow title="مقاس الورق" hint="قِس عرض بكرة الورق — المقاس الخاطئ يقصّ حواف الفاتورة.">
            <Choice<PaperWidth>
              value={s.paper}
              onChange={(v) => patch({ paper: v })}
              options={[
                { value: "58", label: "58 مم" },
                { value: "80", label: "80 مم" },
              ]}
            />
          </SettingRow>
          <SettingRow title="طباعة تلقائية بعد كل بيع" hint="بدونها تُطبع الفاتورة عند الضغط على زر الطابعة فقط.">
            <Switch checked={s.autoPrint} onCheckedChange={(v) => patch({ autoPrint: Boolean(v) })} aria-label="طباعة تلقائية" />
          </SettingRow>
          <SettingRow title="باركود أسفل الفاتورة" hint="امسحه في صفحة الفواتير لتفتح الفاتورة مباشرة.">
            <Switch checked={s.receiptBarcode} onCheckedChange={(v) => patch({ receiptBarcode: Boolean(v) })} aria-label="باركود الفاتورة" />
          </SettingRow>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Printer}
        title="الطباعة المباشرة (بدون نافذة طباعة)"
        hint="برنامج صغير على جهاز الكاشير يطبع فوراً دون أن يفتح المتصفح نافذة الطباعة. لا يثبّت أي تعريف."
      >
        <PrintAgentCard embedded />
      </SettingsCard>
    </div>
  )
}
