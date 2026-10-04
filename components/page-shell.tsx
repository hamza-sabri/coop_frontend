"use client"

/* One page frame for every screen: the same width, the same gaps, the same
 * entrance — so moving between pages never feels like moving between apps.
 * The title and main action go to the top bar via PageHeader (see DESIGN.md
 * §7); the page body is a stack of sections that arrive one after another. */
import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

export function PageShell({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-4 pb-24 md:pb-10", className)}>
      <PageHeader title={title} action={action} />
      {children}
    </div>
  )
}

/** A section that fades up into place; `i` staggers siblings. */
export function Enter({ i = 0, className, children }: { i?: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500", className)}
      style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
    >
      {children}
    </div>
  )
}
