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
  state: ("out" | "low" | "expired" | "expiring")[]
  client_uuid?: string | null
  created_at: string
  updated_at: string
}

export type StockMove = {
  id: number
  item: number
  kind: "purchase" | "waste" | "count" | "adjust"
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
export function formatQty(baseQty: number | string, base: BaseUnit): string {
  const n = Number(baseQty) || 0
  const fmt = (x: number) =>
    x.toLocaleString("en-US", { maximumFractionDigits: x < 10 ? 2 : 1 })
  if (base === "g" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} كيلو`
  if (base === "ml" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} لتر`
  return `${fmt(n)} ${UNIT_LABEL[base]}`
}
