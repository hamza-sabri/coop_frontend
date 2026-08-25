import KoupApp from '@/components/KoupApp'
import KoupAppAuthed from '@/components/koup/KoupAppAuthed'
import { CLERK_ON } from '@/components/koup/auth'

/* With Clerk configured the app is gated. Without it — before the keys land,
   or in a test run — it opens straight up rather than crashing on a missing
   provider. Same screens either way. */
export default function Page() {
  if (CLERK_ON) return <KoupAppAuthed />
  return <KoupApp auth={{ locked: false, user: null }} />
}
