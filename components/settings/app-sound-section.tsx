"use client"
/* The sound the shop's CUSTOMERS hear in the app when their order moves
   (accepted, ready…). Owner only; every customer phone follows it. */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Music } from "lucide-react"
import { toast } from "sonner"

import { APP_SOUND_LABEL, getAppSettings, playAppSound, saveAppSettings, type AppSound } from "@/api/app-settings"
import { Choice, SettingRow, SettingsCard } from "@/components/settings/kit"
import { Switch } from "@/components/ui/switch"

export function AppSoundSection() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["app-settings"], queryFn: async () => (await getAppSettings()).data })
  const sounds = (q.data?.sounds ?? ["coop", "chime", "bell", "off"]) as AppSound[]
  return (
    <SettingsCard icon={Music} title="تطبيق الزبون: الصوت والحركة" hint="يسمعه الزبون على جواله لما يتغيّر حال طلبه (مقبول، جاهز…).">
      <Choice
        className="self-start"
        value={q.data?.sound}
        onChange={async (v) => {
          playAppSound(v)
          try {
            const r = await saveAppSettings({ sound: v })
            qc.setQueryData(["app-settings"], r.data)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "ما انحفظ")
          }
        }}
        options={sounds.map((s) => ({ value: s, label: APP_SOUND_LABEL[s] ?? s }))}
      />
      <div className="mt-4">
        <SettingRow
          title="حركة صبّ الكوب عند فتح التطبيق"
          hint="تشتغل كل مرة يفتح فيها الزبون التطبيق. كل زبون يقدر يطفيها من حسابه، وأنت تقدر تطفيها للكل من هون."
        >
          <Switch
            checked={q.data?.pour ?? true}
            disabled={!q.data}
            aria-label="حركة صبّ الكوب"
            onCheckedChange={async (v) => {
              try {
                const r = await saveAppSettings({ pour: Boolean(v) })
                qc.setQueryData(["app-settings"], r.data)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "ما انحفظ")
              }
            }}
          />
        </SettingRow>
      </div>
    </SettingsCard>
  )
}
