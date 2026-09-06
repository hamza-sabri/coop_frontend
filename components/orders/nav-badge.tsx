"use client"

import { useLiveOrders } from "@/components/orders/orders-live"
import { cn } from "@/lib/utils"

/**
 * The count on a nav item. Only ever the orders nobody has accepted yet —
 * a badge that also counted drinks already being made would never clear, and a
 * badge that never clears is furniture.
 */
export function NavBadge({
  badge,
  className,
}: {
  badge?: "liveOrders"
  className?: string
}) {
  const { pending } = useLiveOrders()
  if (badge !== "liveOrders" || pending <= 0) return null
  return (
    <span
      aria-label={`${pending} طلب بانتظار القبول`}
      className={cn(
        "grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
        // A number that means "somebody is standing there" should not sit
        // politely still.
        "animate-pulse",
        className,
      )}
    >
      {pending > 99 ? "99+" : pending}
    </span>
  )
}
