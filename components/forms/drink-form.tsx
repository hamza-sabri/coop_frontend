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
import { useQueryClient } from "@tanstack/react-query"
import { Coffee, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react"
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
}

const KINDS: { k: Kind; label: string }[] = [
  { k: "size", label: "حجم" },
  { k: "flavour", label: "نكهة" },
  { k: "pack", label: "عبوة" },
]

/** Starter rows, so "add sizes" is one click rather than six. */
const SIZE_PRESET = ["صغير", "وسط", "كبير"]

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
  onChange,
  onRemove,
}: {
  o: Option
  base: number
  onChange: (patch: Partial<Option>) => void
  onRemove: () => void
}) {
  const resolved = resolvePrice(o, base)
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card/60 p-2.5">
      <div className="min-w-[8rem] flex-1">
        <Input
          value={o.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={o.kind === "flavour" ? "فانيلا" : "كبير"}
          className="h-10"
        />
      </div>

      {/* what kind of option this is */}
      <div className="flex overflow-hidden rounded-xl border">
        {KINDS.map((k) => (
          <button
            key={k.k}
            type="button"
            onClick={() => onChange({ kind: k.k })}
            className={cn(
              "px-2.5 py-2 text-xs font-semibold transition",
              o.kind === k.k
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* price — absolute, or an amount added to the base */}
      <div className="flex items-stretch overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => onChange({ mode: o.mode === "abs" ? "delta" : "abs" })}
          title={o.mode === "abs" ? "سعر ثابت" : "إضافة على السعر الأساسي"}
          className="bg-muted px-2.5 text-xs font-bold"
        >
          {o.mode === "abs" ? "₪" : "+₪"}
        </button>
        <Input
          inputMode="decimal"
          value={o.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="0"
          className="h-10 w-24 rounded-none border-0 text-center"
        />
      </div>

      {o.kind === "pack" && (
        <div className="flex items-stretch overflow-hidden rounded-xl border">
          <span className="grid place-items-center bg-muted px-2.5 text-[11px] font-semibold">
            قطع
          </span>
          <Input
            inputMode="numeric"
            value={o.pieces}
            onChange={(e) => onChange({ pieces: e.target.value })}
            placeholder="6"
            className="h-10 w-20 rounded-none border-0 text-center"
          />
        </div>
      )}

      <div className="flex items-stretch overflow-hidden rounded-xl border">
        <span className="grid place-items-center bg-muted px-2.5 text-[11px] font-semibold">
          مخزون
        </span>
        <Input
          inputMode="decimal"
          value={o.stock}
          onChange={(e) => onChange({ stock: e.target.value })}
          placeholder="0"
          className="h-10 w-20 rounded-none border-0 text-center"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange({ active: !o.active })}
        className={cn(
          "rounded-xl border px-2.5 py-2 text-xs font-semibold transition",
          o.active ? "text-muted-foreground" : "bg-muted text-foreground",
        )}
        title={o.active ? "متوفر" : "غير متوفر — مخفي من المنيو"}
      >
        {o.active ? "متوفر" : "مخفي"}
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف"
        className="grid size-10 place-items-center rounded-xl border text-destructive transition hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
      </button>

      {o.mode === "delta" && (
        <p className="w-full text-[11px] text-muted-foreground">
          يصير السعر {resolved.toFixed(2)} ₪
        </p>
      )}
    </div>
  )
}

/* ── the form ────────────────────────────────────────────────────────────── */

export function DrinkForm({
  open,
  onOpenChange,
  product,
  initialBarcode,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product?: Product | null
  /** Scan-to-create: a scanned code with no match opens this form with the
   *  barcode already filled, so the owner types a name and a price only. */
  initialBarcode?: string
}) {
  const qc = useQueryClient()
  const editing = Boolean(product)

  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [stock, setStock] = useState("")
  const [barcode, setBarcode] = useState("")
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
          }
        }),
      )
    } catch {
      // A drink with no options is the normal case; a failed fetch should not
      // block editing the name and the price.
      setOptions([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    removed.current = []
    if (product) {
      setName(product.name ?? "")
      setCategory(product.category ?? "")
      setPrice(product.price ?? "")
      setCost(product.cost && product.cost !== "0.00" ? product.cost : "")
      setStock(product.stock != null ? String(product.stock) : "")
      setBarcode(product.barcode ?? "")
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
      setStock("")
      setBarcode(initialBarcode ?? "")
      setNotes("")
      setAvailable(true)
      setImageUrl("")
      setImageFile(null)
      setOptions([])
    }
  }, [open, product, loadOptions, initialBarcode])

  const base = num(price)

  function patch(key: string, p: Partial<Option>) {
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
    setSaving(true)
    try {
      const res = (await upsert(
        ENDPOINTS.products,
        product?.id,
        {
          name: name.trim(),
          category: category.trim(),
          barcode: barcode.trim(),
          price: price.trim() || "0",
          cost: cost.trim() || "0",
          stock: stock === "" ? 0 : Number(stock),
          notes: notes.trim(),
          is_active: available,
          image: imageFile ? undefined : imageUrl.trim(),
        },
        { image_file: imageFile ?? undefined },
      )) as { data?: { id?: number } }

      const productId = product?.id ?? res?.data?.id
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
          if (o.id != null) await updateVariant(o.id, body)
          else await createVariant(body)
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
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "تعديل مشروب" : "إضافة مشروب"}
      icon={<Coffee className="size-4.5" />}
      footer={
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
      }
    >
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="السعر (₪)" hint="السعر الأساسي — الأحجام تعدّله">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="التصنيف">
              <TaxonomyCombobox
                kind="categories"
                value={category}
                onChange={setCategory}
                placeholder="قهوة ساخنة"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="التكلفة (₪)" hint="اختياري — للربح">
              <Input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="المخزون" hint="اتركه فارغاً لمشروب يُحضّر عند الطلب">
              <Input
                inputMode="decimal"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => SIZE_PRESET.forEach((l) => addOption("size", l))}
            >
              أحجام جاهزة
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addOption("flavour")}
            >
              <Plus className="size-4" />
              نكهة
            </Button>
            <Button type="button" size="sm" onClick={() => addOption("size")}>
              <Plus className="size-4" />
              حجم
            </Button>
          </div>
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
                onChange={(p) => patch(o.key, p)}
                onRemove={() => removeOption(o.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* One line, at the bottom, for the few things that do have a barcode:
          a bottle of water, a canned drink. Everything else the till finds by
          name. No alternate codes, no scanner dialog — a second modal on top
          of this one is exactly what this form exists to stop. */}
      <div className="mt-4">
        <Field label="باركود (اختياري)">
          <Input
            dir="ltr"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="للمشروبات المعلّبة فقط"
          />
        </Field>
      </div>
    </FormModal>
  )
}
