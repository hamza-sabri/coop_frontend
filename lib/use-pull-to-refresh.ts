"use client"
/* Pull-to-refresh, written straight to the DOM.
 *
 * Chrome's native gesture never fires here and that is not a browser bug: the
 * app pins the document (`body:has(.koup){overflow:hidden}`) and scrolls an
 * inner element, so the DOCUMENT is never at scroll-top and the overscroll
 * that arms the native pull never happens. In an installed PWA there is also
 * no address bar to pull against. So the gesture has to be ours.
 *
 * The first version of this kept the pull distance in React state. That was a
 * mistake with consequences far beyond this file: touchmove fires at screen
 * refresh rate, so every pixel of every pull re-rendered the whole customer
 * app — a 1,300-line component with forty-five menu cards. The result was not
 * just slowness; it starved the GSAP ticker and let React reconcile nodes
 * mid-tween, which is why animations "sometimes played, sometimes half
 * played, sometimes never".
 *
 * So the pull writes transforms directly to the two elements it moves, the
 * same way the gloss painter does. React sees one state change per gesture —
 * when the refresh starts, and when it ends — instead of sixty per second.
 *
 * Touch only. A wheel at the top of a list is somebody scrolling, and
 * hijacking that makes a desktop feel broken.
 */
import { useEffect, useRef, useState } from "react"

const THRESHOLD = 72     // px of pull before it counts as a request
const MAX = 110          // px the indicator may travel before it resists
const RESIST = 0.55      // finger-to-pixel ratio, so the pull feels weighted

export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
  enabled = true,
) {
  /** The only React state here: are we actually refreshing right now. */
  const [busy, setBusy] = useState(false)
  const startY = useRef<number | null>(null)
  const armed = useRef(false)
  const dist = useRef(0)
  const busyRef = useRef(false)
  const cb = useRef(onRefresh)
  cb.current = onRefresh

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    /* The indicator is created once and parked at height 0, rather than
       rendered by React — so showing it costs a style write, not a render. */
    const dot = document.createElement("div")
    dot.className = "ptr"
    dot.innerHTML = '<span class="ptr-dot"></span>'
    dot.style.height = "0px"
    dot.style.opacity = "0"
    el.prepend(dot)

    const paint = (px: number) => {
      dist.current = px
      dot.style.height = `${px}px`
      dot.style.opacity = String(Math.min(1, px / 48))
      dot.dataset.ready = px >= THRESHOLD ? "true" : "false"
      el.style.transform = px ? `translateY(${px}px)` : ""
    }

    function onStart(e: TouchEvent) {
      // Only from a genuine rest at the top; stealing a mid-scroll pull is how
      // a list starts fighting the thumb.
      armed.current = !busyRef.current && el!.scrollTop <= 0 && e.touches.length === 1
      startY.current = armed.current ? e.touches[0].clientY : null
    }

    function onMove(e: TouchEvent) {
      if (!armed.current || startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { paint(0); return }
      if (dy > 6 && e.cancelable) e.preventDefault()
      paint(Math.min(MAX, dy * RESIST))
    }

    async function onEnd() {
      const reached = dist.current >= THRESHOLD
      armed.current = false
      startY.current = null
      if (!reached) { paint(0); return }
      busyRef.current = true
      setBusy(true)
      paint(THRESHOLD)
      dot.firstElementChild?.classList.add("spin")
      try {
        await cb.current()
      } finally {
        dot.firstElementChild?.classList.remove("spin")
        paint(0)
        busyRef.current = false
        setBusy(false)
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
      el.style.transform = ""
      dot.remove()
    }
  }, [ref, enabled])

  return { busy }
}
