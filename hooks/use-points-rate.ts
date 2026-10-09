"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchEarnRules } from "@/api/finance"
import { pointsPerIls, setPointsPerIls } from "@/lib/points"

/** The shop's points rate (points per 1 ₪), loaded once and kept in
 *  lib/points so every helper there uses it. Returns the current value. */
export function usePointsRate(): number {
  const { data } = useQuery({
    queryKey: ["points-rules"],
    queryFn: () => fetchEarnRules().then((r) => r.data),
    staleTime: 5 * 60_000,
  })
  setPointsPerIls(data?.points_per_ils)
  return pointsPerIls()
}
