"use client"
/* <img> that shows the picture's blurhash while it loads.

   Drop-in for <img>: same props. The code rides in the URL ("#bh=…", added by
   the API); without one this is a plain <img>. Pictures the browser already
   has (complete on mount) get nothing extra, so the till's grid pays no cost;
   the blur is removed as soon as the picture loads, so transparent logos
   never sit on top of it. */
import { forwardRef, useEffect, useLayoutEffect, useRef } from "react"

import { hashFromSrc, placeholderFor } from "@/lib/blurhash"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

function clear(el: HTMLImageElement) {
  if (el.style.backgroundImage) el.style.backgroundImage = ""
}

export const BlurImg = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  function BlurImg({ onLoad, onError, ...props }, ref) {
    const own = useRef<HTMLImageElement | null>(null)
    const src = typeof props.src === "string" ? props.src : undefined

    useIsoLayoutEffect(() => {
      const el = own.current
      if (!el) return
      const hash = hashFromSrc(src)
      if (!hash || (el.complete && el.naturalWidth > 0)) {
        clear(el)
        return
      }
      const blur = placeholderFor(hash)
      if (!blur) return
      el.style.backgroundImage = `url("${blur}")`
      el.style.backgroundSize = "cover"
      el.style.backgroundPosition = "center"
    }, [src])

    return (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img
        decoding="async"
        {...props}
        ref={(el) => {
          own.current = el
          if (typeof ref === "function") ref(el)
          else if (ref) ref.current = el
        }}
        onLoad={(e) => {
          clear(e.currentTarget)
          onLoad?.(e)
        }}
        onError={(e) => {
          clear(e.currentTarget)
          onError?.(e)
        }}
      />
    )
  },
)
