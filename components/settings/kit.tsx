"use client"

/* The parts every settings tab is built from (DESIGN.md §1, §6):
 *
 *   SettingsCard — a titled card; tabs lay two or three of them side by side
 *   SettingRow   — "what it is · what it does" on one side, the control on the other
 *   Choice       — two or three words to pick from, the picked one filled
 *
 * Every control saves the moment it changes unless the card says otherwise. */
import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SettingsCard({
  icon: Icon,
  title,
  hint,
  action,
  children,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col rounded-2xl border border-border/80 bg-card p-5", className)}>
      <header className="mb-4 flex items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-[18px]" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[15px] font-bold leading-tight">{title}</h2>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function SettingRow({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/70 py-3.5 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Choice<V extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: V; label: ReactNode; icon?: ComponentType<{ className?: string }> }[]
  value: V | undefined
  onChange: (v: V) => void
  className?: string
}) {
  return (
    <div className={cn("inline-flex rounded-xl border border-border bg-muted/40 p-0.5", className)} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition-all",
              on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon ? <o.icon className="size-3.5" /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
