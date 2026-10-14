import KoupApp from '@/components/KoupApp'
import PhoneGate from '@/components/koup/PhoneGate'

/* Sign-up is by mobile number now: the staff register customers at the till
   (name + number) and points count there. Google/Facebook sign-in on the web
   is retired; the كوب app (Flutter, coming soon) will sign customers in with
   that same number by SMS code and find their points.

   So the web page is the menu behind a card that explains exactly that. */
export default function Page() {
  return <KoupApp auth={{ locked: true, user: null, Gate: PhoneGate }} />
}
