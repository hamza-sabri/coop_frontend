"use client"

/* ==========================================================================
   Pick the customer with a tap, not a search.

   At a till the person is standing in front of you and you already know them —
   typing their name is slower than pointing at their face. So the regulars sit
   here as avatars, and the search box below stays for everyone else.

   Ordered by points: the people with the most are the ones who come most often,
   which is exactly who is most likely to be at the counter right now.
   ========================================================================== */
import { useMemo } from "react"
import { X } from "lucide-react"

import { useCustomersCatalog } from "@/hooks/use-customers-catalog"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export type PickedCustomer = { id: number; name: string }

const SHOWN = 12


/* A face for everyone. Walk-ins have no photo, and a row of identical grey
   initials is no easier to scan than a row of identical grey blanks — so the
   initial gets a colour derived from the name itself. Same name, same colour,
   every session, without storing anything. Hues are sampled from the app's
   own palette rather than the whole wheel, so the row still looks like كوب. */
const AVATAR_TONES = [
  "bg-primary/20 text-primary",
  "bg-lime/25 text-lime-foreground",
  "bg-ink/15 text-ink",
  "bg-warning/25 text-warning-foreground",
  "bg-destructive/15 text-destructive",
  "bg-accent/30 text-accent-foreground",
]
function toneFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}
/* Points are a badge, not a figure to read: past three digits it stops being
   a number and starts being a shape that breaks the circle. */
function shortPoints(n: number) {
  if (n < 1000) return String(n)
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return Math.round(n / 1000) + "k"
}

export function CustomerChips({
  value,
  onPick,
}: {
  value: number | null
  onPick: (c: PickedCustomer | null) => void
}) {
  const { customers } = useCustomersCatalog()

  const top = useMemo(() => {
    if (!customers?.length) return []
    // Already ranked by the catalogue hook: app customers, then by points.
    const sorted = customers
    // Whoever is selected is always shown, even if they are not a regular —
    // otherwise picking someone from search makes the chip row look unrelated.
    const picked = value != null ? customers.find((c) => c.id === value) : undefined
    const head = sorted.slice(0, SHOWN)
    if (picked && !head.some((c) => c.id === picked.id)) head.unshift(picked)
    return head.slice(0, SHOWN)
  }, [customers, value])

  if (!top.length) return null

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {value != null && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 outline-none"
          aria-label="بدون زبون"
        >
          <span className="grid size-12 place-items-center rounded-full border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-destructive hover:text-destructive">
            <X className="size-4" />
          </span>
          <span className="line-clamp-1 text-[10px] text-muted-foreground">بدون</span>
        </button>
      )}

      {top.map((c) => {
        const on = value === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(on ? null : { id: c.id, name: c.name })}
            aria-pressed={on}
            className="group flex w-[64px] shrink-0 flex-col items-center gap-1.5 outline-none"
          >
            <span
              className={cn(
                "relative rounded-full p-[2px] transition-all",
                on ? "bg-brand-gradient" : "bg-transparent",
              )}
            >
              <Avatar
                className={cn(
                  "size-12 transition-transform",
                  on ? "ring-2 ring-card" : "group-hover:-translate-y-0.5",
                )}
              >
                <AvatarImage src={c.avatar || undefined} alt="" />
                <AvatarFallback className={cn("text-sm font-bold", toneFor(c.name))}>
                  {c.name.trim().charAt(0)}
                </AvatarFallback>
              </Avatar>
              {(c.beans ?? 0) > 0 && (
                <span className="absolute -bottom-0.5 -end-1 rounded-full bg-lime px-1.5 text-[9px] font-bold leading-[15px] text-lime-foreground tabular-nums">
                  {shortPoints(c.beans ?? 0)}
                </span>
              )}
            </span>
            <span
              className={cn(
                "line-clamp-1 text-[10px] transition-colors",
                on ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {c.name.split(" ")[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
