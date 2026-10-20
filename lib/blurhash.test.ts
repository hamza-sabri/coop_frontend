import { describe, expect, it } from "vitest"

import { decode, hashFromSrc } from "@/lib/blurhash"

describe("blurhash", () => {
  it("decodes like the reference library", () => {
    // First pixel of the blurha.sh demo code, from the official npm package.
    const px = decode("LEHV6nWB2yk8pyo0adR*.7kCMdnj", 32, 32)!
    expect(px).toHaveLength(32 * 32 * 4)
    expect([px[0], px[1], px[2], px[2000], px[2001]]).toEqual([135, 164, 177, 153, 134])
    expect(px[3]).toBe(255)
  })
  it("rejects bad codes instead of throwing", () => {
    expect(decode("nope", 8, 8)).toBeNull()
    expect(decode("LEHV6nWB2yk8pyo0adR*.7kCMdn", 8, 8)).toBeNull()
  })
  it("reads the code from the URL fragment", () => {
    expect(hashFromSrc("https://x/a.jpg?sig=1#bh=LEHV6nWB2yk8pyo0adR%2A.7kCMdnj")).toBe("LEHV6nWB2yk8pyo0adR*.7kCMdnj")
    expect(hashFromSrc("https://x/a.jpg")).toBeNull()
    expect(hashFromSrc(undefined)).toBeNull()
  })
})
