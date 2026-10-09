/* How a sale was paid — one list, one set of words, everywhere. */
export type PayMethod = "cash" | "card" | "debt"

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: "نقدي",
  card: "بطاقة",
  debt: "دين",
}

/** The pill class each method is shown with in lists. */
export const PAY_PILL: Record<PayMethod, string> = {
  cash: "pill-success",
  card: "pill-primary",
  debt: "pill-warning",
}

export function payLabel(m: string | null | undefined): string {
  return PAY_LABEL[(m as PayMethod) ?? "cash"] ?? PAY_LABEL.cash
}

export function payPill(m: string | null | undefined): string {
  return PAY_PILL[(m as PayMethod) ?? "cash"] ?? PAY_PILL.cash
}
