import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Which thing went into the cart.
 *
 * This file used to assert the OPPOSITE rule, and the reversal is worth
 * keeping written down. In the pharmacy build every "variant" was a pack
 * invented by an import — عبوة ×24 and friends — so the base product was
 * always a valid answer, and opening a chooser for it stopped a ₪1 chocolate
 * bar dead at the till.
 *
 * A café's variants are not packaging. آيس تي is خوخ or يافا or بامبي, and
 * they are different drinks at different prices. Dropping the base row in
 * charges the right money for the wrong cup and leaves the barista guessing.
 * So: options present → always ask; no options → straight into the cart.
 */
const SRC = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")

const addMedOrPick = SRC.slice(
  SRC.indexOf("function addMedOrPick"),
  SRC.indexOf("/** Camera scan"),
)

describe("adding a product to the cart", () => {
  it("asks which one when the product has options", () => {
    expect(addMedOrPick).toContain("setVariantPicker")
    expect(addMedOrPick).toContain("opts.length > 0")
  })

  it("skips the question when there is nothing to choose", () => {
    expect(addMedOrPick).toContain("addWithFeedback(med)")
  })

  it("never offers an option that was taken off the menu", () => {
    // A retired flavour is still attached to the product; it must not be
    // orderable just because the row still exists.
    expect(addMedOrPick).toContain("is_active")
  })

  it("does not make the barista pick from a list of one", () => {
    expect(addMedOrPick).toContain("opts.length === 1 ? opts[0] : null")
  })

  it("switching a line's unit keeps the quantity, via setLineUnit", () => {
    expect(SRC).toContain("pos.setLineUnit(")
    const hook = readFileSync(
      path.resolve(__dirname, "../../../hooks/use-pos-carts.ts"),
      "utf8",
    )
    // It must patch the line in place — not remove and re-add, which would
    // reset the quantity to 1 and lose the cashier's work.
    const from = hook.indexOf("const setLineUnit")
    const next = hook.indexOf("\n  const ", from + 20)
    const fn = hook.slice(from, next)
    expect(fn).toContain("l.key === key")
    expect(fn).not.toContain("quantity: 1")
  })

  it("collapses duplicate option rows before the barista sees them", () => {
    const fn = SRC.slice(SRC.indexOf("function openUnitPicker"))
    expect(fn).toContain("seen.has(k)")
  })
})

describe("finding a product", () => {
  it("has no search box — the menu is pictures, and you tap them", () => {
    // A permanent text field cost a row of tiles and popped the on-screen
    // keyboard over the menu. Scanning is unaffected: see below.
    expect(SRC).not.toContain("<SearchInput")
  })

  it("still catches a hardware scanner anywhere on the page", () => {
    expect(SRC).toContain("useGlobalScanner")
  })
})
