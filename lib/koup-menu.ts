"use client"
/* The menu, from the server.

   The customer app used to carry a hard-coded copy in `lib/menu.ts`. That is
   the worst possible arrangement for a café: the till and the phone disagree
   the moment a price changes, and nobody finds out until a customer is charged
   something the app never showed them. This reads the same rows the POS reads,
   through a public endpoint, because the shop authenticates its customers with
   Clerk and cannot use the staff API at all.

   The hard-coded list stays as the offline/first-paint fallback — an empty
   menu is worse than a stale one — but the server always wins once it answers.
*/
import { useEffect, useState } from "react"

import { MENU as FALLBACK, type Item } from "@/lib/menu"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const SLUG = process.env.NEXT_PUBLIC_PHARMACY_SLUG ?? ""

type ApiItem = {
  id: number
  name: string
  price: string
  image: string
  description: string
  category: string
  category_icon: string
  variants: { id: number; name: string; price: string }[]
}

/* Points per shekel. The ledger is the source of truth for what a customer
   actually has; this is only what the menu advertises an item is worth. */
const POINTS_PER_ILS = 3.33

/* A card needs two colours to build its wash. Hashing the category name keeps
   a drink the same colour on every device and every reload without another
   column in the database. */
const PALETTE: [string, string][] = [
  ["#8A5F33", "#C9A063"], ["#6E4A2E", "#B07A46"], ["#3F7A4E", "#A8CF45"],
  ["#6A3468", "#C05C9A"], ["#4E5E8E", "#8A9AC8"], ["#7A5228", "#D4A661"],
  ["#253465", "#4A5C9B"], ["#5A2E5C", "#B5568A"], ["#3C2A20", "#8A5F33"],
]
function tone(key: string): [string, string] {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function toItem(r: ApiItem): Item {
  const price = Number(r.price)
  return {
    c: r.category || "all",
    ar: r.name, en: r.name, he: r.name,
    dar: r.description, den: r.description, dhe: r.description,
    p: price,
    b: Math.round(price * POINTS_PER_ILS),
    g: tone(r.category || r.name),
    t: [],
    image: r.image || undefined,
  }
}

export type KoupMenu = {
  items: Item[]
  cats: { k: string; ar: string; en: string; he: string }[]
  live: boolean
}

export function useKoupMenu(): KoupMenu {
  const [menu, setMenu] = useState<KoupMenu>({
    items: FALLBACK,
    cats: [],
    live: false,
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(`${API}/api/v1/public/menu/?store=${encodeURIComponent(SLUG)}`)
        if (!r.ok) return
        const j = (await r.json()) as {
          categories: { name: string; icon: string }[]
          items: ApiItem[]
        }
        if (!alive || !j.items?.length) return
        setMenu({
          items: j.items.map(toItem),
          // The category key IS the name: one less mapping to keep in sync,
          // and the API has no separate slug.
          cats: j.categories.map((c) => ({
            k: c.name, ar: c.name, en: c.name, he: c.name,
          })),
          live: true,
        })
      } catch {
        /* offline, or the shop is unreachable — the fallback is already shown */
      }
    })()
    return () => { alive = false }
  }, [])

  return menu
}
