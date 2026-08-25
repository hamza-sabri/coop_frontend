import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * The till's quick-tap cards — the handful of things a shop sells constantly,
 * one tap from the counter.
 *
 * The layout lives on the STORE, not the browser: a cleared cache or a second
 * till must not lose how the shop arranged its own counter.
 *
 * There are NO built-in cards. Which items matter is a fact about the trade —
 * tobacco and phone credit in one shop, bread and milk in another — so the
 * template ships empty and the shop builds its own. A guess that half-matches
 * is worse than nothing: cards appear the owner never asked for and cannot
 * explain.
 */

const getQuickGroups = vi.fn()
const putQuickGroups = vi.fn()

vi.mock("@/api/quick-groups", () => ({
  getQuickGroups: (...a: unknown[]) => getQuickGroups(...a),
  putQuickGroups: (...a: unknown[]) => putQuickGroups(...a),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { QuickCards } from "@/components/pos/quick-cards"

function render(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const card = (key: string) => screen.getByTestId(`quick-card-${key}`)
const noCard = (key: string) => screen.queryByTestId(`quick-card-${key}`)
const options = () => within(screen.getByTestId("quick-card-options"))
const picker = () => within(screen.getByTestId("quick-card-picker"))
const ready = (key: string) => screen.findByTestId(`quick-card-${key}`)

const CATALOG = [
  { id: 1, name: "صنف بلا باركود", barcode: "", price: "2.00", stock: 0, category: "" },
  { id: 2, name: "صنف آخر بلا باركود", barcode: "", price: "5.00", stock: 0, category: "" },
  { id: 3, name: "صنف بباركود", barcode: "111222", price: "7.00", stock: 5, category: "" },
] as never[]

const saved = (groups: unknown[]) =>
  getQuickGroups.mockImplementation(() => Promise.resolve({ data: { groups } }))

const ONE = [
  { key: "a", label: "مجموعة", icon: "package", product_ids: [1, 2] },
]

beforeEach(() => {
  vi.clearAllMocks()
  saved([])
  putQuickGroups.mockImplementation((groups: unknown) =>
    Promise.resolve({ data: { groups } }),
  )
})

function sentGroups() {
  return putQuickGroups.mock.calls[0][0] as Array<{
    key: string
    product_ids: number[]
  }>
}

describe("a shop that has configured nothing", () => {
  it("gets no cards at all", async () => {
    const { container } = render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await waitFor(() => expect(getQuickGroups).toHaveBeenCalled())
    expect(container.textContent).toBe("")
  })

  it("survives a missing catalogue (offline cold start)", async () => {
    render(<QuickCards catalog={undefined} onPick={vi.fn()} />)
    await waitFor(() => expect(getQuickGroups).toHaveBeenCalled())
    expect(noCard("a")).toBeNull()
  })
})

describe("a saved layout", () => {
  beforeEach(() => saved(ONE))

  it("renders exactly what the shop saved", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    expect((await ready("a")).textContent).toContain("مجموعة")
  })

  it("counts the LIVE products on the card", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    expect((await ready("a")).textContent).toContain("2")
  })

  it("silently drops an id whose product no longer exists", async () => {
    // A product deleted months ago must not leave a dead tile on the till.
    saved([{ key: "a", label: "مجموعة", icon: "package", product_ids: [1, 9999] }])
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready("a")
    // One live product left → it rings on the first tap.
    fireEvent.click(card("a"))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "صنف بلا باركود" }),
    )
  })
})

describe("opening a card", () => {
  beforeEach(() => saved(ONE))

  it("reveals its options", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready("a"))
    expect(options().getByText("صنف بلا باركود")).toBeTruthy()
  })

  it("one tap on an option rings it", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    fireEvent.click(await ready("a"))
    fireEvent.click(options().getByText("صنف آخر بلا باركود"))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "صنف آخر بلا باركود" }),
    )
  })

  it("closes after ringing — a menu left open hides the cart", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready("a"))
    fireEvent.click(options().getByText("صنف بلا باركود"))
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })

  it("closes on Escape", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready("a"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })
})

describe("a card holding exactly one product", () => {
  beforeEach(() =>
    saved([{ key: "a", label: "مجموعة", icon: "package", product_ids: [1] }]),
  )

  it("rings it straight into the cart — no menu", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready("a")
    fireEvent.click(card("a"))
    expect(onPick).toHaveBeenCalled()
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })

  it("still reaches its + and X through the chevron", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready("a")
    fireEvent.click(screen.getByTestId("quick-card-a-menu"))
    expect(onPick).not.toHaveBeenCalled()
    expect(options().getByText(/إضافة صنف إلى/)).toBeTruthy()
  })
})

describe("the + at the end of every list", () => {
  beforeEach(() => saved(ONE))

  async function openPicker() {
    await ready("a")
    fireEvent.click(card("a"))
    fireEvent.click(options().getByText(/إضافة صنف إلى/))
  }

  it("searches the WHOLE catalogue, including scannable products", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker()
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "بباركود" },
    })
    expect(picker().getByText("صنف بباركود")).toBeTruthy()
  })

  it("finds a product by barcode too — the gun works in the picker", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker()
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "111222" },
    })
    expect(picker().getByText("صنف بباركود")).toBeTruthy()
  })

  it("saves the pick to the store, not to localStorage", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker()
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "111222" },
    })
    fireEvent.click(picker().getByText("صنف بباركود"))
    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups()[0].product_ids).toContain(3)
  })

  it("never adds the same product twice", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker()
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "صنف بلا" },
    })
    fireEvent.click(picker().getAllByText("صنف بلا باركود")[0])
    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups()[0].product_ids).toEqual([1, 2])
  })
})

describe("removing an option", () => {
  beforeEach(() => saved(ONE))

  it("drops it from the card and saves", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready("a"))
    const row = options().getByText("صنف آخر بلا باركود").closest("div") as HTMLElement
    fireEvent.click(
      within(row).getByRole("button", { name: "إزالة من هذه المجموعة" }),
    )
    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups()[0].product_ids).toEqual([1])
  })
})
