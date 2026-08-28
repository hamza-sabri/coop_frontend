import { redirect } from "next/navigation"

/* It is a طلبات page now, not مبيعات. A café takes orders; "sales" is the
   supermarket word this template arrived with. The old route has to survive
   the rename — a bookmark, the POS footer link in an already-installed build,
   a route precached by the service worker on a till that has not updated. */
export default function SalesRedirect() {
  redirect("/orders")
}
