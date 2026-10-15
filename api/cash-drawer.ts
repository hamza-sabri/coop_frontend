/* The till's cash drawer — see apps/store/cash_drawer.py. */
import { customFetch } from "@/api/http"

type Env<T> = { data: T; status: number }
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

/** Notes and coins, largest first — the keys of a count. */
export const DENOMINATIONS = ["200", "100", "50", "20", "10", "5", "2", "1"] as const
export type Denomination = (typeof DENOMINATIONS)[number]
/** How many of each: {"200": 3, "5": 12}. */
export type Counts = Partial<Record<Denomination, number>>

export const countsTotal = (c: Counts): number =>
  DENOMINATIONS.reduce((sum, d) => sum + Number(d) * (Number(c[d]) || 0), 0)

export type CashFigures = {
  opening: string
  cash_sales: string
  cash_tickets: number
  card_sales: string
  card_tickets: number
  debt_sales?: string
  debt_tickets?: number
  /** Cash handed back over the counter. */
  refunds: string
  card_refunds?: string
  put_in: string
  took_out: string
  expected: string
  card_expected?: string
  total_sales?: string
  tickets?: number
}

export type CashOperation = {
  at: string
  kind: "sale" | "return" | "refund" | "in" | "out"
  payment: "cash" | "card" | "debt"
  ref: string
  sale_id: number | null
  amount: string
  who: string
  customer: string
  note: string
}

export type CashSession = {
  id: number
  opened_at: string
  opened_by: string
  opened_by_id?: number | null
  opening_amount: string
  opening_counts?: Counts
  closed_at: string | null
  closed_by: string | null
  closed_by_id?: number | null
  note: string
  moves: { amount: string; note: string; at: string; by: string }[]
  /** Owner only while open; everyone who closed it, after. */
  figures?: CashFigures
  counted_amount?: string
  closing_counts?: Counts
  expected_amount?: string
  difference?: string
  card_counted?: string
  card_difference?: string
  /** Only on the detail endpoint. */
  operations?: CashOperation[]
}

export type CashDrawerState = { open: CashSession | null; history: CashSession[]; denominations?: string[] }

export const fetchCashDrawer = () => customFetch<Env<CashDrawerState>>(`/api/v1/cash-drawer/`)
export const openCashDrawer = (body: { counts?: Counts; opening_amount?: string; opened_by?: number | null }) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/open/`, json("POST", body))
export const moveCash = (amount: string, direction: "in" | "out", note: string) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/move/`, json("POST", { amount, direction, note }))
export const closeCashDrawer = (body: {
  counts?: Counts
  counted_amount?: string
  card_counted?: string
  closed_by?: number | null
  note: string
}) => customFetch<Env<CashSession>>(`/api/v1/cash-drawer/close/`, json("POST", body))
export const cashDrawerHistory = (page = 1) =>
  customFetch<Env<{ count: number; page: number; page_size: number; results: CashSession[] }>>(
    `/api/v1/cash-drawer/history/?page=${page}`,
  )
export const cashDrawerDetail = (id: number) => customFetch<Env<CashSession>>(`/api/v1/cash-drawer/${id}/`)
export const cashDrawerEdit = (id: number, body: { opened_by?: number | null; closed_by?: number | null; note?: string }) =>
  customFetch<Env<CashSession>>(`/api/v1/cash-drawer/${id}/`, json("PATCH", body))
/** Who works here — id and name only; any signed-in employee may read it. */
export const staffNames = () => customFetch<Env<{ id: number; name: string }[]>>(`/api/v1/staff/names/`)
