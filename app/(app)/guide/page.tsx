import { redirect } from "next/navigation"

/* The interactive tours were written for the pharmacy this app started as
   (debts, medicines, purchase orders) and ran on its demo data. Until café
   tours exist, the address opens the till rather than a guide to screens
   this shop does not have. */
export default function GuideRedirect() {
  redirect("/pos")
}
