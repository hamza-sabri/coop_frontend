"use client"

/* The new-order alarm.

   A café counter is loud, and the old cue — two soft notes, once — was missed
   whenever nobody was looking at the screen. This one is a real sound file
   (public/sounds/order-alarm.wav: a bright ring, then a pause) played at full
   volume ON A LOOP until someone taps "seen" or the order is accepted.

   Its own mute switch (not the till's scan-beep mute): silencing the scanner
   must never silence orders. */

const MUTE_KEY = "sijilli.alarm.muted"
const SRC = "/sounds/order-alarm.wav"

let audio: HTMLAudioElement | null = null
let ringing = false
let primed = false
let buzz: ReturnType<typeof setInterval> | null = null

function el(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null
  if (!audio) {
    try {
      audio = new Audio(SRC)
      audio.preload = "auto"
      audio.loop = true
      audio.volume = 1
    } catch {
      audio = null
    }
  }
  return audio
}

export function alarmMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setAlarmMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
  } catch {
    /* private mode: the switch just won't stick */
  }
  if (muted) stopAlarm()
}

/** Phones only let a page play sound after a tap. The first tap anywhere
 *  plays the file silently once, so the first order can ring. */
export function primeAlarm() {
  const a = el()
  if (!a || primed) return
  try {
    a.muted = true
    const p = a.play()
    const done = () => {
      a.pause()
      a.currentTime = 0
      a.muted = false
      primed = true
      if (ringing) void startAlarm()
    }
    if (p && typeof p.then === "function") p.then(done, () => { a.muted = false })
    else done()
  } catch {
    /* not allowed yet: the next tap tries again */
  }
}

export function isRinging() {
  return ringing
}

/** Ring until stopAlarm(). Safe to call repeatedly. */
export async function startAlarm(): Promise<boolean> {
  ringing = true
  if (alarmMuted()) return false
  const a = el()
  if (!a) return false
  try {
    a.loop = true
    if (a.paused) {
      a.currentTime = 0
      await a.play()
    }
    if (!buzz && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([400, 200, 400])
      buzz = setInterval(() => navigator.vibrate?.([400, 200, 400]), 3000)
    }
    return true
  } catch {
    return false // blocked until the first tap (primeAlarm retries)
  }
}

export function stopAlarm() {
  ringing = false
  if (buzz) {
    clearInterval(buzz)
    buzz = null
  }
  try {
    navigator.vibrate?.(0)
  } catch {
    /* ignore */
  }
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
}

/** One ring, for the settings' "test" button (a tap, so it always plays). */
export async function testAlarm(): Promise<boolean> {
  const a = el()
  if (!a) return false
  try {
    a.loop = false
    a.currentTime = 0
    a.muted = false
    await a.play()
    primed = true
    return true
  } catch {
    return false
  }
}

if (typeof window !== "undefined") {
  const evs = ["pointerdown", "touchend", "keydown"] as const
  const kick = () => {
    primeAlarm()
    if (primed) evs.forEach((e) => window.removeEventListener(e, kick))
  }
  evs.forEach((e) => window.addEventListener(e, kick, { passive: true }))
}
