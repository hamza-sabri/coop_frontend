"use client"

/* The page title, deleted. Its actions, moved.

   First attempt moved the heading block into the top bar — one row instead of
   three, which was better and still wrong. The title itself was the waste. The
   sidebar already lights up the page you are on, and nobody standing at a
   till needs a screen to tell them it is the till. So the h1 and its subtitle
   are gone from the layout entirely; the page name lives in the browser tab,
   where it costs nothing.

   What is left of PageHeader is the teleport for a page's ACTIONS. A React
   portal rather than passing them up through context or layout props, because
   a portal keeps the node in the page's own React tree: a button can still
   close over that page's state, open that page's dialog and read that page's
   hooks, while its DOM lands in the top bar.

   Pages still call it with a title. Deleting the prop would have been the
   tidier diff and the worse decision — it names the tab, and it is the one
   place a page declares what it is. */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
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
  action,
  quiet = false,
}: {
  title: string
  /** Accepted and ignored — it was the subtitle, and the subtitle is gone.
   *  Left in the type so a dozen pages do not need editing to say nothing. */
  description?: string
  action?: ReactNode
  /** The till: no title, only the actions. Every pixel there is a drink. */
  quiet?: boolean
}) {
  const { node } = useContext(SlotContext)

  useEffect(() => {
    document.title = `${title} · كوب`
  }, [title])

  // Before the slot has mounted there is nowhere to put them.
  if (!node || (quiet && !action)) return null
  // The page's name and its main actions as ONE group at the start of the
  // bar — where an Arabic reader's eye lands first. The actions used to sit
  // alone at the far end, which on a wide screen is a corner nobody looks at:
  // "where do I add one?" was the most-asked question about every page.
  return createPortal(
    <div className="flex min-w-0 items-center gap-3">
      {!quiet ? <h1 className="truncate font-heading text-lg font-bold md:text-xl">{title}</h1> : null}
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>,
    node,
  )
}
