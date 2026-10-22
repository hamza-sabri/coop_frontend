"use client"
/* The new-order alarm, per device: on or muted, and a button to hear it.
   Separate from the till's scan beep — silencing the scanner must never
   silence orders. */
import { useEffect, useState } from "react"
import { Bell, BellOff, Play } from "lucide-react"
import { toast } from "sonner"

import { Choice } from "@/components/settings/kit"
import { Button } from "@/components/ui/button"
import { alarmMuted, setAlarmMuted, testAlarm } from "@/lib/order-alarm"

export function OrderAlarmSound({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(false)
  useEffect(() => setMutedState(alarmMuted()), [])
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
    </div>
  )
}
