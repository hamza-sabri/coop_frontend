"use client"

import { useEffect, useRef, useState } from "react"
import { Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Fixed-amount lines — phone credit, gift cards, deposits, top-ups.
 *
 * Things a shop sells at a handful of set prices under one name, with no stock
 * to decrement and no barcode to scan. They are rung as FREE-TEXT lines (a
 * name and a price, no catalogue product): inventing a catalogue row for every
 * possible amount would be worse, and the sale records them exactly like any
 * other line, so they appear on the receipt, in the totals and in the reports.
 *
 * Tapping a name adds NOTHING. It only opens the amounts, and the line is
 * created once an amount is chosen. An earlier version sold the first amount
 * on the first tap to save a keystroke — it put a phantom line on the receipt
 * every time the cashier actually wanted a different amount, which is money
 * out of the till.
 *
 * Configure these for the shop. The defaults are deliberately generic: a
 * template cannot know which carrier, currency or denominations a given
 * country uses, and a wrong guess here is a wrong number on a receipt.
 */

/** What the shop sells this way. One entry per name the cashier taps. */
export const TOPUP_NETWORKS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "topup", label: "شحن رصيد" },
]

/** The denominations offered. First is the common sale — a default POSITION,
 *  never a default charge: nothing is added until one is pressed. */
export const TOPUP_AMOUNTS: ReadonlyArray<number> = [10, 20, 30, 50, 100]

/** The name that lands on the receipt. */
export function topupName(label: string): string {
  return label
}

export function TopupButtons({
  onAdd,
}: {
  /** name shown on the receipt, and the amount charged */
  onAdd: (name: string, amount: number) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // A picker left hanging open over the till is its own hazard: the next
  // barcode lands behind a floating panel and the cashier taps an amount they
  // never meant to. Anything outside it, or Escape, closes it.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
    }
    document.addEventListener("pointerdown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("pointerdown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-1.5">
      {TOPUP_NETWORKS.map((n) => {
        const isOpen = open === n.key
        return (
          <div key={n.key} className="relative">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : n.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              title={`تعبئة كرت ${n.label} — اختر المبلغ`}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
                isOpen
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Smartphone className="size-4" />
              {n.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={`مبلغ تعبئة ${n.label}`}
                className="animate-in fade-in zoom-in-95 absolute top-full start-0 z-20 mt-1 flex gap-1 rounded-xl border bg-card p-1 shadow-lg duration-100"
              >
                {TOPUP_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd(topupName(n.label), amt)
                      setOpen(null)
                    }}
                    className="min-w-10 rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums transition hover:bg-primary/10 hover:text-primary"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
