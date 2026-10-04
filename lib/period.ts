/* Day / week / month windows for the money screens.
 *
 * Pure date arithmetic on YYYY-MM-DD strings, so it is testable and never
 * trips over the browser's timezone: the SERVER decides which business day a
 * sale belongs to (4am cutover); this only says which window to ask for. */

export type Period = "day" | "week" | "month"

const pad = (n: number) => String(n).padStart(2, "0")

export function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

/** Saturday-start week, as the server counts it. */
export function weekStart(s: string): string {
  const d = parse(s)
  const back = (d.getUTCDay() - 6 + 7) % 7
  return addDays(s, -back)
}

export function monthStart(s: string): string {
  return s.slice(0, 8) + "01"
}

export function monthEnd(s: string): string {
  const d = parse(monthStart(s))
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return iso(d)
}

export function range(period: Period, anchor: string): { start: string; end: string } {
  if (period === "day") return { start: anchor, end: anchor }
  if (period === "week") {
    const start = weekStart(anchor)
    return { start, end: addDays(start, 6) }
  }
  return { start: monthStart(anchor), end: monthEnd(anchor) }
}

/** Move the anchor one window back (-1) or forward (+1). */
export function shift(period: Period, anchor: string, dir: -1 | 1): string {
  if (period === "day") return addDays(anchor, dir)
  if (period === "week") return addDays(anchor, 7 * dir)
  const d = parse(monthStart(anchor))
  d.setUTCMonth(d.getUTCMonth() + dir)
  return iso(d)
}

// The same month names formatDate() prints everywhere else in the app, so a
// statement header and the dates under it never disagree.
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]

export function monthName(s: string): string {
  return MONTHS[parse(s).getUTCMonth()]
}

export function label(period: Period, anchor: string): string {
  const d = parse(anchor)
  if (period === "day") {
    return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  }
  if (period === "week") {
    const { start, end } = range("week", anchor)
    const a = parse(start)
    const b = parse(end)
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
      : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
  }
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Today's BUSINESS date in the browser's clock: before the cutover hour it
 *  is still yesterday. */
export function businessToday(cutoverHour = 4, now = new Date()): string {
  const local = new Date(now.getTime() - cutoverHour * 3600_000)
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
}

/** True when the window already includes today, so "next" makes no sense. */
export function isCurrent(period: Period, anchor: string, today: string): boolean {
  const { end } = range(period, anchor)
  return end >= today
}
