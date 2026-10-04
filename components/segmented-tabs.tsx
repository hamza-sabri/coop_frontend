"use client"

import { cn } from "@/lib/utils"

/**
 * A row of tabs for a page that is really several pages.
 *
 * Used by Settings (six topics opened for different reasons on different days)
 * and by Import, where the automatic and manual paths are ALTERNATIVES rather
 * than steps — almost nobody does both in one sitting, and stacking them meant
 * scrolling a whole credential form to reach a file picker.
 *
 * The page had six stacked cards — appearance, branding, staff, pads, printing,
 * sync — so finding the printer meant scrolling past the staff list every time,
 * and on a 768px-tall till that is most of a screen per section. Each of these
 * is opened for a different reason, on a different day, usually once.
 *
 * A row of tabs, not a sidebar: there are six of them, the labels are short,
 * and the page is already inside the app's own sidebar. Scrollable on narrow
 * screens rather than wrapping into two rows that push the content down.
 */

export type SegmentedTab = {
  id: string
  label: string
  /** Hidden for employees. */
  ownerOnly?: boolean
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: SegmentedTab[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    // `overflow-x-auto` with no scrollbar chrome: six Arabic labels fit on a
    // laptop and swipe on a phone.
    <div
      role="tablist"
      className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-muted/50 p-1.5"
    >
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition",
              on
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
