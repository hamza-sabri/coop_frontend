"use client"
/* Pull-to-refresh for the customer app.
 *
 * Chrome's native gesture never fires here and it is not a bug in the browser:
 * the app pins the document (`body:has(.koup){overflow:hidden}`) and scrolls
 * an inner element, so the DOCUMENT is never at scroll-top and the overscroll
 * that arms the native pull simply never happens. In an installed PWA there
 * is also no address bar to pull against. So the gesture has to be ours.
 *
 * Deliberately touch-only. A mouse wheel at the top of a list is not someone
 * asking to refresh, and hijacking it makes a desktop feel broken.
 */
import { useEffect, useRef, useState } from "react"

const THRESHOLD = 72     // px of pull before it counts as a request
const MAX = 110          // px the indicator can travel; beyond this it resists
const RESIST = 0.55      // finger-to-pixel ratio, so the pull feels weighted

export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
  enabled = true,
) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const startY = useRef<number | null>(null)
  const armed = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    function onStart(e: TouchEvent) {
      // Only from a genuine resting position at the top. Mid-scroll pulls are
      // the user scrolling, and stealing those is how a list starts fighting
      // the thumb.
      armed.current = el!.scrollTop <= 0 && e.touches.length === 1
      startY.current = armed.current ? e.touches[0].clientY : null
    }

    function onMove(e: TouchEvent) {
      if (!armed.current || startY.current === null || busy) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { setPull(0); return }
      // Once we are visibly pulling, the browser must stop trying to scroll
      // the same finger. Needs a non-passive listener, hence the option below.
      if (dy > 6 && e.cancelable) e.preventDefault()
      setPull(Math.min(MAX, dy * RESIST))
    }

    async function onEnd() {
      const reached = pull >= THRESHOLD
      armed.current = false
      startY.current = null
      if (!reached) { setPull(0); return }
      setBusy(true)
      // Hold the indicator where it is while the work happens, so the release
      // reads as "received" rather than as a failed pull that snapped back.
      setPull(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setBusy(false)
        setPull(0)
      }
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd, { passive: true })
    el.addEventListener("touchcancel", onEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [ref, onRefresh, enabled, pull, busy])

  return { pull, busy, ready: pull >= THRESHOLD }
}
