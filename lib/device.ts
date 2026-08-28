"use client"
/* "Will this phone struggle?" — measured, not guessed.
 *
 * The first version of this only read hardwareConcurrency and deviceMemory,
 * with the bar at 4. That misses almost every phone it was written for: a
 * mid-range Android in 2026 happily reports 8 cores and 6GB and still cannot
 * composite eleven backdrop-filters at sixty frames a second. Spec sheets do
 * not predict GPU compositing throughput, so asking them was never going to
 * work.
 *
 * So: a cheap frame-rate probe over the first ~600ms of real rendering, with
 * the verdict remembered. Nobody probes twice, and the second launch starts
 * in the right mode with no measuring jank at all.
 */
const KEY = "koup.perf.v1"

type Verdict = { lite: boolean; fps: number; at: number }

function readVerdict(): Verdict | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Verdict) : null
  } catch { return null }
}

/** The cheap signals. Kept as a floor: anything this weak needs no measuring. */
function looksWeak(): boolean {
  if (typeof navigator === "undefined") return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches) return true
  if ((nav.hardwareConcurrency ?? 8) <= 6) return true
  if ((nav.deviceMemory ?? 8) <= 4) return true
  return false
}

/** Synchronous best answer — the remembered verdict, else the crude guess. */
export function lowPower(): boolean {
  const v = readVerdict()
  if (v) return v.lite
  return looksWeak()
}

/**
 * Measure real frames for ~600ms, remember the answer, and hand it back.
 * Anything under 50fps while the app is merely sitting there means the device
 * has no headroom left for scrolling, so it gets lite mode.
 */
export function probePerformance(): Promise<boolean> {
  return new Promise((resolve) => {
    const remembered = readVerdict()
    if (remembered) { resolve(remembered.lite); return }
    if (typeof requestAnimationFrame !== "function") { resolve(looksWeak()); return }

    let frames = 0
    const t0 = performance.now()
    const tick = () => {
      frames++
      const dt = performance.now() - t0
      if (dt < 600) { requestAnimationFrame(tick); return }
      const fps = (frames * 1000) / dt
      // A weak spec sheet can still veto a flattering measurement: 60fps on an
      // idle screen says nothing about a phone with 4 cores and a full list.
      const lite = fps < 50 || looksWeak()
      try { localStorage.setItem(KEY, JSON.stringify({ lite, fps, at: Date.now() })) } catch { /* fine */ }
      resolve(lite)
    }
    requestAnimationFrame(tick)
  })
}
