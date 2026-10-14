"use client"

/**
 * Category circles — the fast filter under the POS search.
 *
 * A barista does not type and does not scan; they tap. Two taps to a latte is
 * the whole point, so the categories are big round targets in a single row
 * rather than a dropdown. New categories are made on the menu page
 * (NewCategoryDialog), not here — the till is for selling.
 */
import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  Apple, Bean, Beer, Cake, CakeSlice, Candy, Cherry, Citrus, Coffee, Cookie, Croissant,
  CupSoda, Donut, Dumbbell, Flame, Gift, GlassWater, Grape, HeartPulse, IceCreamBowl,
  IceCreamCone, LayoutGrid, Leaf, Lollipop, Martini, Milk, Pizza, Popcorn, Salad, Sandwich,
  Snowflake, Soup, Sparkles, Star, Utensils, type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  useCategoriesCreate,
  useCategoriesList,
  useCategoriesPartialUpdate,
  getCategoriesListQueryKey,
} from "@/api/generated/categories/categories"
import { useQueryClient } from "@tanstack/react-query"

/** The icon set the backend's `icon` key indexes into (the backend also
 *  guesses one from the name — apps/store/category_icons.py). */
export const ICON_SET: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: "coffee", Icon: Coffee, label: "قهوة" },
  { key: "flame", Icon: Flame, label: "ساخن" },
  { key: "snowflake", Icon: Snowflake, label: "بارد" },
  { key: "cup-soda", Icon: CupSoda, label: "آيس تي / غازي" },
  { key: "glass-water", Icon: GlassWater, label: "مياه" },
  { key: "leaf", Icon: Leaf, label: "شاي وأعشاب" },
  { key: "milk", Icon: Milk, label: "حليب" },
  { key: "ice-cream", Icon: IceCreamCone, label: "ميلك شيك" },
  { key: "ice-cream-bowl", Icon: IceCreamBowl, label: "آيس كريم" },
  { key: "citrus", Icon: Citrus, label: "عصائر وسموذي" },
  { key: "martini", Icon: Martini, label: "موهيتو" },
  { key: "cherry", Icon: Cherry, label: "فواكه" },
  { key: "apple", Icon: Apple, label: "تفاح" },
  { key: "grape", Icon: Grape, label: "عنب" },
  { key: "heart-pulse", Icon: HeartPulse, label: "صحي" },
  { key: "dumbbell", Icon: Dumbbell, label: "بروتين" },
  { key: "sparkles", Icon: Sparkles, label: "مكسات خاصة" },
  { key: "star", Icon: Star, label: "مميز" },
  { key: "bean", Icon: Bean, label: "حبوب قهوة" },
  { key: "cake-slice", Icon: CakeSlice, label: "سويت" },
  { key: "cake", Icon: Cake, label: "كيك" },
  { key: "cookie", Icon: Cookie, label: "كوكيز" },
  { key: "donut", Icon: Donut, label: "دونات" },
  { key: "candy", Icon: Candy, label: "شوكولا" },
  { key: "lollipop", Icon: Lollipop, label: "سكاكر" },
  { key: "croissant", Icon: Croissant, label: "معجنات" },
  { key: "sandwich", Icon: Sandwich, label: "ساندويش" },
  { key: "pizza", Icon: Pizza, label: "بيتزا" },
  { key: "salad", Icon: Salad, label: "سلطة" },
  { key: "soup", Icon: Soup, label: "شوربة" },
  { key: "popcorn", Icon: Popcorn, label: "سناك" },
  { key: "gift", Icon: Gift, label: "هدايا" },
  { key: "utensils", Icon: Utensils, label: "أكل" },
]
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ...Object.fromEntries(ICON_SET.map((i) => [i.key, i.Icon])),
  beer: Beer, // older rows only — not offered any more
}

/** The 33 icons as a picker grid. */
export function IconGrid({ value, onPick }: { value: string; onPick: (k: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {ICON_SET.map(({ key, Icon, label }) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            title={label}
            aria-label={label}
            onClick={() => onPick(key)}
            className={cn(
              "grid aspect-square place-items-center rounded-xl border transition-all",
              on
                ? "border-transparent bg-primary text-primary-foreground shadow-md shadow-primary/30"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        )
      })}
    </div>
  )
}

type Cat = { id: number; name: string; count?: number; icon?: string }

function Circle({
  label, icon: Icon, active, dashed, onClick, count,
}: {
  label: string; icon: LucideIcon; active?: boolean; dashed?: boolean
  onClick: () => void; count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 outline-none"
    >
      <span
        className={cn(
          "relative grid size-[58px] place-items-center rounded-full border transition-all duration-200",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
          dashed
            ? "border-dashed border-border bg-card/60 text-muted-foreground hover:border-primary hover:text-primary"
            : active
              ? "border-transparent bg-primary text-primary-foreground shadow-[0_10px_22px_-10px] shadow-primary/70"
              : "border-border bg-card text-foreground/80 hover:-translate-y-0.5 hover:border-primary/40",
        )}
      >
        <Icon className="size-[22px]" />
        {typeof count === "number" && count > 0 && !active && (
          <span className="absolute -top-0.5 -end-0.5 rounded-full bg-lime px-1.5 text-[10px] font-bold leading-[16px] text-lime-foreground">
            {count}
          </span>
        )}
      </span>
      <span
        className={cn(
          "line-clamp-1 text-[11px] transition-colors",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
}

export function CategoryCircles({
  value, onChange,
}: {
  /* Selected category NAME, or null for everything.

     The id looked like the obvious handle and quietly filtered nothing: the id
     these circles hold does not always belong to the same Category row the
     products point at, and the API reads and writes categories as names in
     every other place. Naming the thing you are filtering by is also what the
     rest of the app already does. */
  value: string | null
  onChange: (name: string | null) => void
}) {
  const { data } = useCategoriesList({ page_size: 100 })
  const cats = ((data as { data?: { results?: Cat[] } } | undefined)?.data?.results ??
    []) as Cat[]

  // No "+" here: the till is for selling. Categories are made on المنيو.
  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-tour="pos-categories"
    >
      <Circle
        label="الكل"
        icon={LayoutGrid}
        active={value === null}
        onClick={() => onChange(null)}
      />
      {cats.map((c) => (
        <Circle
          key={c.id}
          label={c.name}
          icon={CATEGORY_ICONS[c.icon ?? ""] ?? Coffee}
          active={value === c.name}
          count={c.count}
          onClick={() => onChange(value === c.name ? null : c.name)}
        />
      ))}
    </div>
  )
}

/** A new category with its icon — opened from the menu page. */
export function NewCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (name: string) => void
}) {
  const qc = useQueryClient()
  const { data } = useCategoriesList({ page_size: 100 })
  const cats = ((data as { data?: { results?: Cat[] } } | undefined)?.data?.results ??
    []) as Cat[]
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("coffee")
  const iconTouched = useRef(false)
  const setOpen = onOpenChange

  const create = useCategoriesCreate({
    mutation: {
      onSuccess: (_r, vars) => {
        const n = (vars.data as { name: string }).name
        void qc.invalidateQueries({ queryKey: getCategoriesListQueryKey() })
        toast.success(`أضيف تصنيف «${n}»`)
        onCreated?.(n)
        setOpen(false)
        setName("")
        setIcon("coffee")
        iconTouched.current = false
      },
      onError: () => toast.error("تعذّر إضافة التصنيف"),
    },
  })

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (cats.some((c) => c.name === trimmed)) {
      toast.error("في تصنيف بنفس الاسم")
      return
    }
    // `icon` is new on the backend; run `npm run api` to regenerate the
    // types and this cast goes away.
    create.mutate({ data: { name: trimmed, icon } as never })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تصنيف جديد</DialogTitle>
            <DialogDescription>
              يظهر كدائرة في شاشة البيع. اختره لأي صنف من نافذة تعديل الصنف.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">الاسم</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!iconTouched.current) setIcon(guessIcon(e.target.value))
                }}
                placeholder="مثلاً: مشروبات ساخنة"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submit() }
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label>الأيقونة</Label>
              <IconGrid value={icon} onPick={(k) => { setIcon(k); iconTouched.current = true }} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={!name.trim() || create.isPending}>
              {create.isPending ? "جارٍ الإضافة…" : "أضف"}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}

/* Same rules as the backend's guess (apps/store/category_icons.py), short
   form — only used to pre-pick the icon while the owner types a name. */
const GUESS: [RegExp, string][] = [
  [/ايس ?تي|ice ?tea/, "cup-soda"], [/موهيتو|mojito|كوكتيل/, "martini"],
  [/ميلك ?شيك|shake|شيك/, "ice-cream"], [/ايس ?كريم|بوظ|gelato/, "ice-cream-bowl"],
  [/سموذي|smoothie|عصير|عصائر|عصاير|juice|ليموناد/, "citrus"], [/فواكه|fruit/, "cherry"],
  [/هيلثي|healthy|صحي|دايت/, "heart-pulse"], [/بروتين|protein/, "dumbbell"],
  [/مكس|mix|خاص|special/, "sparkles"], [/شاي|tea|اعشاب|ماتشا/, "leaf"],
  [/غازي|soda/, "cup-soda"], [/مياه|ماء|water/, "glass-water"],
  [/بارد|cold|iced|ايس|فرابيه/, "snowflake"], [/قهوه|كوفي|coffee|اسبريسو|ساخن|hot/, "coffee"],
  [/كيك|cake|سويت|sweet|حلو|dessert/, "cake-slice"], [/كوكيز|cookie|بسكوت/, "cookie"],
  [/دونات|donut/, "donut"], [/شوكولا|chocolate/, "candy"], [/كرواسون|معجنات|مخبوزات/, "croissant"],
  [/ساندويش|سندويش|sandwich|برجر/, "sandwich"], [/بيتزا|pizza/, "pizza"], [/سلطه|salad/, "salad"],
  [/شوربه|soup/, "soup"], [/سناك|snack|فشار/, "popcorn"], [/حليب|milk/, "milk"],
]
export function guessIcon(name: string): string {
  const n = name.toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  return GUESS.find(([re]) => re.test(n))?.[1] ?? "coffee"
}

/** Every category with its icon — tap one, pick its icon. Opened from المنيو. */
export function CategoryIconsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const { data } = useCategoriesList({ page_size: 100 })
  const cats = ((data as { data?: { results?: Cat[] } } | undefined)?.data?.results ?? []) as Cat[]
  const [openId, setOpenId] = useState<number | null>(null)
  const update = useCategoriesPartialUpdate({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getCategoriesListQueryKey() })
        toast.success("تم تغيير الأيقونة")
      },
      onError: () => toast.error("تعذّر الحفظ"),
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>أيقونات التصنيفات</DialogTitle>
          <DialogDescription>اضغط على تصنيف واختر أيقونته — تظهر فوراً في شاشة البيع.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border">
          {cats.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon ?? ""] ?? Coffee
            const expanded = openId === c.id
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : c.id)}
                  className={cn("flex w-full items-center gap-3 p-3 text-start transition", expanded ? "bg-primary/5" : "hover:bg-muted/50")}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border bg-card text-foreground/80">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  {typeof c.count === "number" ? <span className="text-xs text-muted-foreground tabular-nums">{c.count}</span> : null}
                  <span className="text-xs font-semibold text-primary">{expanded ? "إغلاق" : "تغيير"}</span>
                </button>
                {expanded ? (
                  <div className="p-3 pt-1 animate-in fade-in slide-in-from-top-1">
                    <IconGrid
                      value={c.icon ?? ""}
                      onPick={(k) => {
                        update.mutate({ id: c.id, data: { icon: k } as never })
                        setOpenId(null)
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
          {cats.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات بعد.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
