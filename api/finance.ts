"use client"
/* The owner's money endpoints: the P&L, the hour × category grid, expenses,
 * shifts and the points ladder. Hand-written, like api/points.ts — these are
 * not in the generated schema. */
import { customFetch } from "@/api/http"

type Env<T> = { data: T; status: number }

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const qs = (p: Record<string, string | number | undefined | null>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v != null && v !== "") u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ""
}

// ── P&L ────────────────────────────────────────────────────────────────
export type Period = "day" | "week" | "month" | "custom"

export type PnlLines = {
  gross_sales: string
  discounts: string
  points_redeemed: string
  returns: string
  net_revenue: string
  cogs: string
  waste: string
  gross_profit: string
  opex?: string
  net_profit?: string
  shift_wages?: string
  contribution?: string
}

export type PnlSeriesRow = {
  date: string
  tickets: number
  net_revenue: string
  cogs: string
  gross_profit: string
  opex?: string
  net_profit?: string
  shift_wages?: string
}

export type Pnl = {
  range: {
    start: string
    end: string
    elapsed_end: string
    days: number
    period: Period
    day_start_hour: number
  }
  shift: { id: number; name: string; start: string; end: string; wage_per_day: string } | null
  lines: PnlLines
  kpis: {
    tickets: number
    cups: string
    avg_ticket: string
    cost_per_cup: string
    gross_margin_pct: string
    net_margin_pct?: string
    break_even_daily?: string | null
    returns_count: number
    remakes: number
    returns_cost_written_off: string
  }
  coverage: { uncosted_revenue: string; uncosted_lines: number; lines: number }
  memo: { points_outstanding: number; points_outstanding_value: string; purchases: string }
  opex?: { category_id: number; name: string; key: string; amount: string }[]
  series?: PnlSeriesRow[]
  previous?: {
    start: string
    end: string
    net_revenue: string
    gross_profit: string
    net_profit: string | null
    contribution: string | null
    tickets: number
  }
  shifts: { id: number; name: string; start: string; end: string }[]
}

export type PnlQuery = {
  period: Period
  date?: string
  start?: string
  end?: string
  shift?: number | null
}

export const fetchPnl = (q: PnlQuery) =>
  customFetch<Env<Pnl>>(`/api/v1/reports/pnl/${qs(q)}`)

export type HourGrid = {
  categories: string[]
  cells: { hour: number; category: string; qty: string; revenue: string }[]
  peak_hour: number | null
  day_start_hour: number
  range: { start: string; end: string; period: Period }
}

export const fetchHours = (q: PnlQuery) =>
  customFetch<Env<HourGrid>>(`/api/v1/reports/hours/${qs(q)}`)

// ── expenses ───────────────────────────────────────────────────────────
export type ExpenseCategory = { id: number; name: string; key: string; position: number }
export type Expense = {
  id: number
  category: number
  category_name: string
  amount: string
  period: string
  paid_on: string | null
  note: string
  client_uuid?: string | null
  created_at?: string
}
export type RecurringExpense = {
  id: number
  category: number
  category_name: string
  name: string
  amount: string
  start_month: string
  end_month: string | null
}
export type ExpenseMonth = {
  month: string
  expenses: Expense[]
  recurring: RecurringExpense[]
  by_category: { category_id: number; name: string; key: string; amount: string }[]
  total: string
  previous_total: string
}

export const fetchExpenseMonth = (month: string) =>
  customFetch<Env<ExpenseMonth>>(`/api/v1/expenses/month/${qs({ month })}`)
export const fetchExpenseCategories = () =>
  customFetch<Env<ExpenseCategory[]>>(`/api/v1/expense-categories/`)
export const createExpenseCategory = (name: string) =>
  customFetch<Env<ExpenseCategory>>(`/api/v1/expense-categories/`, json("POST", { name }))
export const saveExpense = (id: number | null, body: Partial<Expense>) =>
  customFetch<Env<Expense>>(
    id ? `/api/v1/expenses/${id}/` : `/api/v1/expenses/`,
    json(id ? "PATCH" : "POST", body),
  )
export const deleteExpense = (id: number) =>
  customFetch(`/api/v1/expenses/${id}/`, { method: "DELETE" })
export const saveRecurring = (id: number | null, body: Partial<RecurringExpense>) =>
  customFetch<Env<RecurringExpense>>(
    id ? `/api/v1/recurring-expenses/${id}/` : `/api/v1/recurring-expenses/`,
    json(id ? "PATCH" : "POST", body),
  )
export const deleteRecurring = (id: number) =>
  customFetch(`/api/v1/recurring-expenses/${id}/`, { method: "DELETE" })

// ── shifts ─────────────────────────────────────────────────────────────
export type Shift = {
  id: number
  name: string
  start: string
  end: string
  wage_per_day?: string
  position: number
  is_active: boolean
  hours: string
  crosses_midnight: boolean
}
export const fetchShifts = () => customFetch<Env<Shift[]>>(`/api/v1/shifts/`)
export const saveShift = (id: number | null, body: Partial<Shift>) =>
  customFetch<Env<Shift>>(
    id ? `/api/v1/shifts/${id}/` : `/api/v1/shifts/`,
    json(id ? "PATCH" : "POST", body),
  )
export const deleteShift = (id: number) =>
  customFetch(`/api/v1/shifts/${id}/`, { method: "DELETE" })

// ── points ladder ──────────────────────────────────────────────────────
export type EarnRule = {
  id?: number
  min_total: string
  max_total: string | null
  rate_percent: string
}
export type EarnRules = {
  rules: EarnRule[]
  default_rate_percent: string
  points_per_ils: number
}
export const fetchEarnRules = () => customFetch<Env<EarnRules>>(`/api/v1/points/rules/`)
export const saveEarnRules = (rules: EarnRule[]) =>
  customFetch<Env<EarnRules>>(`/api/v1/points/rules/`, json("PUT", { rules }))
