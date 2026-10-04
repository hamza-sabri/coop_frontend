"use client"
/* The till's beep, moved out of the POS header.

   It was a speaker icon sitting between the print button and the view switch,
   which meant a cashier could silence the till with one stray tap and never
   know why scans had gone quiet. Sound is a preference, so it belongs with the
   preferences — and switching it on here plays the beep, because the only way
   to choose a sound is to hear it. */
import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

import { Choice } from "@/components/settings/kit"
import { isMuted, playBeep, setMuted } from "@/lib/beep"

export function TillSound({ className }: { className?: string }) {
  // Read on mount, not during render: localStorage does not exist on the
  // server and a mismatch here would hydrate the wrong state.
  const [muted, setMutedState] = useState(false)
  useEffect(() => setMutedState(isMuted()), [])

  return (
    <Choice
      className={className}
      value={muted ? "off" : "on"}
      onChange={(v) => {
        const off = v === "off"
        setMuted(off)
        setMutedState(off)
        if (!off) playBeep(true) // hear what you just switched on
      }}
      options={[
        { value: "on", label: "مسموع", icon: Volume2 },
        { value: "off", label: "صامت", icon: VolumeX },
      ]}
    />
  )
}
