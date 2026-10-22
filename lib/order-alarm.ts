"use client"

/* The new-order alarm.

   A café counter is loud, and the old cue — two soft notes, once — was missed
   whenever nobody was looking at the screen. This one is a real sound file
   (public/sounds/alarm-*.{mp3,wav}, picked per device in Settings) played at full
   volume ON A LOOP until someone taps "seen" or the order is accepted.

   Its own mute switch (not the till's scan-beep mute): silencing the scanner
   must never silence orders. */

const MUTE_KEY = "sijilli.alarm.muted"
const SOUND_KEY = "sijilli.alarm.sound"

/** The ringtones a counter can pick (public/sounds/alarm-<id>.wav). Per
 *  device, like the mute: the counter tablet and a phone can differ. */
export const ALARM_SOUNDS = [
  // "Clear announce tones" (Mixkit, free licence), made louder — the default.
  { id: "announce", label: "تنبيه الإعلان", file: "/sounds/alarm-announce.mp3" },
  { id: "ring", label: "رنين", file: "/sounds/alarm-ring.wav" },
  { id: "bell", label: "جرس الكاونتر", file: "/sounds/alarm-bell.wav" },
  { id: "kitchen", label: "صفارة مطبخ", file: "/sounds/alarm-kitchen.wav" },
  { id: "marimba", label: "نغمة", file: "/sounds/alarm-marimba.wav" },
  { id: "siren", label: "إنذار", file: "/sounds/alarm-siren.wav" },
] as const
export type AlarmSound = (typeof ALARM_SOUNDS)[number]["id"]

export function alarmSound(): AlarmSound {
  try {
    const v = window.localStorage.getItem(SOUND_KEY)
    if (ALARM_SOUNDS.some((x) => x.id === v)) return v as AlarmSound
  } catch {
    /* default */
  }
  return "announce"
}

export function setAlarmSound(id: AlarmSound) {
  try {
    window.localStorage.setItem(SOUND_KEY, id)
  } catch {
    /* private mode */
  }
  const wasRinging = ringing && audio && !audio.paused
  if (audio) {
    audio.pause()
    audio = null
  }
  if (wasRinging) void startAlarm()
}

const src = () => ALARM_SOUNDS.find((x) => x.id === alarmSound())?.file ?? ALARM_SOUNDS[0].file

let audio: HTMLAudioElement | null = null
let ringing = false
let primed = false
let buzz: ReturnType<typeof setInterval> | null = null

function el(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null
  if (!audio) {
    try {
      audio = new Audio(src())
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
