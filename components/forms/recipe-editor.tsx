"use client"

/* المكونات — what one cup takes from the shelf.
 *
 * Lives inside the drink form: the drink's own list, and under each size or
 * flavour either "same as the drink" or a list of its own. Everything is saved
 * by the form's one حفظ button, together, all or nothing.
 *
 * Every sale takes exactly these amounts × the quantity sold; a voided sale
 * puts them back; a remake takes them again. The cup's cost is the sum of the
 * lines at each ingredient's last purchase price — the cost the P&L uses. */
import { useState } from "react"
import Link from "next/link"
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"

import {
  fromBase,
  toBase,
  unitsFor,
  UNIT_LABEL,
  type BuyUnit,
  type InventoryItem,
  type RecipeLine,
} from "@/api/inventory"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatMoney, toNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { matches } from "@/lib/search"

export type Draft = { key: string; item: number | null; qty: string; unit: BuyUnit }

const key = () => Math.random().toString(36).slice(2)

export function toDraft(lines: RecipeLine[]): Draft[] {
  return lines.map((l) => ({
    key: key(),
    item: l.item,
    qty: fromBase(l.quantity, l.display_unit),
    unit: l.display_unit,
  }))
}

export const copyDraft = (lines: Draft[]): Draft[] => lines.map((d) => ({ ...d, key: key() }))

/** The cup's cost from these lines (ingredients with no purchase price count 0). */
export function draftCost(lines: Draft[], byId: Map<number, InventoryItem>): number {
  return lines.reduce((sum, d) => {
    const it = d.item != null ? byId.get(d.item) : undefined
    if (!it || it.unit_cost == null) return sum
    return sum + toBase(toNumber(d.qty), d.unit) * toNumber(it.unit_cost)
  }, 0)
}

/** Why these lines cannot be saved, or null. Checked before anything is sent. */
export function draftProblem(lines: Draft[], byId: Map<number, InventoryItem>): string | null {
  const seen = new Set<number>()
  for (const d of lines) {
    if (d.item == null) return "اختر صنفاً لكل مكوّن"
    const name = byId.get(d.item)?.name ?? "مكوّن"
    if (!(toNumber(d.qty) > 0)) return `${name}: اكتب كمية أكبر من صفر`
    if (seen.has(d.item)) return `${name} مكرر — اجمع الكمية في سطر واحد`
    seen.add(d.item)
  }
  return null
}

export const draftPayload = (lines: Draft[]) =>
  lines.map((d) => ({ item: d.item as number, quantity: String(toNumber(d.qty)), unit: d.unit }))

function ItemPicker({
  items,
  value,
  onChange,
}: {
  items: InventoryItem[]
  value: number | null
  onChange: (i: InventoryItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const current = items.find((i) => i.id === value)
  const shown = items.filter((i) => matches(i.name, q))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className={cn("h-9 w-full justify-between font-normal", !current && "text-muted-foreground")}>
            <span className="truncate" title={current?.name}>{current?.name ?? "اختر من المخزون"}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-80 min-w-(--anchor-width) max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="ابحث في المخزون…" />
          <CommandList>
            <CommandGroup>
              {shown.map((i) => (
                <CommandItem
                  key={i.id}
                  value={String(i.id)}
                  onSelect={() => {
                    onChange(i)
                    setOpen(false)
                    setQ("")
                  }}
                  className="gap-2"
                >
                  <Check className={cn("size-4 shrink-0", value === i.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{i.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{i.category}</span>
                </CommandItem>
              ))}
              {shown.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  لا يوجد. <Link href="/stock" className="text-primary hover:underline">أضفه في المخزون</Link>
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** One editable list of ingredients, with the cup's cost under it. */
export function Ingredients({
  items,
  lines,
  onChange,
  price,
  empty = "لا مكونات — لا يُخصم شيء من المخزون عند البيع.",
}: {
  items: InventoryItem[]
  lines: Draft[]
  onChange: (lines: Draft[]) => void
  /** Selling price, for the margin. */
  price: number
  empty?: string
}) {
  const byId = new Map(items.map((i) => [i.id, i]))
  const cost = draftCost(lines, byId)
  const edit = (k: string, p: Partial<Draft>) => onChange(lines.map((d) => (d.key === k ? { ...d, ...p } : d)))

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
        المخزون فارغ — أضف الأصناف (أكواب، حليب، بن…) من{" "}
        <Link href="/stock" className="font-semibold text-primary hover:underline">صفحة المخزون</Link> ثم ارجع هنا.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-border/80 bg-background">
      {lines.length === 0 ? (
        <p className="px-3 py-3 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {lines.map((d) => {
            const it = d.item != null ? byId.get(d.item) : undefined
            const units = it ? unitsFor(it.unit) : (["piece"] as BuyUnit[])
            const lineCost = it?.unit_cost != null ? toBase(toNumber(d.qty), d.unit) * toNumber(it.unit_cost) : null
            return (
              <li key={d.key} className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
                <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                  <ItemPicker
                    items={items}
                    value={d.item}
                    onChange={(i) => edit(d.key, { item: i.id, unit: unitsFor(i.unit)[0] })}
                  />
                </div>
                <Input
                  inputMode="decimal"
                  dir="ltr"
                  className="h-9 w-20 shrink-0 text-center"
                  value={d.qty}
                  onChange={(e) => edit(d.key, { qty: e.target.value })}
                  placeholder="0"
                  aria-label="الكمية"
                />
                <div className="flex shrink-0 gap-1">
                  {units.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        // Same amount, new unit: 0.2 l → 200 ml, not 0.2 ml.
                        const b = toBase(toNumber(d.qty), d.unit)
                        edit(d.key, { unit: u, qty: d.qty.trim() === "" ? "" : fromBase(b, u) })
                      }}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-[11px] font-semibold",
                        d.unit === u ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {UNIT_LABEL[u]}
                    </button>
                  ))}
                </div>
                <span
                  className="ms-auto w-16 shrink-0 text-end text-xs tabular-nums text-muted-foreground"
                  title={lineCost != null ? `${lineCost.toFixed(4)} ₪` : "لا سعر شراء بعد"}
                >
                  {lineCost != null ? formatMoney(lineCost) : "—"}
                </span>
                <button
                  type="button"
                  aria-label="حذف المكوّن"
                  onClick={() => onChange(lines.filter((x) => x.key !== d.key))}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-muted/40 px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={() => onChange([...lines, { key: key(), item: null, qty: "", unit: "piece" }])}
        >
          <Plus className="size-3.5" />
          مكوّن
        </Button>
        {lines.length ? (
          <span className="ms-auto flex items-center gap-2 text-xs">
            تكلفة المكونات <b className="tabular-nums" title={`${cost.toFixed(4)} ₪`}>{formatMoney(cost)}</b>
            {price > 0 && cost > 0 ? (
              <span className="text-muted-foreground">· يبقى من السعر {formatMoney(price - cost)}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  )
}
