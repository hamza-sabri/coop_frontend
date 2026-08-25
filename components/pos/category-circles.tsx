"use client"

/**
 * Category circles — the fast filter under the POS search.
 *
 * A barista does not type and does not scan; they tap. Two taps to a latte is
 * the whole point, so the categories are big round targets in a single row
 * rather than a dropdown. The `+` at the end creates one on the spot, because
 * a café's categories are a fact about its trade and no template can guess
 * them — the same reason quick-cards ship empty.
 */
import { useState } from "react"
import { toast } from "sonner"
import {
  Beer, Cake, Candy, Coffee, Cookie, Croissant, CupSoda, Donut, Dumbbell,
  IceCreamCone, LayoutGrid, Leaf, Milk, Pizza, Plus, Salad, Sandwich, Soup,
  Utensils, type LucideIcon,
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
  getCategoriesListQueryKey,
} from "@/api/generated/categories/categories"
import { useQueryClient } from "@tanstack/react-query"

/** The icon set the backend's `icon` key indexes into. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  coffee: Coffee, "cup-soda": CupSoda, milk: Milk, beer: Beer,
  croissant: Croissant, sandwich: Sandwich, pizza: Pizza, salad: Salad,
  soup: Soup, cake: Cake, cookie: Cookie, donut: Donut, candy: Candy,
  "ice-cream": IceCreamCone, dumbbell: Dumbbell, leaf: Leaf, utensils: Utensils,
}
const ICON_KEYS = Object.keys(CATEGORY_ICONS)

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
  const qc = useQueryClient()
  const { data } = useCategoriesList({ page_size: 100 })
  const cats = ((data as { data?: { results?: Cat[] } } | undefined)?.data?.results ??
    []) as Cat[]

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("coffee")

  const create = useCategoriesCreate({
    mutation: {
      onSuccess: (_r, vars) => {
        void qc.invalidateQueries({ queryKey: getCategoriesListQueryKey() })
        toast.success(`أضيف تصنيف «${(vars.data as { name: string }).name}»`)
        setOpen(false)
        setName("")
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
    <>
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
        <Circle label="تصنيف جديد" icon={Plus} dashed onClick={() => setOpen(true)} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تصنيف جديد</DialogTitle>
            <DialogDescription>
              بيظهر كدائرة بنقطة البيع، وبتقدر تحطّ فيه أصناف من صفحة المخزون.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">الاسم</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: مشروبات ساخنة"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submit() }
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label>الأيقونة</Label>
              <div className="grid grid-cols-6 gap-2">
                {ICON_KEYS.map((k) => {
                  const I = CATEGORY_ICONS[k]
                  const on = icon === k
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setIcon(k)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-xl border transition-all",
                        on
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <I className="size-[18px]" />
                    </button>
                  )
                })}
              </div>
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
    </>
  )
}
