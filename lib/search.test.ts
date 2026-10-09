import { describe, expect, it } from "vitest"

import { fold, matches } from "./search"

describe("Arabic search", () => {
  it("treats every alif as one letter", () => {
    expect(matches("إسبريسو", "اسبريسو")).toBe(true)
    expect(matches("اسبريسو", "أسبريسو")).toBe(true)
    expect(matches("آيس لاتيه", "ايس")).toBe(true)
  })
  it("ta marbuta, alif maqsura, hamza seats, harakat and tatweel", () => {
    expect(matches("قهوة تركية", "قهوه")).toBe(true)
    expect(matches("شاي بالنعناع", "شاى")).toBe(true)
    expect(matches("مثلّج", "مثلج")).toBe(true)
    expect(matches("كــراميل", "كراميل")).toBe(true)
    expect(matches("مؤكد", "موكد")).toBe(true)
  })
  it("digits and case", () => {
    expect(matches("0599123456", "٠٥٩٩")).toBe(true)
    expect(matches("Latte", "latte")).toBe(true)
    expect(fold("  أ  ب ")).toBe("ا ب")
  })
  it("empty query matches, a real miss does not", () => {
    expect(matches("لاتيه", "")).toBe(true)
    expect(matches("لاتيه", "موكا")).toBe(false)
  })
})
