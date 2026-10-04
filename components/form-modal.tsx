"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * The app's form shell: a side drawer with a branded header and a pinned
 * footer. Ported from al-rahmah, where the same swap was made for the same
 * reason.
 *
 * It was a centred modal, and every form in the product went through it, so
 * "edit a drink" blacked out the menu you found the drink in. That is wrong
 * for the work these forms do — correcting a price you are comparing against
 * its neighbours. The thing you are working FROM has to stay on screen.
 *
 * The rule the app now follows: an OBJECT opens in a drawer (a drink, a
 * customer, an invoice); a DECISION stays a small dialog (confirm a delete,
 * pick a printer). Drawers stack; dialogs interrupt.
 *
 * Enters from the left: the app is RTL and the navigation rail is on the
 * right, so a panel arriving over it would cover the way out.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
  /** `lg` for a two-column form or one carrying a table; `xl` for a table
   *  that needs room to read. */
  size?: "md" | "lg" | "xl"
}) {
  /* Enter saves, from any field in the drawer.
     These forms hang their save off `onClick={handleSubmit(...)}` rather than
     a real submit button, so the browser's own "Enter submits the form" never
     applied and every save needed a trip to the mouse. Rather than rewrite
     each form, the shell presses its own primary button — which is the same
     thing the cashier would have done, and keeps one rule in one place.

     Excluded: a textarea (Enter is a newline there), Enter with a modifier,
     and any element that handles Enter itself — a combobox mid-selection, or
     a button that already has focus. */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
    const el = e.target as HTMLElement | null
    const tag = el?.tagName
    if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return
    if (el?.isContentEditable || el?.getAttribute("role") === "combobox") return
    if (el?.closest("[role='listbox'],[role='menu'],[cmdk-root]")) return
    const primary = e.currentTarget.querySelector<HTMLButtonElement>(
      "[data-form-primary]:not(:disabled)",
    )
    if (!primary) return
    e.preventDefault()
    primary.click()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        size={size}
        className="gap-0 p-0"
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
      >
        <SheetHeader className="bg-brand-soft relative shrink-0 overflow-hidden border-b border-border/70 px-6 py-4.5 pe-14 text-start">
          <div
            aria-hidden="true"
            className="bg-brand-gradient pointer-events-none absolute -end-10 -top-12 size-28 rounded-full opacity-15"
          />
          <SheetTitle className="flex items-center gap-2.5">
            {icon && (
              <span className="icon-chip bg-brand-gradient size-10">{icon}</span>
            )}
            <span className="font-heading text-lg">{title}</span>
          </SheetTitle>
        </SheetHeader>
        {/* min-h-0: without it a long form pushes the footer off the bottom of
            the panel and the save button becomes unreachable. */}
        <div className="min-h-0 flex-1 space-y-4.5 overflow-y-auto px-6 py-5">
          {children}
        </div>
        <div className="flex shrink-0 flex-row gap-2.5 border-t border-border/70 bg-muted/30 px-6 py-4">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  )
}
