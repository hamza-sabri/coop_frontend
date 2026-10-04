import { redirect } from "next/navigation"

/* The menu's numbers live in the reports now (التقارير ← الأصناف): cups sold,
   takings and profit per drink, over any period. Old bookmarks land there. */
export default function MenuStatsRedirect() {
  redirect("/reports?tab=items")
}
