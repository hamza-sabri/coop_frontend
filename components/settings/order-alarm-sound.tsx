"use client"
/* The new-order alarm, per device: on or muted, and a button to hear it.
   Separate from the till's scan beep — silencing the scanner must never
   silence orders. */
import { useEffect, useState } from "react"
import { Bell, BellOff, Play } from "lucide-react"
import { toast } from "sonner"

import { Choice } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { ALARM_SOUNDS, alarmMuted, alarmSound, setAlarmMuted, setAlarmSound, testAlarm, type AlarmSound } from "@/lib/order-alarm"

export function OrderAlarmSound({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(false)
  const [sound, setSoundState] = useState<AlarmSound>("announce")
  useEffect(() => {
    setMutedState(alarmMuted())
    setSoundState(alarmSound())
  }, [])
  const test = () =>
    void testAlarm().then((ok) => {
      if (!ok) toast.warning("المتصفح منع الصوت — اضغط على الصفحة ثم جرّب")
    })
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Choice
          value={muted ? "off" : "on"}
          onChange={(v) => {
            const off = v === "off"
            setAlarmMuted(off)
            setMutedState(off)
            if (!off) test()
          }}
          options={[
            { value: "on", label: "يرن", icon: Bell },
            { value: "off", label: "مكتوم", icon: BellOff },
          ]}
        />
        <Button type="button" size="sm" variant="secondary" onClick={test}>
          <Play className="size-3.5" />
          جرّب
        </Button>
      </div>
      {/* The ringtone: tap one to hear it and keep it. */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="نغمة الجرس">
        {ALARM_SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={sound === s.id}
            onClick={() => {
              setAlarmSound(s.id)
              setSoundState(s.id)
              test()
            }}
            className={
              "rounded-xl border px-3 py-1.5 text-xs font-semibold transition " +
              (sound === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
