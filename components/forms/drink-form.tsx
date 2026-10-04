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
  draftCost,
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

const KINDS: { k: Kind; label: string }[] = [
  { k: "size", label: "حجم" },
  { k: "flavour", label: "نكهة" },
  { k: "pack", label: "عبوة" },
]

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

/** Margin on one price, as the owner reads it: "هامش 66% · ربح 11.90 ₪". */
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
      هامش {pct.toFixed(0)}% · ربح {profit.toFixed(2)} ₪
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

function OptionRow({
  o,
  base,
  baseCost,
  showCost,
  items,
  baseLines,
  onChange,
  onRemove,
}: {
  o: Option
  base: number
  /** What the drink itself costs — from its ingredients when it has them. */
  baseCost: number
  showCost: boolean
  items: InventoryItem[]
  baseLines: Draft[]
  onChange: (patch: Partial<Option>) => void
  onRemove: () => void
}) {
  const resolved = resolvePrice(o, base)
  const byId = new Map(items.map((i) => [i.id, i]))
  // Cost of this option: its own ingredients, else the drink's ingredients,
  // else whatever was typed, else the drink's typed cost.
  const recipeCost = o.own && o.lines.length ? draftCost(o.lines, byId) : baseLines.length ? draftCost(baseLines, byId) : null
  const cost = recipeCost ?? (o.cost.trim() !== "" ? num(o.cost) : baseCost)
  const inherits = !o.own && baseLines.length > 0
  const ingredientsLabel = o.own && o.lines.length ? `${o.lines.length} خاصة` : baseLines.length ? "= المشروب" : "لا شيء"

  return (
    <div className="rounded-2xl border bg-card/60">
      {/* row 1 — what it is */}
      <div className="flex items-center gap-2 p-2.5 pb-0">
        <Input
          value={o.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={o.kind === "flavour" ? "فانيلا" : "كبير"}
          className="h-10 min-w-0 flex-1"
          aria-label="اسم الخيار"
        />
        <div className="flex shrink-0 overflow-hidden rounded-xl border">
          {KINDS.map((k) => (
            <button
              key={k.k}
              type="button"
              onClick={() => onChange({ kind: k.k })}
              className={cn(
                "px-2.5 py-2 text-xs font-semibold transition",
                o.kind === k.k ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف الخيار"
          title="حذف الخيار"
          className="grid size-10 shrink-0 place-items-center rounded-xl border text-destructive transition hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* row 2 — money and availability */}
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <div className="flex items-stretch overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => onChange({ mode: o.mode === "abs" ? "delta" : "abs" })}
            title={o.mode === "abs" ? "سعر ثابت — اضغط لتكتب الزيادة" : "زيادة على السعر الأساسي — اضغط للسعر الثابت"}
            className="bg-muted px-2.5 text-xs font-bold"
          >
            {o.mode === "abs" ? "₪" : "+₪"}
          </button>
          <Input
            inputMode="decimal"
            value={o.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0"
            className="h-9 w-20 rounded-none border-0 text-center"
            aria-label="السعر"
          />
        </div>

        {showCost && (
          <div
            className="flex items-stretch overflow-hidden rounded-xl border"
            title={recipeCost != null ? "من المكونات" : "تكلفة هذا الخيار — فارغ = نفس تكلفة المشروب"}
          >
            <span className="grid place-items-center bg-muted px-2.5 text-[11px] font-semibold">تكلفة</span>
            <Input
              inputMode="decimal"
              value={recipeCost != null ? recipeCost.toFixed(2) : o.cost}
              readOnly={recipeCost != null}
              onChange={(e) => onChange({ cost: e.target.value })}
              placeholder={baseCost > 0 ? baseCost.toFixed(2) : "0"}
              className={cn("h-9 w-20 rounded-none border-0 text-center", recipeCost != null && "bg-muted/40")}
            />
          </div>
        )}

        {o.kind === "pack" && (
          <div className="flex items-stretch overflow-hidden rounded-xl border">
            <span className="grid place-items-center bg-muted px-2.5 text-[11px] font-semibold">قطع</span>
            <Input
              inputMode="numeric"
              value={o.pieces}
              onChange={(e) => onChange({ pieces: e.target.value })}
              placeholder="6"
              className="h-9 w-16 rounded-none border-0 text-center"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => onChange({ active: !o.active })}
          className={cn(
            "h-9 rounded-xl border px-2.5 text-xs font-semibold transition",
            o.active ? "text-muted-foreground" : "bg-muted text-foreground",
          )}
          title={o.active ? "متوفر — اضغط لإخفائه من المنيو" : "غير متوفر — مخفي من المنيو"}
        >
          {o.active ? "متوفر" : "مخفي"}
        </button>

        {showCost ? (
          <button
            type="button"
            onClick={() => onChange({ open: !o.open })}
            className={cn(
              "ms-auto flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition",
              o.open ? "border-primary/40 bg-primary/5 text-primary" : "hover:bg-muted",
            )}
          >
            <Milk className="size-3.5" />
            المكونات
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{ingredientsLabel}</span>
            <ChevronDown className={cn("size-3.5 transition", o.open && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {(o.mode === "delta" || (showCost && cost > 0 && resolved > 0)) && !o.open && (
        <p className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5 text-[11px] text-muted-foreground">
          {o.mode === "delta" ? <span>يصير السعر {resolved.toFixed(2)} ₪</span> : null}
          {showCost ? <MarginPill price={resolved} cost={cost} /> : null}
        </p>
      )}

      {/* row 3 — what one of these takes from the shelf */}
      {showCost && o.open ? (
        <div className="space-y-2 border-t border-border/60 p-2.5">
          {inherits ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-2.5 text-xs">
              <span className="text-muted-foreground">
                «{o.label || "هذا الخيار"}» يُخصم بمكونات المشروب ({baseLines.length}) كما هي.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => onChange({ own: true, lines: copyDraft(baseLines) })}
              >
                <Copy className="size-3.5" />
                مكونات خاصة به
              </Button>
            </div>
          ) : (
            <>
              <Ingredients
                items={items}
                lines={o.lines}
                price={resolved}
                onChange={(lines) => onChange({ own: true, lines })}
                empty={`أضف ما يأخذه «${o.label || "هذا الخيار"}» من المخزون — مثلاً كوب، حليب، بن.`}
              />
              {o.own && baseLines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange({ own: false, lines: [] })}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  ارجع لمكونات المشروب
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
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
  const [tab, setTab] = useState<"info" | "report">("info")
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
  const recipeCost = baseLines.length ? draftCost(baseLines, byId) : null

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
        tab !== "info" ? (
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
      {/* The drink's own report sits beside its details: how often it sells,
          which size, when, what it earns. Owner only — it is money. */}
      {showReport ? (
        <SegmentedTabs
          tabs={[
            { id: "info", label: "الأساسية" },
            { id: "report", label: "التقارير" },
          ]}
          active={tab}
          onChange={(t) => setTab(t as "info" | "report")}
        />
      ) : null}

      {tab === "report" && showReport && product?.id != null ? (
        <div className="space-y-3">
          <PeriodBar value={period} onChange={setPeriod} today={today} />
          <ItemReport productId={product.id} q={{ period: period.period, date: period.anchor }} />
        </div>
      ) : (
      <>
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="لاتيه"
            />
          </Field>

          <div className={cn("grid gap-3", isOwner ? "grid-cols-3" : "grid-cols-2")}>
            <Field label="السعر (₪)" hint="السعر الأساسي — الأحجام تعدّله">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            {isOwner ? (
              <Field
                label="التكلفة (₪)"
                hint={
                  recipeCost != null
                    ? "من المكونات بآخر سعر شراء"
                    : "كم يكلّفك الكوب — أو أضف المكونات تحت"
                }
              >
                <Input
                  inputMode="decimal"
                  value={recipeCost != null ? recipeCost.toFixed(2) : cost}
                  readOnly={recipeCost != null}
                  className={recipeCost != null ? "bg-muted/50" : undefined}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            ) : null}
            <Field label="التصنيف">
              <TaxonomyCombobox
                kind="categories"
                value={category}
                onChange={setCategory}
                placeholder="قهوة ساخنة"
              />
            </Field>
          </div>

          {isOwner && (recipeCost ?? num(cost)) > 0 && base > 0 ? (
            <div className="-mt-1">
              <MarginPill price={base} cost={recipeCost ?? num(cost)} />
            </div>
          ) : null}

          <Field label="الوصف" hint="يظهر تحت اسم المشروب في التطبيق">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اسبريسو مزدوج مع حليب مبخّر"
            />
          </Field>
        </div>
      </div>

      {/* ── what one cup takes from the shelf ─────────────────────────── */}
      {isOwner ? (
        <div className="mt-5 flex flex-col gap-2">
          <div>
            <h4 className="flex items-center gap-1.5 font-heading text-base font-bold">
              <Milk className="size-4 text-muted-foreground" />
              مكونات الكوب
            </h4>
            <p className="text-[11px] text-muted-foreground">
              كل بيعة تخصم هذه الكميات من المخزون، والإلغاء يعيدها.
              {options.length ? " الأحجام والنكهات تستخدمها إلا إذا أعطيتها مكونات خاصة." : ""}
            </p>
          </div>
          {!recipeReady ? (
            <Loader2 className="mx-auto my-3 size-4 animate-spin text-muted-foreground" />
          ) : (
            <Ingredients
              items={items}
              lines={baseLines}
              price={base}
              onChange={(l) => {
                recipeTouched.current = true
                setBaseLines(l)
              }}
            />
          )}
        </div>
      ) : null}

      {/* ── sizes, flavours, boxes ─────────────────────────────────────── */}
      <div className="mt-5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-heading text-base font-bold">الأحجام والنكهات</h4>
            <p className="text-[11px] text-muted-foreground">
              اضغط ₪ ليصير +₪ إذا بدك تكتب الزيادة على السعر الأساسي بدل السعر
              الكامل.
            </p>
          </div>
          {/* One button. The row itself says whether it is a size, a flavour
              or a box — three buttons that all add the same row were three
              ways to start the same sentence. */}
          <Button type="button" size="sm" onClick={() => addOption("size")}>
            <Plus className="size-4" />
            إضافة خيار
          </Button>
        </div>

        {options.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
            بلا أحجام — بينباع بالسعر الأساسي.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <OptionRow
                key={o.key}
                o={o}
                base={base}
                baseCost={recipeCost ?? num(cost)}
                showCost={isOwner && recipeReady}
                items={items}
                baseLines={baseLines}
                onChange={(p) => patch(o.key, p)}
                onRemove={() => removeOption(o.key)}
              />
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </FormModal>
  )
}
