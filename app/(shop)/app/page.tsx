import KoupApp from '@/components/KoupApp'
import KoupAppAuthed from '@/components/koup/KoupAppAuthed'
import KoupAppFirebase from '@/components/koup/KoupAppFirebase'
import { CLERK_ON } from '@/components/koup/auth'
import { OrderingGate } from '@/components/koup/ordering-gate'
import { FIREBASE_ON } from '@/lib/firebase-web'

/* Firebase built in → the customer's web page: Google sign-in, profile,
   points and visits. Ordering lives in the Flutter app, so this page is never
   behind the ordering switch.

   Otherwise the older Clerk ordering app, gated as before; with neither key it
   opens straight up rather than crashing on a missing provider. */
export default function Page() {
  if (FIREBASE_ON) return <KoupAppFirebase />
  return (
    <OrderingGate>
      {CLERK_ON ? <KoupAppAuthed /> : <KoupApp auth={{ locked: false, user: null }} />}
    </OrderingGate>
  )
}
