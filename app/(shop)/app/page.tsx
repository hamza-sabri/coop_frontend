import KoupApp from '@/components/KoupApp'
import KoupAppAuthed from '@/components/koup/KoupAppAuthed'
import { CLERK_ON } from '@/components/koup/auth'
import { OrderingGate } from '@/components/koup/ordering-gate'

/* With Clerk configured the app is gated. Without it — before the keys land,
   or in a test run — it opens straight up rather than crashing on a missing
   provider. Same screens either way. */
export default function Page() {
  // Behind the server's ordering switch: while it is off this page is a
  // holding screen, not a shop. See components/koup/ordering-gate.tsx.
  return (
    <OrderingGate>
      {CLERK_ON ? <KoupAppAuthed /> : <KoupApp auth={{ locked: false, user: null }} />}
    </OrderingGate>
  )
}
