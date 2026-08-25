"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDebounced } from "@/hooks/use-debounced"
import { cn } from "@/lib/utils"

export type ComboOption = {
  id: number
  label: string
  sub?: string
  /** Optional payload (e.g. a product's price) for the caller to use. */
  price?: string
  /** Optional text shown on the far (end) side of the row, e.g. a price. */
  trailing?: string
  /** A face for the row — app customers have one, walk-ins do not. */
  avatar?: string
  /** Marks an app customer, so the row can say so at a glance. */
  badge?: string
}

/** A popover + command combobox that searches the server as you type. */
export function EntityCombobox({
  value,
  label,
  onChange,
  fetcher,
  avatar,
  placeholder = "اختر…",
  searchPlaceholder = "ابحث…",
  emptyText = "لا نتائج",
  className,
  disabled,
}: {
  value: number | null | undefined
  label?: string
  onChange: (opt: ComboOption | null) => void
  fetcher: (search: string) => Promise<ComboOption[]>
  /** A face for the current value, when the caller already knows it. */
  avatar?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedLabel, setSelectedLabel] = useState(label ?? "")
  /* The picture belongs to the option, not to the label, so it has to be kept
     when the row is chosen. It is also adopted from the list whenever the
     options happen to contain the current value — which covers a cart that was
     parked with a customer already on it and reopened later. */
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>(avatar)
  const debounced = useDebounced(search, 300)

  useEffect(() => {
    if (label !== undefined) setSelectedLabel(label)
  }, [label])

  useEffect(() => { if (avatar !== undefined) setSelectedAvatar(avatar) }, [avatar])

  const { data: options = [], isFetching } = useQuery({
    queryKey: ["combobox", searchPlaceholder, debounced],
    queryFn: () => fetcher(debounced),
    enabled: open,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (value == null || selectedAvatar) return
    const hit = options.find((o) => o.id === value)
    if (hit?.avatar) setSelectedAvatar(hit.avatar)
  }, [options, value, selectedAvatar])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            {/* Face and name travel together. `justify-between` on the button
                was pushing the label into the middle of the field, leaving the
                avatar stranded at one edge as if it belonged to something
                else — so they are one group, and only the clear control sits
                at the far end. */}
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {value != null && selectedAvatar && (
                <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-card">
                  <img src={selectedAvatar} alt="" className="size-full object-cover" />
                </span>
              )}
              <span className="truncate">
                {value && selectedLabel ? selectedLabel : placeholder}
              </span>
            </span>
            {/* Clearing is a separate act from choosing. Without it the only way
                back to "no customer" was to reopen the list and hunt for a way
                out that did not exist. */}
            {value != null ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="إزالة الزبون"
                title="إزالة الزبون"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedLabel("")
                  setSelectedAvatar(undefined)
                  onChange(null)
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedLabel("")
                  setSelectedAvatar(undefined)
                  onChange(null)
                }}
                className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            )}
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                جارٍ البحث…
              </div>
            )}
            {!isFetching && options.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={String(opt.id)}
                  onSelect={() => {
                    onChange(opt)
                    setSelectedLabel(opt.label)
                    setSelectedAvatar(opt.avatar)
                    setOpen(false)
                    setSearch("")
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {(opt.avatar || opt.badge) && (
                    <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-xs font-semibold text-primary">
                      {opt.avatar
                        ? <img src={opt.avatar} alt="" className="size-full object-cover" />
                        : opt.label.charAt(0)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      {opt.label}
                      {opt.badge && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary">
                          {opt.badge}
                        </span>
                      )}
                    </span>
                    {opt.sub && (
                      <span className="truncate text-xs text-muted-foreground">
                        {opt.sub}
                      </span>
                    )}
                  </div>
                  {opt.trailing && (
                    <span className="shrink-0 font-heading text-sm font-bold text-primary">
                      {opt.trailing}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
