"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { BarChart3, GraduationCap, LogOut, Moon, QrCode, ReceiptText, Settings, Sun, Users } from "lucide-react"
import { toast } from "sonner"

import { logout } from "@/lib/auth"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMe, displayName } from "@/hooks/use-me"
import { useIsOwner } from "@/lib/modules"
import { BrandMark } from "@/components/brand"
import { PriceQrDialog } from "@/components/reports/price-qr-card"
import { ConfirmDelete } from "@/components/confirm-delete"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSlot } from "@/components/page-header"

export function TopBar() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, isLoading } = useMe()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = mounted && resolvedTheme === "dark"
  useEffect(() => setMounted(true), [])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    qc.clear() // drop this account's cached data
    toast.success("تم تسجيل الخروج")
    router.replace("/login")
  }

  const name = displayName(user)
  const initials = name ? name.charAt(0) : "؟"
  const isOwner = useIsOwner()
  const [qrOpen, setQrOpen] = useState(false)

  const avatar = isLoading ? (
    <Skeleton className="size-9 rounded-full" />
  ) : (
    <Avatar className="size-9 shadow-sm">
      <AvatarImage src={user?.avatar || undefined} alt={name} />
      {/* Ink + lime — same scheme as the bottom nav. */}
      <AvatarFallback className="bg-ink text-sm font-bold text-lime">
        {initials}
      </AvatarFallback>
    </Avatar>
  )

  return (
    /* What is left of the top bar: a page's action buttons, and on mobile the
       brand and the account menu.

       Everything else has gone. The page TITLE went first — the sidebar
       already lights up the page you are on. Then the desktop scan button,
       because a café scans nothing (the wedge is caught page-wide anyway), and
       the desktop avatar, which was `display only`: a photo of yourself, above
       the till, all day. On a page with no actions this bar is now empty and
       nearly zero-height on desktop, which is the point. */
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)] md:px-8">
      {/* Mobile brand — the tenant's app icon, so the app bar matches the
          launcher. The brand NAME used to sit beside it; the shop knows which
          shop it is. */}
      <BrandMark className="my-2 size-9 shrink-0 rounded-xl ring-1 ring-border md:hidden" />

      {/* Where every page's <PageHeader> lands. */}
      <PageHeaderSlot className="flex min-w-0 flex-1 items-center justify-end gap-2 py-1.5" />

      <div className="flex shrink-0 items-center gap-2.5">
        {/* Mobile: the price-page QR sits right next to the profile circle.
            Available to EVERY signed-in member of staff, not just the owner —
            it's a poster to hand a customer, not a management report. */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="QR صفحة الأسعار"
          className="flex size-9 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border transition hover:bg-muted md:hidden"
        >
          <QrCode className="size-4.5" />
        </button>

        {/* Mobile: profile menu — appearance (theme) + logout. Uses Base UI's
            render-prop trigger (same pattern as SortMenu / RowActions). */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="الحساب" className="rounded-full md:hidden">
                {avatar}
              </button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            {/* Plain <div> headers/dividers — NOT DropdownMenuLabel, which is
                Base UI's Menu.GroupLabel and throws (#31) unless wrapped in a
                Menu.Group. Items below stay as real Menu.Items. */}
            {name ? (
              <div className="truncate px-1.5 py-1 text-sm font-bold">{name}</div>
            ) : null}
            <div className="-mx-1 my-1 h-px bg-border" />
            <div className="flex items-center justify-between gap-3 px-1.5 py-1.5">
              <span className="flex items-center gap-2 text-sm">
                {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                المظهر
              </span>
              <Switch
                checked={isDark}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                aria-label="تبديل بين الفاتح والداكن"
              />
            </div>
            <DropdownMenuItem onClick={() => router.push("/customers")}>
              <Users className="size-4" />
              الزبائن
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/debts")}>
              <ReceiptText className="size-4" />
              الديون
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={() => router.push("/reports")}>
                <BarChart3 className="size-4" />
                التقارير
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" />
              الإعدادات
            </DropdownMenuItem>
            <div className="-mx-1 my-1 h-px bg-border" />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <LogOut className="size-4" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleLogout}
        loading={loggingOut}
        title="تسجيل الخروج"
        description={`هل تريد تسجيل الخروج${name ? ` يا ${name}` : ""}؟`}
        confirmLabel="تسجيل الخروج"
        confirmIcon={<LogOut className="size-4" />}
      />
      <PriceQrDialog open={qrOpen} onOpenChange={setQrOpen} />
    </header>
  )
}
