import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const read = (p: string) =>
  readFileSync(path.resolve(__dirname, "..", "..", p), "utf8")

/** Comments explain what the code no longer does, and name the patterns it
 *  used to have. Assert on the code, or every explanation trips its own test. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "")

const SHEET = stripComments(read("components/ui/sheet.tsx"))
const FORM = stripComments(read("components/form-modal.tsx"))

/**
 * Three faults reported from a real screen, each of which looked like a
 * styling nit and was actually a component contract that could not be
 * satisfied from the outside.
 */

describe("a drawer is as wide as the caller asked for", () => {
  it("does not bake a width into the base class string", () => {
    // `data-[side=left]:sm:max-w-sm` in the base and `sm:max-w-2xl` from the
    // caller are different variant sets, so tailwind-merge keeps BOTH and the
    // data-variant rule sorts later. A drawer carrying a table rendered at
    // phone width on a 1920px screen and no className could fix it.
    expect(SHEET).not.toContain("data-[side=left]:sm:max-w-sm")
    expect(SHEET).not.toContain("data-[side=right]:sm:max-w-sm")
  })

  it("exposes width as a prop with real sizes behind it", () => {
    expect(SHEET).toContain("const WIDTHS")
    expect(SHEET).toContain("size?: keyof typeof WIDTHS")
    for (const w of ["sm:max-w-sm", "sm:max-w-xl", "sm:max-w-2xl", "sm:max-w-4xl"]) {
      expect(SHEET).toContain(w)
    }
  })
})

describe("the close button is where an RTL reader looks", () => {
  it("is positioned logically, not physically", () => {
    // `right-3` put it on the far side of an RTL panel, a drawer's width away
    // from where the eye starts, and half under the header artwork.
    expect(SHEET).toContain("absolute end-3 top-3")
    expect(SHEET).not.toMatch(/absolute top-3 right-3/)
  })

  it("stays legible over a coloured header", () => {
    // Every drawer header in the app is branded. A bare ghost button on top of
    // bg-brand-soft is nearly invisible.
    expect(SHEET).toContain("bg-background/80")
  })

  it("is labelled in the user's language", () => {
    expect(SHEET).toContain('aria-label="إغلاق"')
  })
})

describe("forms open beside their list, not on top of it", () => {
  it("the app's form shell is a drawer", () => {
    // This is the swap that reaches medications, debts, customers and the
    // report drill-downs at once. Migrating them one at a time leaves the app
    // speaking two dialects.
    expect(FORM).toContain("<SheetContent")
    expect(FORM).not.toContain("<DialogContent")
  })

  it("enters from the side away from the navigation rail", () => {
    expect(FORM).toContain('side="left"')
  })

  it("keeps the footer reachable under a long form", () => {
    // Without min-h-0 the body pushes the footer past the bottom of the panel
    // and the save button cannot be reached at all.
    expect(FORM).toContain("min-h-0 flex-1")
    expect(FORM).toContain("shrink-0 flex-row")
  })
})

describe("كوب's own additions to the contract", () => {
  it("keeps Enter-saves, which al-rahmah's shell never had", () => {
    // Every كوب form saves through a [data-form-primary] button the shell
    // presses on Enter. Porting the drawer must not quietly drop that.
    expect(FORM).toContain("[data-form-primary]:not(:disabled)")
    expect(FORM).toContain("onKeyDown={onKeyDown}")
  })

  it("opens the invoice beside the list, not over it", () => {
    const INVOICE = stripComments(read("components/sales/sale-detail.tsx"))
    expect(INVOICE).toContain("<SheetContent")
    expect(INVOICE).not.toContain("<DialogContent")
    expect(INVOICE).toContain('side="left"')
  })
})

describe("installed app on a phone (viewport-fit=cover)", () => {
  const RAW_SHEET = read("components/ui/sheet.tsx")
  const NAV = stripComments(read("components/bottom-nav.tsx"))
  const CSS = read("app/globals.css")

  it("the drawer close button is a 40px target clear of the status bar", () => {
    expect(SHEET).toContain("size-10")
    expect(SHEET).toContain('<XIcon className="size-5" />')
    expect(SHEET).toContain("in-data-[side=left]:mt-[env(safe-area-inset-top)]")
    expect(SHEET).toContain("in-data-[side=right]:mt-[env(safe-area-inset-top)]")
    expect(RAW_SHEET).not.toContain('size="icon-sm"')
  })

  it("side drawers start below the status bar", () => {
    expect(SHEET).toContain("data-[side=left]:pt-[env(safe-area-inset-top)]")
    expect(SHEET).toContain("data-[side=right]:pt-[env(safe-area-inset-top)]")
  })

  it("the bottom nav is docked to the edge, not floating over the cart", () => {
    expect(NAV).toContain('className="bottom-nav md:hidden"')
    expect(NAV).not.toContain("bottom-[calc(0.75rem+env(safe-area-inset-bottom))]")
  })

  it("follows Chrome's edge-to-edge pattern: fixed size, only `bottom` moves", () => {
    // Padding by the LIVE inset made the bar float over Android's chin, then
    // grow tall once the chin slid away.
    expect(NAV).not.toContain("paddingBottom")
    expect(CSS).toContain("--sab-max: env(safe-area-max-inset-bottom")
    expect(CSS).toContain("bottom: calc(env(safe-area-inset-bottom, 0px) - var(--sab-max))")
    expect(CSS).toContain("padding-bottom: var(--sab-max)")
    expect(CSS).toContain("--nav-h: calc(var(--nav-bar) + env(safe-area-inset-bottom, 0px))")
    // the buttons ride into the gesture area by transform, never by layout
    expect(CSS).toContain("transform: translateY(calc(env(safe-area-inset-bottom, 0px) * 0.5))")
  })

  it("everything floating above the nav is placed from its height", () => {
    for (const f of [
      "app/(app)/pos/page.tsx",
      "components/fab.tsx",
      "app/(app)/purchases/page.tsx",
      "components/offline/offline-status.tsx",
    ]) {
      const src = read(f)
      expect(src, f).toContain("var(--nav-h)")
      expect(src, f).not.toContain("6.5rem+env(safe-area-inset-bottom)")
    }
    expect(read("app/(app)/pos/page.tsx")).not.toContain("fixed inset-x-3 bottom-24")
  })
})
