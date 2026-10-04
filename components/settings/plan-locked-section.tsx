"use client"

import { Check, Lock } from "lucide-react"

import { useLockedFeature } from "@/components/locked-feature"
import { Button } from "@/components/ui/button"

/**
 * A settings tab that exists in the product but is not on this store's plan.
 *
 * Deliberately shown rather than hidden: hiding it makes the app look thinner
 * than it is and leaves the owner unaware the capability exists. Shown as
 * what it would do for him, in his words, with one quiet way to ask about it —
 * never a nag elsewhere in the app.
 */
export function PlanLockedSection({
  title,
  description,
  benefits = [],
  featureLabel,
}: {
  title: string
  description: string
  /** What it would do for him — two to four short lines. */
  benefits?: string[]
  /** What the dialog names when it explains the lock. Defaults to `title`. */
  featureLabel?: string
}) {
  const { openPlanLocked } = useLockedFeature()
  return (
    <section className="grid gap-6 overflow-hidden rounded-2xl border border-border/80 bg-card p-6 animate-in fade-in slide-in-from-bottom-2 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          <Lock className="size-3" />
          ليست ضمن باقتك الحالية
        </span>
        <h2 className="mt-3 font-heading text-lg font-bold">{title}</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        {benefits.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button variant="outline" className="justify-self-start md:justify-self-end" onClick={() => openPlanLocked(featureLabel ?? title)}>
        كيف أحصل عليها؟
      </Button>
    </section>
  )
}
