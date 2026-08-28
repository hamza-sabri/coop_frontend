"use client"
/* "Will this phone struggle?" — asked once, answered cheaply.
 *
 * Lives in its own module on purpose: lib/cup.ts pulls in three.js, and the
 * answer is needed by the CSS layer long before (and often instead of) any
 * WebGL. Importing the cup just to ask this question would load a 3D engine
 * on a device we are about to decide cannot afford one.
 *
 * No browser API reports "is this device fast". This triangulates from what
 * is exposed, and errs toward the cheap answer: guessing "weak" on a capable
 * phone costs a slightly plainer background, while guessing "fast" on a weak
 * one costs a café app that stutters in the customer's hand.
 */
export function lowPower(): boolean {
  if (typeof navigator === "undefined") return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches) return true
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true
  if ((nav.deviceMemory ?? 8) <= 4) return true
  return false
}
