"use client"
/* One customer's habits — GET /customers/{id}/profile/. Money fields are
 * present only for the owner. */
import { customFetch } from "@/api/http"

export type CustomerStatus = "regular" | "active" | "new" | "fading" | "no_visits"

export type CustomerProfile = {
  joined: string
  visits: number
  first_visit: string | null
  last_visit: string | null
  days_since_last: number | null
  every_days: number | null
  visits_30d: number
  status: CustomerStatus
  cups: string
  favourites: { product_id: number | null; name: string; qty: string; share: string; orders: number; size: string }[]
  hours: { hour: number; visits: number }[]
  /** Saturday first. */
  weekdays: number[]
  weekly: { week: string; visits: number; spend?: string }[]
  spent?: string
  avg_ticket?: string
}

export const customerProfile = (id: number) =>
  customFetch<{ data: CustomerProfile; status: number }>(`/api/v1/customers/${id}/profile/`)
