# كوب — design rules

Who uses this: a café owner who is not technical (think: a busy doctor who
owns a café), and young baristas working the till between drinks. Nobody
reads a manual. Every screen has to explain itself in plain Arabic.

These rules are not suggestions. A page that breaks one is unfinished.

## 1. Words a person would say

- Plain Arabic sentences, not accounting or engineering terms. No «هامش»,
  «نقطة التعادل», «صافي الإيراد», heat-maps or percentages that need
  decoding. Say «ربحت»، «دخل الصندوق»، «يكفي ٤ أيام»، «أزحم وقت: ٥ مساءً».
- Every number says what it is and what it is in: «٧٣٦ كوب», «١٢٫٠٠ ₪»,
  «منذ يومين». Never a bare number.
- Times are spoken: «٥ مساءً», not «17:00». Dates are short: «٤ أكتوبر».
- People are called by their name, never their login or e-mail.
- A missing value is said («بلا تكلفة», «لم يُطلب بعد»), never a lone «—»
  where a sentence fits.

## 2. No lonely items

- Nothing sits alone in its own row: no single card in a grid row of three,
  no lone button floating in a corner, no one-item section.
- Lists of things (invoices, customers, stock, expenses, staff, returns) are
  a **table** (`components/data-table.tsx`): search, filter chips with
  counts, sortable headers, animated rows; on the phone each row collapses
  into a compact two-line row. Grouping is a filter, not a separate grid.
- Cards are for things you look at as pictures (the menu, the till).

## 3. Space is used, not wasted

- Every page uses `PageShell` (`components/page-shell.tsx`): one width
  (`max-w-7xl`), one gap (`space-y-4`), one padding. No narrow centred
  columns with empty sides.
- Related things sit side by side (two charts, a chart and its table), not
  stacked so the owner has to scroll to compare.
- Panels use `p-4`. No decorative empty space inside a panel.

## 4. Charts

- Over time (hours, days, weeks): **vertical bars**, or an **area** chart
  with the space under the line filled. Time runs left → right.
- Rankings with names (top drinks, top customers): a ranked bar list.
- No pie or doughnut charts. No grids of numbers.
- Two related charts next to each other on desktop, stacked on the phone.
- The busiest/best bar is highlighted; the rest are muted. A one-line
  sentence above the chart says what it shows.
- Primitives: `components/charts.tsx` (`Bars`, `Area`).

## 5. Forms fit the task

- The form changes with what you pick: a salary asks which employee; a bill
  asks which month it covers; maintenance asks what was fixed.
- Only the fields that matter are shown first. Everything else is folded
  («تفاصيل إضافية»).
- Every field has a plain label and an example placeholder. Money fields
  show ₪. The primary button says what it does («حفظ المصروف», not «حفظ»).
- Destructive actions are never a page's main button. They live in a «⋯»
  menu and ask before acting.

## 6. Smooth and fast

- Content enters with a short fade/slide; lists stagger (≤ 15 rows).
- Every tap answers immediately: a pressed state, a spinner on the button,
  a toast that says what happened.
- Skeletons, never a blank screen. Previous data stays visible while the
  next period loads (`placeholderData`).
- Respect `prefers-reduced-motion`.

## 7. One place for the main action

- The page name and its main action sit together at the start of the top
  bar (`PageHeader`). Secondary actions sit beside it, smaller.
- The same action never appears twice on one page.

## 8. Money is the owner's

- Costs, profit, salaries, expenses and reports are owner-only, enforced on
  the server. Owners and platform superusers get full access; superusers
  never appear in staff lists.
