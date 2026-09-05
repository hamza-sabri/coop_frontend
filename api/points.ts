"use client"
/* Loyalty points for ONE customer — read the standing, and move it by hand.
 *
 * Separate from the generated client on purpose: this endpoint is a custom
 * DRF @action, and regenerating `api/generated` from the schema would still
 * not give it the signed-delta semantics the UI needs to explain. Hand-written
 * is honest here.
 *
 * The contract is deliberately a SIGNED DELTA, never a new balance. "Set his
 * points to 40" throws away why they changed; "+20, remade his latte" is a row
 * in a ledger somebody can read back in six months.
 */
import { customFetch } from "@/api/http"

export type PointMove = {
  delta: number
  reason: string
  note: string
  balance_after: number
  at: string
}

export type CustomerPoints = {
  balance: number
  /** Everything ever earned, positive. */
  earned: number
  /** Everything ever spent, reported positive. */
  spent: number
  redemptions: number
  value_ils: string
  points_per_ils: number
  earn_rate: string
  activity: PointMove[]
}

export const customerPoints = (id: number) =>
  customFetch<{ data: CustomerPoints }>(`/api/v1/customers/${id}/points/`)

/** Signed. `clientUuid` makes a double-tap on a slow connection idempotent. */
export const adjustCustomerPoints = (
  id: number,
  delta: number,
  note: string,
  clientUuid: string,
) =>
  customFetch<{ data: CustomerPoints & { moved: number } }>(
    `/api/v1/customers/${id}/points/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note, client_uuid: clientUuid }),
    },
  )

export const REASON_LABEL: Record<string, string> = {
  earn: "شراء",
  bonus: "مكافأة",
  redeem: "استبدال",
  referral: "إحالة",
  signup: "تسجيل",
  expire: "انتهاء",
  adjust: "تعديل يدوي",
}
