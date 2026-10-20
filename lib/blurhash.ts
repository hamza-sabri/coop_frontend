/* Blurhash previews (https://blurha.sh).

   The API appends each picture's code to its URL: "…/latte.jpg#bh=<code>".
   Browsers ignore the fragment when loading and caching, so the picture is
   fetched exactly as before; here we turn the code into a tiny blurred image
   (a data URL) to paint while the real one loads.

   Cost: decoding is ~0.2 ms and done once per code (memoised), and only for
   pictures that are actually still loading — see <BlurImg>. */

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

function b83(str: string, from: number, to: number): number {
  let v = 0
  for (let i = from; i < to; i++) {
    const d = CHARS.indexOf(str[i])
    if (d < 0) throw new Error("bad blurhash")
    v = v * 83 + d
  }
  return v
}

const toLinear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const toSrgb = (v: number) => {
  const c = Math.max(0, Math.min(1, v))
  return c <= 0.0031308 ? Math.trunc(c * 12.92 * 255 + 0.5) : Math.trunc((1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255 + 0.5)
}
const signPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e)

/** RGBA pixels for a code, or null if the code is not valid. */
export function decode(hash: string, width: number, height: number, punch = 1): Uint8ClampedArray | null {
  try {
    if (!hash || hash.length < 6) return null
    const size = b83(hash, 0, 1)
    const ny = Math.floor(size / 9) + 1
    const nx = (size % 9) + 1
    if (hash.length !== 4 + 2 * nx * ny) return null
    const maxValue = ((b83(hash, 1, 2) + 1) / 166) * punch
    const colors: number[][] = new Array(nx * ny)
    const dc = b83(hash, 2, 6)
    colors[0] = [toLinear(dc >> 16), toLinear((dc >> 8) & 255), toLinear(dc & 255)]
    for (let i = 1; i < nx * ny; i++) {
      const v = b83(hash, 4 + i * 2, 6 + i * 2)
      colors[i] = [
        signPow((Math.floor(v / (19 * 19)) - 9) / 9, 2) * maxValue,
        signPow(((Math.floor(v / 19) % 19) - 9) / 9, 2) * maxValue,
        signPow(((v % 19) - 9) / 9, 2) * maxValue,
      ]
    }
    const cosX: number[] = new Array(width * nx)
    for (let x = 0; x < width; x++) for (let i = 0; i < nx; i++) cosX[x * nx + i] = Math.cos((Math.PI * x * i) / width)
    const cosY: number[] = new Array(height * ny)
    for (let y = 0; y < height; y++) for (let j = 0; j < ny; j++) cosY[y * ny + j] = Math.cos((Math.PI * y * j) / height)
    const px = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0
        for (let j = 0; j < ny; j++) {
          const cy = cosY[y * ny + j]
          for (let i = 0; i < nx; i++) {
            const basis = cosX[x * nx + i] * cy
            const c = colors[i + j * nx]
            r += c[0] * basis
            g += c[1] * basis
            b += c[2] * basis
          }
        }
        const o = 4 * (x + y * width)
        px[o] = toSrgb(r)
        px[o + 1] = toSrgb(g)
        px[o + 2] = toSrgb(b)
        px[o + 3] = 255
      }
    }
    return px
  } catch {
    return null
  }
}

/** The code carried in a picture URL ("…#bh=<code>"), or null. */
export function hashFromSrc(src: unknown): string | null {
  if (typeof src !== "string") return null
  const i = src.indexOf("#bh=")
  if (i < 0) return null
  try {
    return decodeURIComponent(src.slice(i + 4)) || null
  } catch {
    return null
  }
}

const cache = new Map<string, string | null>()

/** A tiny PNG data URL of the blur, memoised. Null when unavailable. */
export function placeholderFor(hash: string | null): string | null {
  if (!hash || typeof document === "undefined") return null
  const hit = cache.get(hash)
  if (hit !== undefined) return hit
  let url: string | null = null
  try {
    const W = 32, H = 32
    const px = decode(hash, W, H)
    if (px) {
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.putImageData(new ImageData(px, W, H), 0, 0)
        url = canvas.toDataURL()
      }
    }
  } catch {
    url = null
  }
  if (cache.size > 800) cache.clear()
  cache.set(hash, url)
  return url
}

/** CSS background value for a URL used as a background image: the real
 *  picture over its blur, so the blur shows until the picture arrives. */
export function cssBackgroundWithBlur(src: string | null | undefined): string | undefined {
  if (!src) return undefined
  const blur = placeholderFor(hashFromSrc(src))
  return blur ? `url("${src}"), url("${blur}")` : `url("${src}")`
}
