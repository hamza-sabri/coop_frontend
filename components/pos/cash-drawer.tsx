"use client"

/* الصندوق — the till's cash drawer, in a drawer.
 *
 *   closed  → count the cash in, open it
 *   open    → (owner) what should be in it right now, line by line
 *             put cash in / take cash out, with a reason
 *             count the cash out, close it
 *   result  → matches, or short / over by how much
 *
 * An employee counts BLIND: the expected amount appears only after the count
 * is typed, so the number they enter is what is in their hand. */
import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CreditCard,
  History as HistoryIcon,
  Loader2,
  Lock,
  LockOpen,
  Printer,
  TriangleAlert,
  Banknote,
  Vault,
} from "lucide-react"
import { toast } from "sonner"

import {
  closeCashDrawer,
  countsTotal,
  DENOMINATIONS,
  fetchCashDrawer,
  moveCash,
  openCashDrawer,
  staffNames,
  type Counts,
  type CashSession,
} from "@/api/cash-drawer"
import { useMe } from "@/hooks/use-me"
import { printCashRecord } from "@/lib/print/cash-record"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { useIsOwner } from "@/lib/modules"
import { cn } from "@/lib/utils"

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

const time = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(iso))
    : "—"

const when = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${time(iso)}` : "—")

/** Shared with the till so the button can show open/closed. */
export function useCashDrawer(enabled = true) {
  return useQuery({
    queryKey: ["cash-drawer"],
    queryFn: () => fetchCashDrawer().then((r) => r.data),
    enabled,
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

/** The circle beside the categories on the till. */
/** The cash drawer's button — a pill at the top of the cart, beside «إرجاع».
 *  Green with a live dot while the drawer is open; amber "افتح الصندوق" while
 *  it is closed, because a shift that has not counted its opening cash is the
 *  thing to notice. */
export function CashDrawerButton() {
  const [open, setOpen] = useState(false)
  const { data } = useCashDrawer()
  const isOpen = Boolean(data?.open)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="pos-drawer"
        title={isOpen ? "الصندوق مفتوح — اضغط للإغلاق أو إخراج نقد" : "افتح الصندوق بعدّ النقود"}
        aria-label={isOpen ? "الصندوق مفتوح" : "الصندوق مغلق"}
        className={cn(
          "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
          isOpen
            ? "bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 hover:bg-amber-500/25 dark:text-amber-300",
        )}
      >
        <Vault className="size-3.5" />
        {isOpen ? "الصندوق" : "افتح الصندوق"}
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            isOpen ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20" : "animate-pulse bg-amber-500",
          )}
        />
      </button>
      <CashDrawerSheet open={open} onOpenChange={setOpen} />
    </>
  )
}

export function CashDrawerSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const isOwner = useIsOwner()
  const qc = useQueryClient()
  const { data, isLoading } = useCashDrawer(open)
  const [result, setResult] = useState<CashSession | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ["cash-drawer"] })

  const session = data?.open ?? null
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setResult(null)
      }}
    >
      <SheetContent side="left" size="lg" className="flex flex-col gap-0 p-0">
        <div className="bg-brand-soft relative shrink-0 overflow-hidden border-b border-border/70 px-6 py-4.5 pe-14">
          <div aria-hidden="true" className="bg-brand-gradient pointer-events-none absolute -end-10 -top-12 size-28 rounded-full opacity-15" />
          <SheetTitle className="flex items-center gap-2.5">
            <span className="icon-chip bg-brand-gradient size-10">
              <Vault className="size-4.5" />
            </span>
            <span className="font-heading text-lg">الصندوق</span>
          </SheetTitle>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {result
              ? "نتيجة العدّ"
              : session
                ? `مفتوح منذ ${when(session.opened_at)} · فتحه ${session.opened_by || "—"}`
                : "مغلق — عُدّ النقود وافتحه في بداية الوردية"}
          </p>
        </div>

        <div data-tour="drawer-sheet" className="stagger min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5" key={result ? "r" : session ? `o${session.id}` : "c"}>
          {isLoading && !data ? (
            <Loader2 className="mx-auto mt-10 size-6 animate-spin text-muted-foreground" />
          ) : result ? (
            <Result s={result} onDone={() => setResult(null)} />
          ) : session ? (
            <OpenDrawer s={session} owner={isOwner} onChange={refresh} onClosed={(s) => { setResult(s); refresh() }} />
          ) : (
            <OpenForm onOpened={refresh} />
          )}

          {isOwner && !result && (data?.history?.length ?? 0) > 0 ? <History rows={data!.history} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ── closed: count in ─────────────────────────────────────────────────── */
/** Who works here, for "who opened / closed". Cached for the session. */
export function useStaffNames() {
  return useQuery({
    queryKey: ["staff-names"],
    queryFn: () => staffNames().then((r) => r.data),
    staleTime: 10 * 60_000,
  })
}

/** Pick the person at the counter. Staff share a till and rarely sign out,
 *  so the signed-in account is only the default. */
export function WhoPicker({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  const { data } = useStaffNames()
  const rows = data ?? []
  if (!rows.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
      >
        {rows.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </div>
  )
}

/** The count sheet: how many of each note and coin. The total is computed
 *  and shown; nobody types a sum. */
export function CountSheet({ counts, onChange, autoFocus }: { counts: Counts; onChange: (c: Counts) => void; autoFocus?: boolean }) {
  const total = countsTotal(counts)
  return (
    <div className="rounded-xl border">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>الفئة</span><span className="text-center">العدد</span><span className="text-end">المبلغ</span>
      </div>
      <ul className="divide-y divide-border/60">
        {DENOMINATIONS.map((d, i) => {
          const n = Number(counts[d]) || 0
          const coin = Number(d) <= 10
          return (
            <li key={d} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-3 py-1">
              <span className="flex items-center gap-2 text-sm">
                <span className={cn("inline-grid h-6 min-w-9 place-items-center rounded-md px-1 text-[11px] font-bold tabular-nums", coin ? "rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-primary/10 text-primary")}>{d}</span>
                <span className="text-[11px] text-muted-foreground">{coin ? "قطعة" : "ورقة"}</span>
              </span>
              <input
                inputMode="numeric"
                dir="ltr"
                aria-label={`عدد فئة ${d}`}
                autoFocus={autoFocus && i === 0}
                className="h-9 w-20 rounded-lg border border-border bg-background text-center text-sm font-semibold tabular-nums"
                value={n ? String(n) : ""}
                placeholder="0"
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, ""), 10)
                  onChange({ ...counts, [d]: isNaN(v) ? 0 : Math.min(v, 100000) })
                }}
              />
              <span className="text-end text-sm tabular-nums text-muted-foreground">{n ? formatMoney(Number(d) * n) : ""}</span>
            </li>
          )
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t bg-muted/30 px-3 py-2">
        <span className="text-sm font-semibold">المجموع المعدود</span>
        <span className="font-heading text-xl font-bold tabular-nums text-primary">{formatMoney(total)}</span>
      </div>
    </div>
  )
}

/* ── closed: count in ─────────────────────────────────────────────────── */
function OpenForm({ onOpened }: { onOpened: () => void }) {
  const { user } = useMe()
  const [counts, setCounts] = useState<Counts>({})
  const [who, setWho] = useState<number | null>(null)
  useEffect(() => { if (user?.id && who == null) setWho(Number(user.id)) }, [user, who])
  const total = countsTotal(counts)
  const go = useMutation({
    mutationFn: () => openCashDrawer({ counts, opened_by: who }),
    onSuccess: () => {
      toast.success("فُتح الصندوق")
      setCounts({})
      onOpened()
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر فتح الصندوق")),
  })
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <LockOpen className="size-4 text-primary" />
        افتح الصندوق — عُدّ الفكّة
      </div>
      <CountSheet counts={counts} onChange={setCounts} autoFocus />
      <WhoPicker id="cd-open-who" label="من يفتح الصندوق؟" value={who} onChange={setWho} />
      <Button className="bg-brand-gradient w-full" disabled={go.isPending} onClick={() => go.mutate()}>
        {go.isPending ? <Loader2 className="size-4 animate-spin" /> : <LockOpen className="size-4" />}
        افتح الصندوق بـ {formatMoney(total)}
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        من الآن يحسب النظام وحده: كل بيع نقدي يزيد الصندوق، وكل إرجاع نقدي ينقصه. البيع بالبطاقة لا يدخل الصندوق.
      </p>
    </div>
  )
}

/* ── open ─────────────────────────────────────────────────────────────── */
function OpenDrawer({
  s,
  owner,
  onChange,
  onClosed,
}: {
  s: CashSession
  owner: boolean
  onChange: () => void
  onClosed: (s: CashSession) => void
}) {
  const [mode, setMode] = useState<null | "in" | "out" | "close">(null)
  return (
    <>
      {owner && s.figures ? (
        <Breakdown s={s} />
      ) : (
        <div className="rounded-2xl border p-4 text-sm">
          <p className="text-muted-foreground">بدأ الصندوق بـ</p>
          <p className="font-heading text-2xl font-bold tabular-nums">{formatMoney(s.opening_amount)}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">عند الإغلاق تعدّ النقود، ثم يظهر لك إن كان الصندوق مطابقاً.</p>
        </div>
      )}

      {s.moves.length ? (
        <div className="rounded-2xl border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">إدخال وإخراج</p>
          <ul className="divide-y divide-border/70 text-sm">
            {s.moves.map((m, i) => {
              const v = toNumber(m.amount)
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{m.note || (v > 0 ? "إدخال نقد" : "إخراج نقد")}</span>
                    <span className="text-[11px] text-muted-foreground">{time(m.at)} · {m.by}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", v > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    {v > 0 ? "+" : "−"} {formatMoney(Math.abs(v))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {mode === "in" || mode === "out" ? (
        <MoveForm direction={mode} onDone={() => { setMode(null); onChange() }} onCancel={() => setMode(null)} />
      ) : mode === "close" ? (
        <CloseForm onCancel={() => setMode(null)} onClosed={onClosed} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setMode("in")}>
            <ArrowDownToLine className="size-4" />
            إدخال نقد
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setMode("out")}>
            <ArrowUpFromLine className="size-4" />
            إخراج نقد
          </Button>
          <Button className="bg-brand-gradient col-span-2 gap-1.5" onClick={() => setMode("close")} data-tour="drawer-close">
            <Lock className="size-4" />
            أغلق الصندوق وعُدّ النقود
          </Button>
        </div>
      )}
    </>
  )
}

export function Breakdown({ s }: { s: CashSession }) {
  const f = s.figures!
  const rows: { label: string; sub?: string; v: string; sign: "" | "+" | "−" }[] = [
    { label: "بداية الصندوق", v: f.opening, sign: "" },
    { label: "مبيعات نقدية", sub: `${formatNumber(f.cash_tickets)} فاتورة`, v: f.cash_sales, sign: "+" },
    { label: "مرتجعات نقدية", v: f.refunds, sign: "−" },
    { label: "إدخال نقد", v: f.put_in, sign: "+" },
    { label: "إخراج نقد", v: f.took_out, sign: "−" },
  ]
  const cardRef = toNumber(f.card_refunds ?? "0")
  const debt = toNumber(f.debt_sales ?? "0")
  return (
    <div className="rounded-2xl border p-4">
      <ul className="space-y-2 text-sm">
        {rows
          .filter((r) => r.sign === "" || toNumber(r.v) !== 0 || r.label === "مبيعات نقدية")
          .map((r) => (
            <li key={r.label} className="flex items-baseline justify-between gap-3">
              <span>
                {r.label}
                {r.sub ? <span className="ms-1.5 text-[11px] text-muted-foreground">{r.sub}</span> : null}
              </span>
              <span className="tabular-nums">
                {r.sign ? <span className="me-1 text-muted-foreground">{r.sign}</span> : null}
                {formatMoney(r.v)}
              </span>
            </li>
          ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-border/70 pt-3">
        <span className="font-semibold">يجب أن يكون في الصندوق</span>
        <span className="font-heading text-2xl font-bold tabular-nums text-primary">{formatMoney(f.expected)}</span>
      </div>
      <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3 text-sm">
        <li className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-1.5"><CreditCard className="size-3.5 text-muted-foreground" /> مبيعات البطاقة <span className="text-[11px] text-muted-foreground">{formatNumber(f.card_tickets)} فاتورة — لا تدخل الصندوق</span></span>
          <span className="tabular-nums">{formatMoney(f.card_sales)}</span>
        </li>
        {cardRef > 0 ? (
          <li className="flex items-baseline justify-between gap-3"><span>مرتجعات بالبطاقة</span><span className="tabular-nums"><span className="me-1 text-muted-foreground">−</span>{formatMoney(cardRef)}</span></li>
        ) : null}
        {debt > 0 ? (
          <li className="flex items-baseline justify-between gap-3"><span>على الحساب (دين) <span className="text-[11px] text-muted-foreground">{formatNumber(f.debt_tickets ?? 0)} فاتورة</span></span><span className="tabular-nums">{formatMoney(debt)}</span></li>
        ) : null}
        {f.total_sales != null ? (
          <li className="flex items-baseline justify-between gap-3 font-semibold"><span>إجمالي المبيعات <span className="text-[11px] font-normal text-muted-foreground">{formatNumber(f.tickets ?? 0)} فاتورة</span></span><span className="tabular-nums">{formatMoney(f.total_sales)}</span></li>
        ) : null}
      </ul>
    </div>
  )
}

/** The card terminal's total against the books — shown after closing. */
export function CardCheck({ s }: { s: CashSession }) {
  if (s.card_counted == null || s.card_difference == null) return null
  const d = toNumber(s.card_difference)
  const w = differenceWords(d)
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", w.tone === "ok" ? "border-emerald-500/30" : "border-rose-500/30")}>
      <span className="flex items-center gap-2"><CreditCard className="size-4 text-muted-foreground" /> جهاز البطاقة {formatMoney(s.card_counted)} · النظام {formatMoney(s.figures?.card_expected ?? s.figures?.card_sales ?? "0")}</span>
      <span className={cn("pill shrink-0", w.tone === "ok" ? "pill-success" : "pill-danger")}>{w.tone === "ok" ? "مطابق" : w.text}</span>
    </div>
  )
}

function MoveForm({ direction, onDone, onCancel }: { direction: "in" | "out"; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const go = useMutation({
    mutationFn: () => moveCash(String(toNumber(amount)), direction, note.trim()),
    onSuccess: () => {
      toast.success(direction === "in" ? "سُجّل الإدخال" : "سُجّل الإخراج")
      onDone()
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر التسجيل")),
  })
  const ok = toNumber(amount) > 0 && (direction === "in" || note.trim() !== "")
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <p className="text-sm font-semibold">{direction === "in" ? "إدخال نقد إلى الصندوق" : "إخراج نقد من الصندوق"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-move">المبلغ</Label>
          <MoneyInput id="cd-move" value={amount} onChange={setAmount} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-note">
            السبب {direction === "in" ? <span className="text-xs font-normal text-muted-foreground">(اختياري)</span> : null}
          </Label>
          <Input id="cd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={direction === "in" ? "فكّة من البنك" : "شراء حليب"} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!ok || go.isPending} onClick={() => go.mutate()}>
          {go.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          تسجيل
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={go.isPending}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

function CloseForm({ onCancel, onClosed }: { onCancel: () => void; onClosed: (s: CashSession) => void }) {
  const { user } = useMe()
  const [counts, setCounts] = useState<Counts>({})
  const [card, setCard] = useState("")
  const [who, setWho] = useState<number | null>(null)
  useEffect(() => { if (user?.id && who == null) setWho(Number(user.id)) }, [user, who])
  const [note, setNote] = useState("")
  const go = useMutation({
    mutationFn: () => closeCashDrawer({ counts, card_counted: card.trim() === "" ? undefined : String(toNumber(card)), closed_by: who, note: note.trim() }),
    onSuccess: (r) => onClosed(r.data),
    onError: (e) => toast.error(errMsg(e, "تعذّر إغلاق الصندوق")),
  })
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-semibold">عُدّ النقود في الصندوق</p>
      <CountSheet counts={counts} onChange={setCounts} autoFocus />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cd-card" className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> مجموع البطاقة من جهاز الدفع</Label>
        <MoneyInput id="cd-card" value={card} onChange={setCard} />
        <p className="text-[11px] text-muted-foreground">اطبع تقرير اليوم من جهاز البطاقة واكتب مجموعه — يُقارن بمبيعات البطاقة في النظام.</p>
      </div>
      <WhoPicker id="cd-close-who" label="من يغلق الصندوق؟" value={who} onChange={setWho} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cd-cnote">
          ملاحظة <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
        </Label>
        <Input id="cd-cnote" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button className="bg-brand-gradient flex-1" disabled={go.isPending} onClick={() => go.mutate()}>
          {go.isPending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          أغلق الصندوق بـ {formatMoney(countsTotal(counts))}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={go.isPending}>
          رجوع
        </Button>
      </div>
    </div>
  )
}

/* ── result ───────────────────────────────────────────────────────────── */
export function differenceWords(diff: number): { text: string; tone: "ok" | "short" | "over" } {
  if (Math.abs(diff) < 0.005) return { text: "الصندوق مطابق", tone: "ok" }
  return diff < 0
    ? { text: `ينقص ${formatMoney(-diff)}`, tone: "short" }
    : { text: `يزيد ${formatMoney(diff)}`, tone: "over" }
}

function Result({ s, onDone }: { s: CashSession; onDone: () => void }) {
  const d = differenceWords(toNumber(s.difference))
  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border p-6 text-center",
          d.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/8" : "border-rose-500/30 bg-rose-500/8",
        )}
      >
        {d.tone === "ok" ? (
          <CheckCircle2 className="size-10 text-emerald-600" />
        ) : (
          <TriangleAlert className="size-10 text-rose-600" />
        )}
        <p className={cn("font-heading text-2xl font-bold", d.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          {d.text}
        </p>
        <p className="text-sm text-muted-foreground">
          عددت {formatMoney(s.counted_amount)} · المتوقع {formatMoney(s.expected_amount)}
        </p>
      </div>
      <CardCheck s={s} />
      {s.figures ? <Breakdown s={{ ...s, figures: { ...s.figures, expected: s.expected_amount ?? s.figures.expected } }} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => void printCashRecord(s.id)}>
          <Printer className="size-4" />
          اطبع السجل
        </Button>
        <Button variant="outline" onClick={onDone}>
          تم
        </Button>
      </div>
    </>
  )
}

/* ── history (owner) ──────────────────────────────────────────────────── */
function History({ rows }: { rows: CashSession[] }) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">آخر الإغلاقات</p>
        <Link href="/cash-drawer" className="flex items-center gap-1 text-xs font-semibold text-primary"><HistoryIcon className="size-3.5" /> السجل الكامل</Link>
      </div>
      <ul className="divide-y divide-border/70 text-sm">
        {rows.map((r) => {
          const d = differenceWords(toNumber(r.difference))
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/cash-drawer/${r.id}`} className="min-w-0">
                <span className="block">{when(r.closed_at)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {time(r.opened_at)} ← {time(r.closed_at)} · {r.closed_by || "—"} · عُدّ {formatMoney(r.counted_amount)}
                </span>
              </Link>
              <span
                className={cn(
                  "pill shrink-0",
                  d.tone === "ok" ? "pill-success" : "pill-danger",
                )}
              >
                {d.text}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MoneyInput({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        autoFocus={autoFocus}
        className="h-11 ps-8 text-end text-base font-semibold tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.٠-٩]/g, "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)))}
        placeholder="0"
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₪</span>
    </div>
  )
}
