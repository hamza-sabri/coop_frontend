"use client"

/* الدليل — step-by-step guides on the shop's real screens.
 *
 * Each card starts a guide that walks through the actual page, highlighting
 * where to tap and saying what happens. Nothing is saved while a guide runs
 * (lib/tour/guide-live): the person watches and learns, the shop's data is
 * never touched. Only the guides for pages this account can open are shown. */
import {
  Banknote,
  ChartPie,
  Coins,
  CreditCard,
  GraduationCap,
  PackagePlus,
  PlayCircle,
  ShieldCheck,
  ShoppingBag,
  Undo2,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { useTour } from "@/components/tour/tour-provider"
import { Enter, PageShell } from "@/components/page-shell"
import { CAFE_GUIDES } from "@/lib/tour/cafe-guides"
import { hasModule, useIsOwner, useModules } from "@/lib/modules"
import { formatNumber } from "@/lib/format"

const ICONS: Record<string, LucideIcon> = {
  UserPlus,
  ShoppingBag,
  Banknote,
  CreditCard,
  Coins,
  ChartPie,
  PackagePlus,
  Undo2,
}

export default function GuidePage() {
  const { startTour } = useTour()
  const { modules } = useModules()
  const isOwner = useIsOwner()
  const guides = CAFE_GUIDES.filter((g) => (!g.ownerOnly || isOwner) && hasModule(modules, g.module))

  return (
    <PageShell title="الدليل">
      <Enter>
        <div className="flex items-start gap-3 rounded-3xl border bg-card p-4 sm:p-5">
          <span className="icon-chip bg-brand-gradient size-11 shrink-0">
            <GraduationCap className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-bold">تعلّم خطوة بخطوة</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              اختر ما تريد تعلّمه، ويأخذك الدليل إلى الشاشة نفسها ويُضيء مكان الضغط في كل خطوة.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3.5" />
              آمن تماماً: لا يُحفظ أي شيء أثناء الدليل
            </p>
          </div>
        </div>
      </Enter>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {guides.map((g, i) => {
          const Icon = ICONS[g.icon] ?? PlayCircle
          return (
            <Enter key={g.id} i={i + 1}>
              <button
                type="button"
                onClick={() => startTour(g.id)}
                className="group flex h-full w-full items-start gap-3 rounded-3xl border bg-card p-4 text-start transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[15px] font-bold">{g.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{g.subtitle}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <PlayCircle className="size-3.5" />
                    ابدأ · {stepsWord(g.steps.length)}
                  </span>
                </span>
              </button>
            </Enter>
          )
        })}
      </div>
    </PageShell>
  )
}

function stepsWord(n: number): string {
  if (n === 1) return "خطوة واحدة"
  if (n === 2) return "خطوتان"
  if (n <= 10) return `${formatNumber(n)} خطوات`
  return `${formatNumber(n)} خطوة`
}
