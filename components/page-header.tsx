"use client"

/* The page title, moved OUT of the page.

   Every screen used to open with a title block: a gradient bar, an h1, a
   subtitle, and air around all three. On a desktop that reads as design. On
   the 10" touchscreen this actually runs on it is a hundred wasted pixels
   above the only thing anyone came to touch — and the top bar directly above
   it was sitting empty.

   So PageHeader no longer renders where it is written. Each page still calls
   it exactly as before, and it TELEPORTS its content into the slot the top bar
   exposes. A React portal rather than passing the title up through context or
   layout props, because a portal keeps the node in the page's own React tree:
   an `action` button can still close over that page's state, open that page's
   dialog and read that page's hooks, while its DOM lands in the top bar.

   One row instead of two, on every screen. */

import { createContext, useContext, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

const SlotContext = createContext<{
  node: HTMLElement | null
  setNode: (el: HTMLElement | null) => void
}>({ node: null, setNode: () => {} })

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  return (
    <SlotContext.Provider value={{ node, setNode }}>
      {children}
    </SlotContext.Provider>
  )
}

/** Where the title lands. Rendered once, by the top bar. */
export function PageHeaderSlot({ className }: { className?: string }) {
  const { setNode } = useContext(SlotContext)
  return <div ref={setNode} className={className} />
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  const { node } = useContext(SlotContext)

  const content = (
    <div className="flex w-full min-w-0 items-center gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate font-heading text-lg font-bold tracking-tight md:text-xl">
          {title}
        </h1>
        {/* The subtitle is nearly always a count — «45 صنف», «2 زبون». Worth a
            glance, never worth its own line, and first to go when the screen
            is narrow. */}
        {description && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="ms-auto flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  )

  // Before the slot has mounted there is nowhere to put it. Rendering it in
  // place for that one frame would push the whole page down and then snap it
  // back, which is worse than a frame without a title.
  if (!node) return null
  return createPortal(content, node)
}
