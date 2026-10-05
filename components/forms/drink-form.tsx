"use client"

/* ==========================================================================
   Adding or editing a drink.

   The form this replaces was a supermarket catalogue row: barcode, alternate
   barcodes, expiry date, expiry alert window, manufacturer, brand, a custom
   attributes editor, a product video — with the two things a café actually
   changes (the price and the sizes) split across an "extras" accordion and a
   SECOND dialog for variants.

   What a café changes, in the order it changes it: the picture, the name, what
   it costs, and which sizes and flavours it comes in and what each one adds to
   the price. So that is the form, all of it on one surface — no accordion, no
   second dialog, nothing to scroll past that belongs to a different kind of
   shop.

   Sizes and flavours are ProductVariants underneath, which store an ABSOLUTE
   price. The row can be typed either way — "١٦ ₪" or "+٣" — and the mode is
   remembered on the variant's `attributes`, so reopening the form shows the
   number the owner typed rather than the number the database happens to hold.
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Coffee, Copy, ImagePlus, Loader2, Milk, Plus, RotateCcw, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { FormModal } from "@/components/form-modal"
import { TaxonomyCombobox } from "@/components/taxonomy-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ENDPOINTS, upsert } from "@/lib/mutate"
import {
  createVariant,
  deleteVariant,
  listVariants,
  updateVariant,
  type Variant,
} from "@/api/variants"
import { useIsOwner } from "@/lib/modules"
import { businessToday } from "@/lib/period"
import { PeriodBar, type PeriodState } from "@/components/finance/period-bar"
import { ItemReport } from "@/components/reports/item-report"
import {
  copyDraft,
  draftPayload,
  draftProblem,
  Ingredients,
  toDraft,
  type Draft,
} from "@/components/forms/recipe-editor"
import { getRecipe, listItems, saveRecipes, type InventoryItem } from "@/api/inventory"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { cn } from "@/lib/utils"
import type { Product } from "@/api/generated/model"

type Kind = "size" | "flavour" | "pack"
type PriceMode = "abs" | "delta"

/** One size / flavour / box, as the form holds it. */
type Option = {
  key: string
  /** Present when it already exists on the server. */
  id?: number
  label: string
  kind: Kind
  mode: PriceMode
  /** Whatever the owner typed — an absolute price, or an amount to add. */
  amount: string
  /** Pieces in the box. Only meaningful when kind === "pack". */
  pieces: string
  stock: string
  active: boolean
  /** What this option costs to make. Blank = same as the drink's cost. */
  cost: string
  /** Has ingredients of its own; otherwise it uses the drink's. */
  own: boolean
  lines: Draft[]
  /** The ingredients panel is unfolded. */
  open: boolean
}


const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

function num(v: string): number {
  const n = Number(String(v).replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Absolute price for a row, given the drink's base price. */
function resolvePrice(o: Option, base: number): number {
  // A blank price means "same as the drink" — exactly what the grey hint says.
  if (o.amount.trim() === "") return base > 0 ? base : 0
  const v = num(o.amount)
  const p = o.mode === "delta" ? base + v : v
  return p > 0 ? p : 0
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** What one cup earns, as the owner says it: "يربح 11.90 ₪ في الكوب".
 *  The colour still tells good from thin, without the word "margin". */
function MarginPill({ price, cost }: { price: number; cost: number }) {
  if (!(price > 0) || !(cost > 0)) return null
  const profit = price - cost
  const pct = (profit / price) * 100
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        pct >= 60
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : pct >= 40
            ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            : "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      )}
    >
      {profit > 0 ? `يربح ${profit.toFixed(2)} ₪ في الكوب` : `يخسر ${(-profit).toFixed(2)} ₪ في الكوب`}
    </span>
  )
}

/* ── the picture ─────────────────────────────────────────────────────────── */

function DrinkPhoto({
  url,
  file,
  onPick,
  onClear,
}: {
  url: string
  file: File | null
  onPick: (f: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const preview = file ? URL.createObjectURL(file) : url

  useEffect(() => {
    return () => {
      if (file && preview.startsWith("blob:")) URL.revokeObjectURL(preview)
    }
  }, [file, preview])

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = Array.from(e.dataTransfer.files).find((x) =>
          x.type.startsWith("image/"),
        )
        if (f) onPick(f)
      }}
      className={cn(
        "relative grid aspect-square w-full place-items-center overflow-hidden rounded-3xl border-2 border-dashed bg-muted/40 transition",
        over && "border-primary bg-primary/5",
      )}
    >
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="size-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label="إزالة الصورة"
            className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-background/90 shadow"
          >
            <X className="size-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 p-6 text-muted-foreground"
        >
          <ImagePlus className="size-8" />
          <span className="text-xs">صورة المشروب</span>
          <span className="text-[11px]">اسحب الصورة أو اضغط للاختيار</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ""
        }}
      />
      {preview && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="absolute bottom-2 start-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow"
        >
          تغيير
        </button>
      )}
    </div>
  )
}

/* ── one option row ──────────────────────────────────────────────────────── */

/* ── sizes & flavours: one table, edited in place ─────────────────────────
 *
 *   الاسم      السعر     التكلفة    يربح    متوفر
 *   الأحجام
 *   صغير       10.00     3.20       6.80     ●
 *   وسط        12.00     3.90       8.10     ●
 *   ＋ حجم
 *   النكهات — بزيادة على السعر الأساسي
 *   فانيلا     +2.00     —          …        ●
 *   ＋ نكهة
 *
 * Every price in one glance, Tab from cell to cell. A size is typed as its
 * full price; a flavour as what it adds to the drink's base price. A blank
 * cost means "same as the drink". Ingredients per option stay on the
 * المكونات tab. On a phone each option folds into two lines. */
const PRESET_SIZES = ["صغير", "وسط", "كبير"]

function OptionsTable({
  options,
  base,
  baseCost,
  showCost,
  onPatch,
  onAdd,
  onRemove,
}: {
  options: Option[]
  base: number
  baseCost: number
  showCost: boolean
  onPatch: (key: string, p: Partial<Option>) => void
  onAdd: (kind: Kind, label?: string) => void
  onRemove: (key: string) => void
}) {
  const sizes = options.filter((o) => o.kind !== "flavour")
  const flavours = options.filter((o) => o.kind === "flavour")
  // Desktop columns: name · price · cost · profit · available · delete
  const cols = showCost
    ? "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_3rem_2rem]"
    : "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3rem_2rem]"

  if (options.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-sm text-muted-foreground">بلا أحجام — يُباع بالسعر الأساسي{base > 0 ? ` (${base.toFixed(2)} ₪)` : ""}.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => PRESET_SIZES.forEach((l) => onAdd("size", l))}
          >
            <Plus className="size-3.5" />
            صغير · وسط · كبير
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAdd("size")}>
            <Plus className="size-3.5" />
            حجم
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAdd("flavour")}>
            <Plus className="size-3.5" />
            نكهة
          </Button>
        </div>
      </div>
    )
  }

  const group = (title: React.ReactNode, rows: Option[], kind: Kind, addLabel: string) => (
    <>
      <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{title}</div>
      {rows.map((o) => (
        <OptionLine
          key={o.key}
          o={o}
          base={base}
          baseCost={baseCost}
          showCost={showCost}
          cols={cols}
          onChange={(p) => onPatch(o.key, p)}
          onRemove={() => onRemove(o.key)}
        />
      ))}
      <button
        type="button"
        onClick={() => onAdd(kind)}
        className="flex w-full items-center gap-1 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </button>
    </>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <div className={cn("hidden items-center gap-2 bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:grid", cols)}>
        <span>الاسم</span>
        <span>السعر (₪)</span>
        {showCost ? <span>التكلفة (₪)</span> : null}
        {showCost ? <span className="text-end">يربح</span> : null}
        <span className="text-center">متوفر</span>
        <span />
      </div>
      <div className="divide-y divide-border/60">
        {group("الأحجام", sizes, "size", "حجم")}
        {group(
          <>
            النكهات <span className="font-normal">— بزيادة على السعر الأساسي{base > 0 ? ` (${base.toFixed(2)} ₪)` : ""}</span>
          </>,
          flavours,
          "flavour",
          "نكهة",
        )}
      </div>
    </div>
  )
}

function OptionLine({
  o,
  base,
  baseCost,
  showCost,
  cols,
  onChange,
  onRemove,
}: {
  o: Option
  base: number
  baseCost: number
  showCost: boolean
  cols: string
  onChange: (patch: Partial<Option>) => void
  onRemove: () => void
}) {
  const resolved = resolvePrice(o, base)
  const cost = o.cost.trim() !== "" ? num(o.cost) : baseCost
  const profit = resolved - cost
  const cell =
    "h-9 w-full min-w-0 rounded-lg border border-border/70 bg-card px-2.5 text-sm transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200",
        cols,
        !o.active && "bg-muted/30",
      )}
    >
      <input
        value={o.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder={o.kind === "flavour" ? "فانيلا" : "كبير"}
        aria-label="الاسم"
        autoFocus={!o.id && !o.label}
        className={cn(cell, "order-1 col-span-2 font-semibold sm:order-none sm:col-span-1", !o.active && "text-muted-foreground")}
      />
      {/* Price: the full price of a size, or what a flavour adds (+). The
          little sign switches between the two for the odd exception. */}
      <div className={cn("order-4 flex min-w-0 items-stretch sm:order-none sm:col-span-1", showCost ? "col-span-2" : "col-span-4")}>
        <button
          type="button"
          onClick={() => onChange({ mode: o.mode === "abs" ? "delta" : "abs" })}
          title={o.mode === "abs" ? "السعر كاملاً — اضغط لتكتب زيادة على السعر الأساسي" : "زيادة على السعر الأساسي — اضغط لتكتب السعر كاملاً"}
          className="grid w-8 shrink-0 place-items-center rounded-s-lg border border-e-0 border-border/70 bg-muted text-xs font-bold text-muted-foreground"
        >
          {o.mode === "abs" ? "₪" : "+"}
        </button>
        <input
          inputMode="decimal"
          dir="ltr"
          value={o.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder={o.mode === "abs" ? (base > 0 ? base.toFixed(2) : "0") : "0"}
          aria-label="السعر"
          title={o.mode === "delta" ? `= ${resolved.toFixed(2)} ₪` : undefined}
          className={cn(cell, "rounded-s-none text-end tabular-nums")}
        />
      </div>
      {showCost ? (
        <input
          inputMode="decimal"
          dir="ltr"
          value={o.cost}
          onChange={(e) => onChange({ cost: e.target.value })}
          placeholder={baseCost > 0 ? baseCost.toFixed(2) : "0"}
          aria-label="التكلفة"
          title="تكلفة كوب بهذا الخيار — فارغة = تكلفة المشروب"
          className={cn(cell, "order-5 col-span-2 text-end tabular-nums sm:order-none sm:col-span-1")}
        />
      ) : null}
      {showCost ? (
        <span
          className={cn(
            "hidden text-end text-xs font-semibold tabular-nums sm:block",
            !(resolved > 0) || !(cost > 0) ? "text-muted-foreground" : profit > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600",
          )}
        >
          {resolved > 0 && cost > 0 ? profit.toFixed(2) : "—"}
        </span>
      ) : null}
      <div className="order-2 flex items-center justify-center sm:order-none">
        <Switch
          checked={o.active}
          onCheckedChange={(v) => onChange({ active: Boolean(v) })}
          aria-label={o.active ? "متوفر — أطفئه لإخفائه من البيع" : "مخفي من البيع"}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف"
        title="حذف"
        className="order-3 grid size-8 place-items-center justify-self-end rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:order-none"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/** A folding section: closed by default, says what is inside when closed. */
function Fold({
  title,
  summary,
  open,
  onToggle,
  action,
  children,
}: {
  title: string
  summary?: React.ReactNode
  open: boolean
  onToggle: () => void
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/80">
      <div className="flex items-center gap-2 px-3.5 py-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-start">
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", !open && "rotate-90")} />
          <span className="font-heading text-sm font-bold">{title}</span>
          {summary ? <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span> : null}
        </button>
        {action}
      </div>
      {open ? <div className="border-t border-border/60 p-3 animate-in fade-in duration-200">{children}</div> : null}
    </section>
  )
}

/** One option's ingredients on the المكونات tab: the drink's, or its own. */
function OptionIngredients({
  o,
  price,
  items,
  baseLines,
  onChange,
}: {
  o: Option
  price: number
  items: InventoryItem[]
  baseLines: Draft[]
  onChange: (patch: Partial<Option>) => void
}) {
  const own = o.own || baseLines.length === 0
  return (
    <section className="rounded-2xl border border-border/80 p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h5 className="text-sm font-bold">{o.label}</h5>
        {o.own && baseLines.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ own: false, lines: [] })}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            مثل المشروب
          </button>
        ) : null}
      </header>
      {own ? (
        <Ingredients
          items={items}
          lines={o.lines}
          price={price}
          onChange={(lines) => onChange({ own: true, lines })}
          empty={`ما يأخذه «${o.label}» من المخزون — كوب، حليب، بن…`}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">نفس مكونات المشروب ({baseLines.length})</span>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={() => onChange({ own: true, lines: copyDraft(baseLines) })}>
            <Copy className="size-3.5" />
            مكونات خاصة
          </Button>
        </div>
      )}
    </section>
  )
}

/* ── the form ────────────────────────────────────────────────────────────── */

export function DrinkForm({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product?: Product | null
}) {
  const qc = useQueryClient()
  const editing = Boolean(product)
  const isOwner = useIsOwner()
  const [cost, setCost] = useState("")
  const today = businessToday()
  const [tab, setTab] = useState<"info" | "ingredients" | "report">("info")
  const [showOptions, setShowOptions] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [period, setPeriod] = useState<PeriodState>({ period: "month", anchor: today, shiftId: null })
  const showReport = editing && isOwner && product?.id != null
  // Ingredients are the owner's (they are cost). Loaded once per opening and
  // merged into the form; saved with everything else by حفظ.
  const recipeQ = useQuery({
    queryKey: ["recipe", product?.id],
    queryFn: () => getRecipe(product!.id as number).then((r) => r.data),
    enabled: open && isOwner && product?.id != null,
    staleTime: 0,
  })
  const invQ = useQuery({
    queryKey: ["inventory", "items"],
    queryFn: () => listItems(),
    enabled: open && isOwner,
    staleTime: 60_000,
  })
  const items = invQ.data ?? []
  const byId = new Map(items.map((i) => [i.id, i]))
  const [baseLines, setBaseLines] = useState<Draft[]>([])
  const [optsReady, setOptsReady] = useState(false)
  /** The server's recipe has been merged in (or there is none to merge). */
  const [recipeReady, setRecipeReady] = useState(false)
  const recipeTouched = useRef(false)

  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [available, setAvailable] = useState(true)
  const [imageUrl, setImageUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [saving, setSaving] = useState(false)
  const removed = useRef<number[]>([])

  const loadOptions = useCallback(async (productId: number) => {
    try {
      const res = await listVariants(productId)
      const rows = res.data.results ?? []
      setOptions(
        rows.map((v: Variant) => {
          const attrs = (v.attributes ?? {}) as Record<string, unknown>
          const kind = (attrs.kind as Kind) ?? (v.pack_size ? "pack" : "size")
          const mode = (attrs.price_mode as PriceMode) ?? "abs"
          const delta = typeof attrs.delta === "string" ? attrs.delta : ""
          return {
            key: newKey(),
            id: v.id,
            label: v.label,
            kind,
            mode,
            amount: mode === "delta" ? delta : String(Number(v.price ?? 0)),
            pieces: v.pack_size ? String(Number(v.pack_size)) : "",
            stock: String(Number(v.stock ?? 0)),
            active: v.is_active !== false,
            cost:
              (v as { cost?: string | null }).cost != null && Number((v as { cost?: string }).cost) > 0
                ? String(Number((v as { cost?: string }).cost))
                : "",
            own: false,
            lines: [],
            open: false,
          }
        }),
      )
    } catch {
      // A drink with no options is the normal case; a failed fetch should not
      // block editing the name and the price.
      setOptions([])
    } finally {
      setOptsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setTab("info")
    setShowOptions(false)
    setShowNotes(false)
    removed.current = []
    recipeTouched.current = false
    setBaseLines([])
    setOptsReady(false)
    setRecipeReady(!product)
    if (product) {
      setName(product.name ?? "")
      setCategory(product.category ?? "")
      setPrice(product.price ?? "")
      setCost(
        (product as { cost?: string | null }).cost != null && Number((product as { cost?: string }).cost) > 0
          ? String(Number((product as { cost?: string }).cost))
          : "",
      )
      setNotes(product.notes ?? "")
      setAvailable((product as unknown as { is_active?: boolean }).is_active !== false)
      setImageUrl(product.image ?? "")
      setImageFile(null)
      if (product.id != null) void loadOptions(product.id)
    } else {
      setName("")
      setCategory("")
      setPrice("")
      setCost("")
      setNotes("")
      setAvailable(true)
      setImageUrl("")
      setImageFile(null)
      setOptions([])
      setOptsReady(true)
    }
  }, [open, product, loadOptions])

  // Merge the saved ingredients into the form once both halves have arrived.
  useEffect(() => {
    if (!open || recipeReady || !optsReady || !recipeQ.data || recipeQ.isFetching) return
    const r = recipeQ.data
    setBaseLines(toDraft(r.base))
    setOptions((prev) =>
      prev.map((o) => {
        const v = r.variants.find((x) => x.id === o.id)
        return v?.own ? { ...o, own: true, lines: toDraft(v.lines) } : o
      }),
    )
    setRecipeReady(true)
  }, [open, recipeReady, optsReady, recipeQ.data, recipeQ.isFetching])

  const base = num(price)

  function patch(key: string, p: Partial<Option>) {
    if ("lines" in p || "own" in p) recipeTouched.current = true
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...p } : o)))
  }

  function addOption(kind: Kind, label = "") {
    setOptions((prev) => [
      ...prev,
      {
        key: newKey(),
        label,
        kind,
        mode: kind === "flavour" ? "delta" : "abs",
        amount: "",
        pieces: "",
        stock: "",
        active: true,
        cost: "",
        own: false,
        lines: [],
        open: false,
      },
    ])
  }

  function removeOption(key: string) {
    setOptions((prev) => {
      const hit = prev.find((o) => o.key === key)
      if (hit?.id != null) removed.current.push(hit.id)
      return prev.filter((o) => o.key !== key)
    })
  }

  async function save() {
    if (!name.trim()) {
      toast.error("أدخل اسم المشروب")
      return
    }
    // Ingredients are checked before anything is written, so a bad line never
    // leaves a drink saved without its recipe.
    const saveIngredients = isOwner && recipeReady && recipeTouched.current
    if (saveIngredients) {
      const problem =
        draftProblem(baseLines, byId) ??
        options
          .filter((o) => o.label.trim() && o.own)
          .map((o) => {
            const e = draftProblem(o.lines, byId)
            return e ? `${o.label.trim()}: ${e}` : null
          })
          .find(Boolean) ??
        null
      if (problem) {
        toast.error(problem)
        return
      }
    }
    setSaving(true)
    try {
      const res = (await upsert(
        ENDPOINTS.products,
        product?.id,
        {
          name: name.trim(),
          category: category.trim(),
          price: price.trim() || "0",
          // Only the owner sees or sends cost; the server ignores it from
          // anyone else regardless.
          ...(isOwner ? { cost: cost.trim() ? num(cost).toFixed(2) : "0" } : {}),
          notes: notes.trim(),
          is_active: available,
          image: imageFile ? undefined : imageUrl.trim(),
        },
        { image_file: imageFile ?? undefined },
      )) as { data?: { id?: number } }

      const productId = product?.id ?? res?.data?.id
      const versionIds = new Map<string, number>()
      if (productId != null) {
        // Options are separate rows, so they are reconciled separately: the
        // deleted ones first (a label freed up before it is reused), then the
        // rest in order.
        for (const id of removed.current) {
          try {
            await deleteVariant(id)
          } catch {
            /* already gone */
          }
        }
        for (const o of options) {
          const label = o.label.trim()
          if (!label) continue
          const body = {
            product: productId,
            label,
            price: resolvePrice(o, base).toFixed(2),
            stock: o.stock === "" ? "0" : String(num(o.stock)),
            is_active: o.active,
            ...(isOwner ? { cost: o.cost.trim() ? num(o.cost).toFixed(2) : "0" } : {}),
            pack_size:
              o.kind === "pack" && num(o.pieces) > 0
                ? String(num(o.pieces))
                : null,
            attributes: {
              kind: o.kind,
              price_mode: o.mode,
              // Kept so reopening the form shows "+3" and not "19.00".
              delta: o.mode === "delta" ? String(num(o.amount)) : "",
            },
          }
          if (o.id != null) {
            await updateVariant(o.id, body)
            versionIds.set(o.key, o.id)
          } else {
            const made = (await createVariant(body)) as { data?: { id?: number } }
            if (made?.data?.id != null) versionIds.set(o.key, made.data.id)
          }
        }

        if (saveIngredients) {
          try {
            await saveRecipes(productId, [
              { variant: null, lines: draftPayload(baseLines) },
              ...options
                .filter((o) => versionIds.has(o.key))
                .map((o) => ({
                  variant: versionIds.get(o.key) as number,
                  lines: o.own ? draftPayload(o.lines) : [],
                })),
            ])
            qc.invalidateQueries({ queryKey: ["recipe", productId] })
            qc.invalidateQueries({ queryKey: ["reports"] })
          } catch (e) {
            toast.error(`حُفظ المشروب، لكن لم تُحفظ المكونات: ${e instanceof Error ? e.message : ""}`)
            qc.invalidateQueries({ queryKey: ["products"] })
            return
          }
        }
      }

      toast.success(editing ? "تم تحديث المشروب" : "تمت إضافة المشروب")
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["variants"] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "تعديل مشروب" : "إضافة مشروب"}
      icon={<Coffee className="size-4.5" />}
      footer={
        tab === "report" ? (
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        ) : (
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={saving}
            data-form-primary
            onClick={() => void save()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </>
        )
      }
    >
      {/* Three places, simplest first: what the drink IS (and what it costs
          — the owner's number), what one cup takes from the shelf, and how it
          sells. Ingredients and reports are the owner's. */}
      {isOwner ? (
        <SegmentedTabs
          tabs={[
            { id: "info", label: "الأساسية" },
            { id: "ingredients", label: "المكونات" },
            ...(showReport ? [{ id: "report", label: "التقارير" }] : []),
          ]}
          active={tab}
          onChange={(t) => setTab(t as "info" | "ingredients" | "report")}
        />
      ) : null}

      {tab === "report" && showReport && product?.id != null ? (
        <div key="report" className="stagger space-y-3">
          <PeriodBar value={period} onChange={setPeriod} today={today} />
          <ItemReport productId={product.id} q={{ period: period.period, date: period.anchor }} />
        </div>
      ) : tab === "ingredients" && isOwner ? (
        <div key="ingredients" className="stagger space-y-3">
          <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            ما يأخذه كوب واحد من المخزون. كل بيعة تخصم هذه الكميات، والإلغاء يعيدها. لا تغيّر التكلفة — التكلفة تكتبها أنت في الأساسية.
          </p>
          {!recipeReady ? (
            <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <section>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Milk className="size-4 text-muted-foreground" />
                  {name.trim() || "المشروب"}
                </h4>
                <Ingredients
                  items={items}
                  lines={baseLines}
                  price={base}
                  onChange={(l) => {
                    recipeTouched.current = true
                    setBaseLines(l)
                  }}
                />
              </section>
              {options.some((o) => o.label.trim()) ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">الأحجام والنكهات</p>
                  {options
                    .filter((o) => o.label.trim())
                    .map((o) => (
                      <OptionIngredients
                        key={o.key}
                        o={o}
                        price={resolvePrice(o, base)}
                        items={items}
                        baseLines={baseLines}
                        onChange={(p) => patch(o.key, p)}
                      />
                    ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
      <div key="info" className="stagger space-y-3">
      <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
        {/* the picture, and whether it is on the menu at all */}
        <div className="flex flex-col gap-3">
          <DrinkPhoto
            url={imageUrl}
            file={imageFile}
            onPick={(f) => setImageFile(f)}
            onClear={() => {
              setImageFile(null)
              setImageUrl("")
            }}
          />
          <label className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5">
            <span className="text-sm font-medium">في المنيو</span>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </label>
        </div>

        {/* the drink itself */}
        <div className="flex flex-col gap-3.5">
          <Field label="الاسم">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="لاتيه" />
          </Field>

          <div className={cn("grid gap-3", isOwner ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
            <Field label="السعر (₪)">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </Field>
            {isOwner ? (
              <Field label="التكلفة (₪)">
                <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </Field>
            ) : null}
            <div className={cn(isOwner && "col-span-2 sm:col-span-1")}>
              <Field label="التصنيف">
                <TaxonomyCombobox kind="categories" value={category} onChange={setCategory} placeholder="قهوة ساخنة" />
              </Field>
            </div>
          </div>

          {isOwner && num(cost) > 0 && base > 0 ? (
            <div className="-mt-1">
              <MarginPill price={base} cost={num(cost)} />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── folded: sizes & flavours, description ─────────────────────── */}
      <Fold
        title="الأحجام والنكهات"
        summary={
          options.length
            ? options.map((o) => o.label.trim()).filter(Boolean).join("، ") || `${options.length}`
            : "بلا — بالسعر الأساسي"
        }
        open={showOptions}
        onToggle={() => setShowOptions((v) => !v)}
      >
        <OptionsTable
          options={options}
          base={base}
          baseCost={num(cost)}
          showCost={isOwner}
          onPatch={patch}
          onAdd={addOption}
          onRemove={removeOption}
        />
      </Fold>

      <Fold
        title="الوصف"
        summary={notes.trim() || "يظهر تحت اسم المشروب في التطبيق"}
        open={showNotes}
        onToggle={() => setShowNotes((v) => !v)}
      >
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اسبريسو مزدوج مع حليب مبخّر" />
      </Fold>
      </div>
      )}
    </FormModal>
  )
}
