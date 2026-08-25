"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** A centered, scrollable modal with a branded header + sticky footer. */
export function FormModal({
  open,
  onOpenChange,
  title,
  icon,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) {
  /* Enter saves, from any field in the dialog.
     These forms hang their save off `onClick={handleSubmit(...)}` rather than
     a real submit button, so the browser's own "Enter submits the form" never
     applied and every save needed a trip to the mouse. Rather than rewrite
     each form, the modal presses its own primary button — which is the same
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl"
      >
        <DialogHeader className="bg-brand-soft relative overflow-hidden border-b border-border/70 px-6 py-4.5 text-start">
          <div
            aria-hidden="true"
            className="bg-brand-gradient pointer-events-none absolute -end-10 -top-12 size-28 rounded-full opacity-15"
          />
          <DialogTitle className="flex items-center gap-2.5">
            {icon && (
              <span className="icon-chip bg-brand-gradient size-10">{icon}</span>
            )}
            <span className="font-heading text-lg">{title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4.5 overflow-y-auto px-6 py-5">
          {children}
        </div>
        <div className="flex flex-row gap-2.5 border-t border-border/70 bg-muted/30 px-6 py-4">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}
