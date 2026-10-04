"use client"

/* الموظفون — who works the till. Owner only (and platform superusers, who
 * never appear in the list). Accounts are switched off, never deleted, so
 * every past sale keeps the name of whoever rang it. */
import { StaffSection } from "@/components/settings/staff-section"

export default function StaffPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-24">
      <StaffSection />
    </div>
  )
}
