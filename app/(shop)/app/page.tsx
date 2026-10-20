import KoupAppPhone from '@/components/koup/KoupAppPhone'

/* The customer app: sign in by mobile number (SMS code, or the link the staff
   texted), then points, visits and profile. The session is per store, so the
   same page serves every café on the platform. See lib/customer-session.ts. */
export default function Page() {
  return <KoupAppPhone />
}
