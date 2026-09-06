import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { ModuleGuard } from "@/components/module-guard"
import { LockedFeatureProvider } from "@/components/locked-feature"
import { OfflineStatus } from "@/components/offline/offline-status"
import { OfflineGate } from "@/components/offline/offline-gate"
import { TenantGuard } from "@/components/tenant-guard"
import { DemoBanner } from "@/components/demo/demo-banner"
import { TourProvider } from "@/components/tour/tour-provider"
import { TourFromQuery } from "@/components/tour/tour-from-query"
import { TopBar } from "@/components/top-bar"
import { OrdersLiveProvider } from "@/components/orders/orders-live"
import { SyncModeBanner } from "@/components/offline/sync-mode-banner"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <LockedFeatureProvider>
        {/* One poller for the whole admin: the sidebar badge, the beep and the
            board all read the same query, so a barista is told about an order
            wherever they happen to be. */}
        <OrdersLiveProvider>
        <TourProvider>
          {/* Lock the shell to the viewport; only <main> scrolls so the floating
              ink rail and top bar stay put. */}
          <div className="flex h-dvh overflow-hidden">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <SyncModeBanner />
              <TopBar />
              <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-8 md:pb-10 md:pt-3">
                <ModuleGuard>{children}</ModuleGuard>
              </main>
            </div>
          </div>
          <BottomNav />
          <TenantGuard />
          <OfflineGate />
          <OfflineStatus />
          <DemoBanner />
          <TourFromQuery />
        </TourProvider>
        </OrdersLiveProvider>
      </LockedFeatureProvider>
    </AuthGuard>
  )
}
