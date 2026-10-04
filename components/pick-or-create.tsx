"use client"

/* A dropdown you can also add to: pick one of the options, or type a new
 * name and add it in place. Used for the inventory categories. */
import { useState } from "react"
import { Check, ChevronsUpDown, Loader2, PlusCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function PickOrCreate({
  value,
  options,
  onChange,
  onCreate,
  loading,
  placeholder = "اختر…",
  createLabel = "إضافة",
  className,
}: {
  value: string
  options: { name: string; hint?: string }[]
  onChange: (name: string) => void
  /** Absent = picking only (an employee cannot add categories). */
  onCreate?: (name: string) => Promise<void>
  loading?: boolean
  placeholder?: string
  createLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)
  const t = search.trim()
  const shown = options.filter((o) => !t || o.name.includes(t))
  const exact = options.some((o) => o.name === t)

  async function create() {
    if (!onCreate || !t) return
    setBusy(true)
    try {
      await onCreate(t)
      onChange(t)
      setOpen(false)
      setSearch("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          >
            <span className="truncate" title={value || undefined}>{value || placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-72 min-w-(--anchor-width) max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={onCreate ? "ابحث أو اكتب اسماً جديداً…" : "ابحث…"} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : null}
            <CommandGroup>
              {onCreate && t && !exact ? (
                <CommandItem value="__create__" onSelect={() => void create()} className="gap-2 font-medium text-primary">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4 shrink-0" />}
                  <span className="truncate">{createLabel} «{t}»</span>
                </CommandItem>
              ) : null}
              {shown.map((o) => (
                <CommandItem
                  key={o.name}
                  value={o.name}
                  onSelect={() => {
                    onChange(o.name)
                    setOpen(false)
                    setSearch("")
                  }}
                  className="gap-2"
                >
                  <Check className={cn("size-4 shrink-0", value === o.name ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{o.name}</span>
                  {o.hint ? <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span> : null}
                </CommandItem>
              ))}
              {value ? (
                <CommandItem value="__clear__" onSelect={() => { onChange(""); setOpen(false) }} className="gap-2 text-muted-foreground">
                  <X className="size-4 shrink-0" />
                  بلا تصنيف
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
