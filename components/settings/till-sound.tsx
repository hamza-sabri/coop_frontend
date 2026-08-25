"use client"
/* The till's beep, moved out of the POS header.

   It was a speaker icon sitting between the print button and the view switch,
   which meant a cashier could silence the till with one stray tap and never
   know why scans had gone quiet. Sound is a preference, so it belongs with the
   preferences — and toggling it here plays the beep, because the only way to
   choose a sound is to hear it. */
import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

import { cn } from "@/lib/utils"
import { isMuted, setMuted, playBeep } from "@/lib/beep"

export function TillSound() {
  // Read on mount, not during render: localStorage does not exist on the
  // server and a mismatch here would hydrate the wrong state.
  const [muted, setMutedState] = useState(false)
  useEffect(() => setMutedState(isMuted()), [])

  return (
    <div className="flex items-center gap-2">
      {(
        [
          { on: false, label: "مفعّل", icon: Volume2 },
          { on: true, label: "مكتوم", icon: VolumeX },
        ] as const
      ).map((o) => (
        <button
          key={String(o.on)}
          type="button"
          aria-pressed={muted === o.on}
          onClick={() => {
            setMuted(o.on)
            setMutedState(o.on)
            if (!o.on) playBeep(true)   // hear what you just switched on
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
            muted === o.on
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <o.icon className="size-4" />
          {o.label}
        </button>
      ))}
    </div>
  )
}
