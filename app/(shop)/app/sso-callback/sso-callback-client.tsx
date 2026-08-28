'use client'
/* Where Google and Facebook drop the customer back. Clerk finishes the
   handshake here and sends them into the app; this screen is on-brand rather
   than a white flash, because it is the first thing after they say yes. */
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { CLERK_ON } from '@/components/koup/auth'

export default function SsoCallbackClient() {
  return (
    <div className="koup">
      <div className="koup-inner">
        <div className="splash">
          <div className="splash-in">
            <div className="koup-lockup">
              <div className="koup-word">كوب</div>
              <div className="koup-rule" style={{ transform: 'scaleX(1)' }} />
              <div className="koup-sub" style={{ opacity: 1 }}>Coffee House</div>
            </div>
            <p style={{ marginTop: 22, fontSize: 13, color: 'rgba(247,241,232,.7)' }}>
              لحظة، عم نجهّز كوبك…
            </p>
          </div>
        </div>
      </div>
      {/* Without a publishable key the (shop) layout renders no ClerkProvider,
          and this component throws inside it. Guarding here keeps a
          misconfigured deploy on the splash instead of a crashed route. */}
      {CLERK_ON && (
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
        />
      )}
    </div>
  )
}
