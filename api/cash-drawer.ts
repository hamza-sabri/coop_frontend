/* The till's cash drawer — see apps/store/cash_drawer.py. */
import { customFetch } from "@/api/http"

type Env<T> = { data: T; status: number }
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export type CashFigures = {
  opening: string
  cash_sales: string
  cash_tickets: number
  card_sales: string
  card_tickets: number
  refunds: string
  put_in: string
  took_out: string
  expected: string
}

export type CashSession = {
  id: number
  opened_at: string
  opened_by: string
  opening_amount: string
  closed_at: string | null
  closed_by: string | null
  note: string
  moves: { amount: string; note: string; at: string; by: string }[]
  /** Owner only while open; everyone who closed it, after. */
  figures?: CashFigures
  counted_amount?: string
  expected_amount?: string
  difference?: string
}

export type CashDrawerState = { open: CashSession | null; history: CashSession[] }

export const fetchCashDrawer = () => customFetch<Env<CashDrawerState>>(`/api/v1/cash-drawer/`)
export const openCashDrawer = (opening_amount: string) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/open/`, json("POST", { opening_amount }))
export const moveCash = (amount: string, direction: "in" | "out", note: string) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/move/`, json("POST", { amount, direction, note }))
export const closeCashDrawer = (counted_amount: string, note: string) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/close/`, json("POST", { counted_amount, note }))
