/* The page title belongs in the top bar.

   Every admin screen opened with a heading block — gradient bar, h1, subtitle,
   and air around all three — directly beneath a top bar that was empty. On the
   touchscreen the shop actually uses, that is a hundred pixels of nothing above
   the only thing anyone came to press.

   The rule is easy to undo by accident: the next page someone writes reaches
   for an <h1> because that is what a page looks like. */
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "..")
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8")

function pages(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name)
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...pages(rel))
    else if (name === "page.tsx") out.push(rel)
  }
  return out
}

describe("where a page title goes", () => {
  const src = read("components/page-header.tsx")

  it("teleports rather than passing the title up through layout props", () => {
    // A portal keeps the node in the PAGE's React tree, so an `action` button
    // still closes over that page's state and opens that page's dialog while
    // its DOM lands in the top bar.
    expect(src).toContain("createPortal")
  })

  it("renders nothing at all until the slot exists", () => {
    // Rendering in place for one frame would push the page down and snap it
    // back — worse than a frame without a title.
    expect(src).toContain("if (!node || !action) return null")
  })

  it("keeps the page name in the tab, where it costs no pixels", () => {
    expect(src).toContain("document.title")
  })

  it("renders no heading of its own — that was the whole point", () => {
    expect(src).not.toMatch(/<h1/)
  })

  it("the top bar exposes the slot", () => {
    expect(read("components/top-bar.tsx")).toContain("<PageHeaderSlot")
  })

  it("the provider wraps both the top bar and the page", () => {
    const layout = read("app/(app)/layout.tsx")
    expect(layout).toContain("<PageHeaderProvider>")
    expect(layout.indexOf("<PageHeaderProvider>")).toBeLessThan(
      layout.indexOf("<TopBar />"),
    )
  })
})

describe("no page grows its own heading back", () => {
  it.each(pages("app/(app)"))("%s has no <h1> of its own", (rel) => {
    // PageHeader owns the h1. A page with its own is a heading block coming
    // back, and it will sit under the one in the top bar. Matched on the JSX
    // shape so the <h1> inside the purchase order's PRINTED html — a separate
    // document, not this page — does not count.
    expect(read(rel)).not.toMatch(/<h1\s+className/)
  })
})
