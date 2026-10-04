"use client"
/* Camera scanning at the till: off unless this device turns it on.

   A café picks drinks by tapping pictures, not by scanning barcodes, and the
   camera was opening on its own every time the mobile cart was opened. The
   code stays — a shop that sells bottled drinks may want it back — but no
   device scans until someone switches it on in الإعدادات → هذا الجهاز.

   Per device (localStorage), like the till sound: the counter's tablet and
   the owner's phone can differ. The hardware barcode wedge is unaffected; it
   is keyboard input, not the camera. */

import { useEffect, useState } from "react"

const KEY = "koup.scanner.v1"
const EVENT = "koup-scanner-changed"

export function scannerEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on"
  } catch {
    return false
  }
}

export function setScannerEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off")
  } catch {
    /* private mode — the default (off) stands */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** False on the server and on first paint, so hydration never shows a
 *  scanner button that then disappears. */
export function useScannerEnabled(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const read = () => setOn(scannerEnabled())
    read()
    window.addEventListener(EVENT, read)
    window.addEventListener("storage", read)
    return () => {
      window.removeEventListener(EVENT, read)
      window.removeEventListener("storage", read)
    }
  }, [])
  return on
}
