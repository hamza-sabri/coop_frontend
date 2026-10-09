"use client"

/**
 * المنيو — every drink and sweet, as the customer sees it: photo, name, price.
 *
 *   [ابحث…] [الكل 32][قهوة 12][سموذي 6][حلويات 5]…          [ترتيب ▾]
 *   ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
 *   │ 📷   ││ 📷   ││ 📷   ││ 📷   ││ 📷   │   name · category
 *   │      ││      ││      ││      ││      │   ₪ price · يربح ₪ (owner)
 *   └──────┘└──────┘└──────┘└──────┘└──────┘
 *
 * A café menu is a few dozen items, so the whole menu is loaded once and the
 * chips and search are instant. Tapping a card opens the drink drawer; the ⋯
 * on a card holds the rarer actions. What the owner earns on each cup is said
 * as money ("يربح ٦٫٢٠ ₪"), never as a margin percentage.
 */
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Coffee, Layers, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"

import type { Product } from "@/api/generated/model"
import { productsList } from "@/api/generated/products/products"
import { ConfirmDelete } from "@/components/confirm-delete"
import { FilterChips, SearchBox } from "@/components/data-table"
import { Fab } from "@/components/fab"
import { DrinkForm } from "@/components/forms/drink-form"
import { NewCategoryDialog } from "@/components/pos/category-circles"
import { Enter, PageShell } from "@/components/page-shell"
import { SortMenu } from "@/components/sort-menu"
import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { ENDPOINTS, remove } from "@/lib/mutate"
import { cn } from "@/lib/utils"
import { matches } from "@/lib/search"

const NO_CATEGORY = "بلا تصنيف"

/** The whole menu, page by page (the API caps a page at 100). */
async function fetchMenu(): Promise<Product[]> {
  const all: Product[] = []
  for (let page = 1; page <= 20; page++) {
    const r = await productsList({ page, page_size: 100, ordering: "name" } as Parameters<typeof productsList>[0])
    const body = r.data as unknown as { results: Product[]; next: string | null }
    all.push(...body.results)
    if (!body.next) break
  }
  return all
}

const num = (v: unknown) => Number(v ?? 0) || 0
const profitOf = (p: Product) => num(p.price) - num(p.cost)

export default function MenuPage() {
  const qc = useQueryClient()
  const isOwner = useIsOwner()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [newCat, setNewCat] = useState(false)
  const [sort, setSort] = useState("category")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "menu"],
    queryFn: fetchMenu,
    placeholderData: (p) => p,
  })
  const items = useMemo(() => data ?? [], [data])

  // Chips in the order the menu is mostly made of: biggest category first.
  const cats = useMemo(() => {
    const n = new Map<string, number>()
    for (const p of items) {
      const c = p.category || NO_CATEGORY
      n.set(c, (n.get(c) ?? 0) + 1)
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [items])
  const catRank = useMemo(() => new Map(cats.map(([c], i) => [c, i])), [cats])

  const shown = useMemo(() => {
    const needle = q.trim()
    let list = items.filter(
      (p) => (cat === "all" || (p.category || NO_CATEGORY) === cat) && matches(`${p.name ?? ""} ${p.category ?? ""}`, needle),
    )
    list = [...list].sort((a, b) => {
      if (sort === "price") return num(b.price) - num(a.price)
      if (sort === "profit") return profitOf(b) - profitOf(a)
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "", "ar")
      const c = (catRank.get(a.category || NO_CATEGORY) ?? 0) - (catRank.get(b.category || NO_CATEGORY) ?? 0)
      return c || (a.name ?? "").localeCompare(b.name ?? "", "ar")
    })
    return list
  }, [items, cat, q, sort, catRank])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setFormOpen(true)
  }
  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(ENDPOINTS.products, toDelete.id)
      toast.success(`حُذف «${toDelete.name}» من المنيو`)
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["pos-catalog"] })
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  const sortOptions = [
    { value: "category", label: "حسب التصنيف" },
    { value: "name", label: "الاسم (أ–ي)" },
    { value: "price", label: "الأعلى سعراً" },
    ...(isOwner ? [{ value: "profit", label: "الأكثر ربحاً" }] : []),
  ]

  return (
    <PageShell
      title="المنيو"
      action={
        <Button size="sm" className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25" onClick={openAdd} data-tour="page-add">
          <Plus className="size-4" />
          صنف
        </Button>
      }
    >
      {/* Same toolbar as every table: search · chips · sort, one row. */}
      <Enter i={0}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 lg:flex">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث في المنيو…" />
          <div className="shrink-0 lg:order-last lg:ms-auto">
            <SortMenu value={sort} options={sortOptions} onChange={setSort} />
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-1">
            {cats.length > 1 ? (
              <FilterChips
                className="min-w-0"
                active={cat}
                onPick={setCat}
                chips={[{ id: "all", label: "الكل", count: items.length }, ...cats.map(([c, n]) => ({ id: c, label: c, count: n }))]}
              />
            ) : null}
            {/* Categories are made here (with their icon for the till), not on the till itself. */}
            <button
              type="button"
              onClick={() => setNewCat(true)}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
            >
              <Plus className="size-3.5" />
              تصنيف
            </button>
          </div>
        </div>
      </Enter>

      {isError && !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border bg-card">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center animate-in fade-in">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Coffee className="size-7" />
          </span>
          <p className="font-heading text-base font-bold">المنيو فارغ</p>
          <p className="max-w-sm text-sm text-muted-foreground">أضف أول مشروب: صورته، اسمه وسعره — ويظهر فوراً في شاشة البيع.</p>
          <Button className="bg-brand-gradient mt-1 gap-1.5" onClick={openAdd}>
            <Plus className="size-4" />
            أضف أول صنف
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground animate-in fade-in">
          لا صنف يطابق «{q}».
        </p>
      ) : (
        <div key={`${cat}|${sort}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {shown.map((p, i) => (
            <MenuCard
              key={p.id}
              p={p}
              i={i}
              isOwner={isOwner}
              onOpen={() => openEdit(p)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}

      <Fab onClick={openAdd} label="إضافة صنف" />
      <DrinkForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onDelete={(p) => {
          setFormOpen(false)
          setToDelete(p)
        }}
      />
      <NewCategoryDialog open={newCat} onOpenChange={setNewCat} />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={toDelete ? `حذف «${toDelete.name}» من المنيو؟` : "حذف الصنف"}
        description="يختفي من شاشة البيع. الفواتير السابقة التي فيه تبقى كما هي."
      />
    </PageShell>
  )
}

function MenuCard({
  p,
  i,
  isOwner,
  onOpen,
  onDelete,
}: {
  p: Product
  i: number
  isOwner: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const price = num(p.price)
  const cost = num(p.cost)
  const profit = price - cost
  const sizes = (p.variants ?? []).filter((v) => v.is_active !== false).length
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-start shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300"
      style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-soft">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid size-full place-items-center">
            <Coffee className="size-10 text-primary/35" />
          </span>
        )}
        {sizes > 0 ? (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
            <Layers className="size-3" />
            {formatNumber(sizes)} {sizes === 1 ? "حجم" : "أحجام"}
          </span>
        ) : null}
        <div className="absolute end-2 top-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`خيارات ${p.name}`}
                  className="grid size-8 place-items-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-card"
                >
                  <MoreVertical className="size-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onOpen}>
                <Pencil className="size-4" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.category || NO_CATEGORY}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="font-heading text-lg font-bold leading-none text-primary tabular-nums">{formatMoney(price)}</span>
          {/* What a cup earns, in money. Cost is owner-only — absent for staff. */}
          {isOwner && cost > 0 && price > 0 ? (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                profit > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600",
              )}
              title={`التكلفة ${formatMoney(cost)}`}
            >
              {profit > 0 ? `يربح ${formatMoney(profit)}` : `يخسر ${formatMoney(-profit)}`}
            </span>
          ) : isOwner && price > 0 ? (
            <span className="text-[11px] text-muted-foreground">بلا تكلفة</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
