"use client"

/**
 * Live guide mode — the café's step-by-step guides run on the REAL screens
 * with the shop's real menu, but nothing can be saved while one runs:
 *
 *   - the guide's overlay takes every click (only «التالي / السابق / خروج»
 *     work), so the person watches where to tap rather than tapping;
 *   - and, belt and braces, customFetch refuses every write and submitSale
 *     refuses before anything is queued — so even a stray Enter key can
 *     never create a sale, a customer or a stock movement.
 *
 * The flag lives in sessionStorage so a reload mid-guide stays safe; the
 * provider clears it on every fresh load (no guide runs after a reload).
 */
const KEY = "coop_guide_live"

export function isGuideLive(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setGuideLive(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1")
    else window.sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** The error every blocked write throws — a 4xx, so nothing retries or queues it. */
export function guideWriteBlocked(): Error & { status: number } {
  const e = new Error("وضع التدريب — لا يُحفظ أي شيء") as Error & { status: number }
  e.status = 423
  return e
}
