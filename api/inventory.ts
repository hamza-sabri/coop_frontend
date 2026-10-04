"use client"
/* Raw materials — what the café buys, not what it sells. */
import { customFetch } from "@/api/http"

type Env<T> = { data: T; status: number }
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export type BaseUnit = "piece" | "g" | "ml"
export type BuyUnit = "piece" | "g" | "kg" | "ml" | "l"

export type InventoryItem = {
  id: number
  name: string
  category: string
  unit: BaseUnit
  unit_label: string
  purchase_qty: string
  purchase_unit: BuyUnit
  purchase_unit_label: string
  /** Owner only. */
  purchase_cost?: string
  unit_cost?: string
  stock_value?: string
  stock: string
  reorder_level: string
  expiry_date: string | null
  supplier: string
  notes: string
  is_active: boolean
  state: ("negative" | "out" | "low" | "expired" | "expiring")[]
  /** Base units used per day over the last 14 days; null = not used lately. */
  daily_use: string | null
  /** Days the shelf lasts at that rate; null = unknown. */
  days_left: number | null
  client_uuid?: string | null
  created_at: string
  updated_at: string
}

export type StockMove = {
  id: number
  item: number
  kind: "purchase" | "waste" | "count" | "adjust" | "sale" | "remake"
  kind_label: string
  quantity: string
  stock_after: string
  reason: string
  note: string
  created_by_name: string
  created_at: string
  unit_cost?: string
  total_cost?: string
}

export type InventorySummary = {
  items: number
  low: number
  out: number
  expiring: number
  categories: string[]
  stock_value?: string
  purchases_month?: string
  waste_month?: string
}

type Page<T> = { results: T[]; count: number } | T[]

export type InventoryInsights = {
  range: { start: string; end: string; elapsed_end: string; days: number }
  stock_value: string
  items: number
  flow: { purchases: string; used: string; remakes: string; waste: string; shortfall: string; surplus: string }
  daily: { date: string; purchases: string; used: string; waste: string }[]
  by_category: { name: string; value: string; items: number }[]
  top_used: { id: number; name: string; unit: BaseUnit; quantity: string; cost: string }[]
  top_waste: { id: number; name: string; unit: BaseUnit; quantity: string; cost: string; reasons?: { reason: string; n: number }[] }[]
  running_out: { id: number; name: string; unit: BaseUnit; stock: string; per_day: string; days_left: number }[]
}

export const inventoryInsights = (q: { period: string; date: string }) =>
  customFetch<Env<InventoryInsights>>(
    `/api/v1/inventory-items/insights/?${new URLSearchParams({ period: q.period, date: q.date })}`,
  )
export const listItems = async (params: { search?: string; category?: string } = {}) => {
  const u = new URLSearchParams({ page_size: "500" })
  if (params.search) u.set("search", params.search)
  if (params.category) u.set("category", params.category)
  const r = await customFetch<Env<Page<InventoryItem>>>(`/api/v1/inventory-items/?${u}`)
  const d = r.data
  return Array.isArray(d) ? d : d.results
}
export const inventorySummary = () =>
  customFetch<Env<InventorySummary>>(`/api/v1/inventory-items/summary/`)
export const saveItem = (id: number | null, body: Record<string, unknown>) =>
  customFetch<Env<InventoryItem>>(
    id ? `/api/v1/inventory-items/${id}/` : `/api/v1/inventory-items/`,
    json(id ? "PATCH" : "POST", body),
  )
export const deleteItem = (id: number) =>
  customFetch(`/api/v1/inventory-items/${id}/`, { method: "DELETE" })
export const itemMoves = (id: number) =>
  customFetch<Env<StockMove[]>>(`/api/v1/inventory-items/${id}/moves/`)
export const recordPurchase = (
  id: number,
  body: { quantity: string; unit: BuyUnit; cost: string; expiry_date?: string; supplier?: string; note?: string; client_uuid?: string },
) => customFetch<Env<StockMove>>(`/api/v1/inventory-items/${id}/purchase/`, json("POST", body))
export const recordWaste = (
  id: number,
  body: { quantity: string; unit: BuyUnit; reason?: string; note?: string; client_uuid?: string },
) => customFetch<Env<StockMove>>(`/api/v1/inventory-items/${id}/waste/`, json("POST", body))
export const recordStocktake = (body: { counts: { item: number; counted: string }[]; note?: string; client_uuid?: string }) =>
  customFetch<Env<{ moves: number }>>(`/api/v1/inventory-items/stocktake/`, json("POST", body))

/** The units an item of this base unit may be bought / counted in. */
export function unitsFor(base: BaseUnit): BuyUnit[] {
  return base === "g" ? ["g", "kg"] : base === "ml" ? ["ml", "l"] : ["piece"]
}

export const UNIT_LABEL: Record<BuyUnit, string> = {
  piece: "قطعة",
  g: "غرام",
  kg: "كيلو",
  ml: "مل",
  l: "لتر",
}

export function toBase(qty: number, unit: BuyUnit): number {
  return unit === "kg" || unit === "l" ? qty * 1000 : qty
}

/** 2500 g → "2.5 كيلو", 300 ml → "300 مل", 120 piece → "120 قطعة". */
export function formatQty(baseQty: number | string, base: BaseUnit, exact = false): string {
  const n = Number(baseQty) || 0
  // `exact`: every gram and millilitre shown (13.814 l), for statements that
  // must add up on paper. Otherwise rounded for a glance.
  const fmt = (x: number) =>
    x.toLocaleString("en-US", { maximumFractionDigits: exact ? 3 : x < 10 ? 2 : 1 })
  if (base === "g" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} كيلو`
  if (base === "ml" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} لتر`
  return `${fmt(n)} ${UNIT_LABEL[base]}`
}

// ── categories (the dropdown) ──────────────────────────────────────────
export type InventoryCategory = { id: number; name: string; position: number; items: number }
export const listInvCategories = () =>
  customFetch<Env<InventoryCategory[]>>(`/api/v1/inventory-categories/`)
export const createInvCategory = (name: string) =>
  customFetch<Env<InventoryCategory>>(`/api/v1/inventory-categories/`, json("POST", { name }))

// ── the item's statement ───────────────────────────────────────────────
export type Ledger = {
  item: { id: number; name: string; unit: BaseUnit }
  range: { start: string; end: string }
  opening: string
  rows: { kind: StockMove["kind"]; label: string; quantity: string; moves: number; cost?: string }[]
  closing: string
  stock_now: string
  consistent: boolean
  used_by: { product_id: number | null; name: string; quantity: string; receipts: number }[]
  used_in: { product_id: number; name: string; quantity: string }[]
  moves: (StockMove & { sale: number | null; receipt_code: string; product_name: string })[]
}
export const itemLedger = (id: number, q: { period: string; date?: string }) =>
  customFetch<Env<Ledger>>(`/api/v1/inventory-items/${id}/ledger/?period=${q.period}${q.date ? `&date=${q.date}` : ""}`)

// ── recipes ────────────────────────────────────────────────────────────
export type RecipeLine = {
  id?: number
  item: number
  item_name: string
  base_unit: BaseUnit
  /** In the base unit. */
  quantity: string
  display_unit: BuyUnit
  unit_cost: string
  line_cost: string
}
export type Recipe = {
  product: number
  base: RecipeLine[]
  base_cost: string | null
  variants: { id: number; label: string; own: boolean; lines: RecipeLine[]; cost: string | null }[]
}
export const getRecipe = (productId: number) =>
  customFetch<Env<Recipe>>(`/api/v1/products/${productId}/recipe/`)
export const saveRecipe = (
  productId: number,
  variant: number | null,
  lines: { item: number; quantity: string; unit: BuyUnit }[],
) => customFetch<Env<Recipe>>(`/api/v1/products/${productId}/recipe/`, json("PUT", { variant, lines }))

/** Several versions in one request — all saved, or none. */
export const saveRecipes = (
  productId: number,
  versions: { variant: number | null; lines: { item: number; quantity: string; unit: BuyUnit }[] }[],
) => customFetch<Env<Recipe>>(`/api/v1/products/${productId}/recipe/`, json("PUT", { versions }))

/** A base-unit quantity shown in the unit it was typed in: 250 ml as "0.25" l. */
export function fromBase(baseQty: number | string, unit: BuyUnit): string {
  const n = Number(baseQty) || 0
  const v = unit === "kg" || unit === "l" ? n / 1000 : n
  return String(Number(v.toFixed(3)))
}
