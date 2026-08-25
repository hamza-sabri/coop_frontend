import { redirect } from "next/navigation"

/* Same reason as the parent: old bookmarks and precached routes still point
   here, and the stats page moved with the rest of the menu. */
export default function InventoryStatsRedirect() {
  redirect("/menu/stats")
}
