"use client"

/* Is OUR server answering? navigator.onLine only knows about the Wi-Fi.
 *
 * During a deploy the shop's internet is fine but the API answers 502/503/504
 * (or not at all) for a minute. customFetch reports every answer here; the
 * app then serves reads from its saved copy, keeps selling (sales queue), and
 * shows a calm "reconnecting" pill instead of error screens. A light probe
 * notices the moment the server is back. */
import { useSyncExternalStore } from "react"

let down = false
const subs = new Set<() => void>()

export function isServerDown(): boolean {
  return down
}

/** `true` = the server answered (any status below 500 counts). */
export function reportServer(ok: boolean): void {
  if (down === !ok) return
  down = !ok
  subs.forEach((f) => f())
}

export function onServerChange(cb: () => void): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

/** 502/503/504: the proxy is up but the app behind it is not (a deploy). */
export function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504
}

export function useServerDown(): boolean {
  return useSyncExternalStore(onServerChange, isServerDown, () => false)
}
