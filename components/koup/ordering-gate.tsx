"use client"

/* The customer shop, while ordering is switched off.

   Hiding only the admin's orders board would have left this page taking
   orders that nobody is watching for — a customer at the counter waiting on a
   drink nobody knows about. So the shop asks the server first, and while the
   answer is "closed" it shows this instead of a menu with a cart.

   Closed is also the answer when the server cannot be reached: a page that
   cannot confirm ordering is open must not let anyone order. */

import { useEffect, useState } from "react"
import { publicOrdering } from "@/api/public"

export function OrderingGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    publicOrdering()
      .then((r) => alive && setOpen(Boolean(r.open)))
      .catch(() => alive && setOpen(false))
    return () => {
      alive = false
    }
  }, [])

  if (open === null) return <div className="min-h-dvh bg-[#131C3D]" aria-busy="true" />
  if (open) return <>{children}</>

  return (
    <main
      dir="rtl"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#131C3D] px-8 text-center text-white"
    >
      <p
        className="text-6xl text-[#C9A063]"
        style={{ fontFamily: "var(--font-wordmark), serif" }}
      >
        كوب
      </p>
      <h1 className="text-xl font-bold">الطلب أونلاين قريباً</h1>
      <p className="max-w-xs text-sm leading-relaxed text-white/70">
        نجهّز تطبيق كوب. لحد ما يجهز، اطلب مباشرة من الكاونتر.
      </p>
    </main>
  )
}
