"use client"

/* The one table every list in the app uses (DESIGN.md §2).
 *
 *   [ابحث…            ] [الكل 19][يحتاج طلب 3][الصلاحية 4]        [extra]
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ الصنف ▾           الكمية        يكفي          القيمة             │
 *   │ …rows fade in one after another…                                 │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Header and body cells share one class per column, so a title can never
 * drift away from the numbers under it. On the phone every row becomes a
 * compact two-line row (`mobileRow`), never a squeezed table.
 *
 * Client mode (default): give it every row; it searches, filters, sorts and
 * shows 60 at a time. Server mode: pass `manual` and drive search, filter and
 * sort yourself (the sales list has ten thousand rows). */
import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { matches } from "@/lib/search"

export type Align = "start" | "end" | "center"

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: Align
  /** A Tailwind width for the column, e.g. "w-32". The name column omits it. */
  width?: string
  /** Makes the header sortable (client mode) — the value to sort by. */
  sort?: (row: T) => number | string
  /** Hide on narrower desktops; the phone always uses `mobileRow`. */
  hideBelow?: "lg" | "xl"
  className?: string
}

export type TableFilter<T> = {
  id: string
  label: string
  /** Client mode: which rows this chip keeps. Omit for "everything". */
  test?: (row: T) => boolean
  /** Server mode: the count to show on the chip. */
  count?: number
  /** Colours the count when it is not zero — a call to look. */
  tone?: "bad" | "warn"
}

export type SortState = { key: string; dir: "asc" | "desc" }

const ALIGN: Record<Align, string> = { start: "text-start", end: "text-end", center: "text-center" }
const HIDE = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" }
const PAGE = 60

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  searchText,
  searchPlaceholder = "ابحث…",
  filters,
  defaultSort,
  mobileRow,
  toolbar,
  loading,
  empty = "لا شيء هنا بعد",
  footer,
  manual,
  rowClassName,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** Client search: the text a row is found by. Omit to hide the search box (unless manual). */
  searchText?: (row: T) => string
  searchPlaceholder?: string
  filters?: TableFilter<T>[]
  defaultSort?: SortState
  /** The phone's version of a row: two short lines. */
  mobileRow: (row: T) => ReactNode
  /** Extra controls at the end of the toolbar (period picker, sort menu…). */
  toolbar?: ReactNode
  loading?: boolean
  empty?: ReactNode
  /** Under the table — e.g. a LoadMore in server mode. */
  footer?: ReactNode
  /** Server mode: you own search / filter / sort. */
  manual?: {
    search?: string
    onSearch?: (s: string) => void
    filter?: string
    onFilter?: (id: string) => void
    sort?: SortState
    onSort?: (s: SortState) => void
  }
  rowClassName?: (row: T) => string | undefined
  className?: string
}) {
  const [qLocal, setQLocal] = useState("")
  const [fLocal, setFLocal] = useState(filters?.[0]?.id ?? "")
  const [sLocal, setSLocal] = useState<SortState | undefined>(defaultSort)
  const [shown, setShown] = useState(PAGE)

  const q = manual?.search ?? qLocal
  const setQ = manual?.onSearch ?? setQLocal
  const f = manual?.filter ?? fLocal
  const setF = manual?.onFilter ?? setFLocal
  const s = manual?.sort ?? sLocal
  const setS = manual?.onSort ?? setSLocal
  const hasSearch = Boolean(searchText || manual?.onSearch)

  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const fl of filters ?? []) {
      // Server mode shows only counts it was given; client mode counts itself.
      if (fl.count != null) out[fl.id] = fl.count
      else if (!manual) out[fl.id] = fl.test ? rows.filter(fl.test).length : rows.length
    }
    return out
  }, [filters, rows, manual])

  const visible = useMemo(() => {
    if (manual) return rows
    let list = rows
    const active = filters?.find((x) => x.id === f)
    if (active?.test) list = list.filter(active.test)
    const needle = q.trim()
    if (needle && searchText) list = list.filter((r) => matches(searchText(r), needle))
    const col = s ? columns.find((c) => c.key === s.key) : undefined
    if (col?.sort) {
      const get = col.sort
      list = [...list].sort((a, b) => {
        const x = get(a)
        const y = get(b)
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ar")
        return s!.dir === "asc" ? c : -c
      })
    }
    return list
  }, [manual, rows, filters, f, q, searchText, s, columns])

  const page = manual ? visible : visible.slice(0, shown)
  // Chips worth showing: not empty (except "all" and the chosen one). One
  // chip alone is not a choice, so then there is no chip row at all.
  const chips = (filters ?? []).filter((fl, idx) => !(counts[fl.id] === 0 && idx > 0 && f !== fl.id))
  // …and a chip that keeps every row ("يعملون 5" of 5) says nothing either.
  const total = counts[chips[0]?.id ?? ""]
  const showChips =
    chips.length > 1 &&
    (manual || f !== chips[0]?.id || chips.slice(1).some((c) => counts[c.id] == null || counts[c.id] !== total))
  const cellCls = (c: Column<T>) =>
    cn("px-3 py-3 first:ps-4 last:pe-4", ALIGN[c.align ?? "start"], c.width, c.hideBelow && HIDE[c.hideBelow], c.className)

  function toggleSort(c: Column<T>) {
    if (!c.sort && !manual?.onSort) return
    const dir: SortState["dir"] = s?.key === c.key && s.dir === "desc" ? "asc" : "desc"
    setS({ key: c.key, dir })
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border/80 bg-card", className)}>
      {hasSearch || showChips || toolbar ? (
        <div
          className={cn(
            "grid items-center gap-2 border-b border-border/70 p-3 lg:flex",
            hasSearch && toolbar ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1",
          )}
        >
          {hasSearch ? (
            <SearchBox
              value={q}
              placeholder={searchPlaceholder}
              onChange={(v) => {
                setQ(v)
                setShown(PAGE)
              }}
            />
          ) : null}
          {showChips ? (
            <FilterChips
              className={cn(hasSearch && toolbar && "col-span-2", "lg:order-none")}
              chips={chips.map((fl) => ({ id: fl.id, label: fl.label, count: counts[fl.id], tone: fl.tone }))}
              active={f}
              onPick={(id) => {
                setF(id)
                setShown(PAGE)
              }}
            />
          ) : null}
          {/* On the phone the extra controls sit beside the search box (row one)
              and the chips get row two — nothing is left alone on a line. */}
          {toolbar ? (
            <div className={cn("flex shrink-0 items-center gap-2 lg:order-last lg:ms-auto", hasSearch && "order-first col-start-2 row-start-1")}>
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : page.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground animate-in fade-in">{empty}</div>
      ) : (
        <>
          {/* desktop */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border/70 text-xs text-muted-foreground">
                {columns.map((c) => {
                  const sortable = Boolean(c.sort || manual?.onSort)
                  const on = s?.key === c.key
                  return (
                    <th key={c.key} scope="col" className={cn(cellCls(c), "py-2.5 font-medium")}>
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground",
                            on && "font-semibold text-foreground",
                          )}
                        >
                          {c.header}
                          {on ? (
                            s!.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {page.map((r, i) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(
                    "transition-colors animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300",
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                    rowClassName?.(r),
                  )}
                  style={{ animationDelay: `${Math.min(i, 15) * 22}ms` }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cellCls(c)}>
                      {c.cell(r, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* phone */}
          <ul className="divide-y divide-border/60 md:hidden">
            {page.map((r, i) => (
              <li
                key={rowKey(r)}
                className={cn("animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300", rowClassName?.(r))}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(r)} className="block w-full px-4 py-3 text-start active:bg-muted/50">
                    {mobileRow(r)}
                  </button>
                ) : (
                  <div className="px-4 py-3">{mobileRow(r)}</div>
                )}
              </li>
            ))}
          </ul>

          {!manual && visible.length > shown ? (
            <div className="border-t border-border/60 p-3 text-center">
              <button
                type="button"
                onClick={() => setShown((x) => x + PAGE)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                عرض المزيد ({formatNumber(visible.length - shown)})
              </button>
            </div>
          ) : null}
        </>
      )}
      {footer}
    </section>
  )
}

/** The search box every list uses — same height, same icon, same clear button. */
export function SearchBox({
  value,
  onChange,
  placeholder = "ابحث…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative lg:w-72", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-10 rounded-xl ps-9 pe-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <button
          type="button"
          aria-label="مسح البحث"
          onClick={() => onChange("")}
          className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** A row of choices with counts — scrolls sideways on a phone, never wraps. */
export function FilterChips({
  chips,
  active,
  onPick,
  className,
}: {
  chips: { id: string; label: string; count?: number; tone?: "bad" | "warn" }[]
  active: string
  onPick: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} role="tablist">
      {chips.map((fl) => {
        const on = active === fl.id
        const n = fl.count
        return (
          <button
            key={fl.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(fl.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {fl.label}
            {n == null ? null : (
              <span
                className={cn(
                  "min-w-5 rounded-md px-1 text-[10px] tabular-nums",
                  on
                    ? "bg-primary-foreground/20"
                    : fl.tone === "bad" && n
                      ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                      : fl.tone === "warn" && n
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        : "bg-muted",
                )}
              >
                {formatNumber(n)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
