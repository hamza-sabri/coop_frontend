"use client"

/**
 * المخزون — what the café BUYS: cups, lids, milk, beans, fruit.
 *
 * Two tabs. الأصناف is the shelf: how much of each, how long it lasts, and
 * the two things done to it daily (a delivery, a spill). نظرة عامة is the
 * owner's: the shelf in money and where it went.
 *
 * Stock moves five ways, each a row in the item's statement: شراء, بيع (the
 * recipe of every drink sold), إعادة تحضير, هدر, جرد. Employees see
 * quantities and record waste and counts; what anything COST is the owner's,
 * stripped by the server before it reaches their phone.
 */
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardCheck, Plus } from "lucide-react"

import { listItems, type InventoryItem } from "@/api/inventory"
import { Enter, PageShell } from "@/components/page-shell"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { PurchaseForm, WasteForm } from "@/components/stock/forms"
import { StockInsights } from "@/components/stock/insights"
import { ItemDrawer } from "@/components/stock/item-drawer"
import { ItemList } from "@/components/stock/item-list"
import { Stocktake } from "@/components/stock/stocktake"
import { Button } from "@/components/ui/button"
import { useIsOwner } from "@/lib/modules"

export default function StockPage() {
  const isOwner = useIsOwner()
  const qc = useQueryClient()
  const [tab, setTab] = useState<"items" | "overview">("items")
  const [open, setOpen] = useState<InventoryItem | "new" | null>(null)
  const [buying, setBuying] = useState<InventoryItem | null>(null)
  const [wasting, setWasting] = useState<InventoryItem | null>(null)
  const [counting, setCounting] = useState(false)

  const items = useQuery({ queryKey: ["inventory", "items"], queryFn: () => listItems() })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inventory"] })
    qc.invalidateQueries({ queryKey: ["reports"] })
  }
  const showOverview = isOwner && tab === "overview"

  return (
    <PageShell
      title="المخزون"
      action={
        <>
          {isOwner ? (
            <Button size="sm" className="bg-brand-gradient gap-1.5 shadow-md shadow-primary/25" onClick={() => setOpen("new")}>
              <Plus className="size-4" />
              صنف
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCounting(true)} aria-label="جرد المخزون">
            <ClipboardCheck className="size-4" />
            <span className="max-sm:hidden">جرد</span>
          </Button>
        </>
      }
    >
      {isOwner ? (
        <SegmentedTabs
          tabs={[
            { id: "items", label: "الأصناف" },
            { id: "overview", label: "نظرة عامة" },
          ]}
          active={tab}
          onChange={(t) => setTab(t as "items" | "overview")}
        />
      ) : null}

      <Enter key={showOverview ? "o" : "i"} i={1}>
        {showOverview ? (
          <StockInsights items={items.data ?? []} onBuy={setBuying} />
        ) : (
          <ItemList
            items={items.data ?? []}
            loading={items.isLoading}
            isOwner={isOwner}
            onOpen={setOpen}
            onBuy={setBuying}
            onWaste={setWasting}
          />
        )}
      </Enter>

      <ItemDrawer
        item={open === "new" ? null : open}
        open={open != null}
        onOpenChange={(o) => !o && setOpen(null)}
        onSaved={refresh}
        onBuy={(i) => setBuying(i)}
        onWaste={(i) => setWasting(i)}
      />
      <PurchaseForm item={buying} onClose={() => setBuying(null)} onSaved={refresh} />
      <WasteForm item={wasting} onClose={() => setWasting(null)} onSaved={refresh} />
      <Stocktake open={counting} onClose={() => setCounting(false)} items={items.data ?? []} onSaved={refresh} />
    </PageShell>
  )
}
