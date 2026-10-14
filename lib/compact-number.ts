/** 999 → "999", 1105 → "1.1K", 1500 → "1.5K", 2000 → "2K", 12500 → "12.5K",
 *  1250000 → "1.2M". Rounded DOWN, so a balance is never shown bigger than it is. */
export function compact(n: number | string | null | undefined): string {
  const v = Math.round(Number(n) || 0)
  const a = Math.abs(v)
  const s = v < 0 ? "-" : ""
  const cut = (x: number) => {
    const d = x < 100 ? Math.floor(x * 10) / 10 : Math.floor(x)
    return String(d).replace(/\.0$/, "")
  }
  if (a < 1000) return String(v)
  if (a < 1_000_000) return s + cut(a / 1000) + "K"
  return s + cut(a / 1_000_000) + "M"
}
