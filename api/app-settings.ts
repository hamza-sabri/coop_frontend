"use client"
/* The customer app's per-shop settings (owner sets them; every phone of that
   shop's customers follows). */
import { customFetch } from "@/api/http"

export type AppSound = "coop" | "chime" | "bell" | "off"
export type AppSettings = { sound: AppSound; sounds: AppSound[] }

export const getAppSettings = () => customFetch<{ data: AppSettings }>(`/api/v1/store/app-settings/`)

export const saveAppSettings = (body: Partial<Pick<AppSettings, "sound">>) =>
  customFetch<{ data: AppSettings }>(`/api/v1/store/app-settings/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const APP_SOUND_LABEL: Record<AppSound, string> = {
  coop: "نغمة المحل",
  chime: "رنّة",
  bell: "جرس",
  off: "بدون",
}

/** Play one of the customer-app sounds (public/sounds/<name>.wav). */
export function playAppSound(sound: AppSound | string | undefined) {
  if (!sound || sound === "off" || typeof Audio === "undefined") return
  try {
    const a = new Audio(`/sounds/${sound}.wav`)
    a.volume = 1
    void a.play().catch(() => {})
  } catch {
    /* no audio here */
  }
}
