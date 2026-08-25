import { redirect } from "next/navigation"

/* The page is the menu now, not a warehouse. Old links — a bookmark, the
   scan button's deep link, a precached service-worker route from a build that
   is still installed on someone's till — must not 404 on the way through. */
export default function InventoryRedirect() {
  redirect("/menu")
}
