import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Aref_Ruqaa, Bricolage_Grotesque, Noto_Sans_Hebrew } from 'next/font/google'
import './koup.css'

/* The display face for the balance and the numerals — the wide-tracked Latin
   voice on the cup. Arabic keeps IBM Plex Sans Arabic from the root layout. */
const display = Bricolage_Grotesque({
  variable: '--font-display', subsets: ['latin'], weight: ['400', '600', '800'],
})
const hebrew = Noto_Sans_Hebrew({
  variable: '--font-hebrew', subsets: ['hebrew'], weight: ['400', '500', '700'],
})

/* The wordmark. Their cup carries a flowing calligraphic كوب, so the splash
   should read as that word — not as an abstract stroke that happens to curl. */
const wordmark = Aref_Ruqaa({
  variable: '--font-wordmark', subsets: ['arabic', 'latin'], weight: ['400', '700'],
})

/* The customer side is a PWA, not a page: it is installed to the home screen
   and opened like an app. viewport-fit=cover so the dark ground runs under the
   iOS notch and home indicator instead of leaving white bands. */
export const metadata: Metadata = {
  title: 'كوب',
  description: 'اطلب من كوب، واجمع حبّاتك.',
  manifest: '/koup/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'كوب' },
}

export const viewport: Viewport = {
  themeColor: '#0B1129',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

/* Clerk's frontend API host is encoded in the publishable key. Opening the TCP
   and TLS handshake to it while the page is still parsing takes that cost off
   the critical path — worth ~100-300ms here, more on a phone in Qalqilya. */
function clerkHost() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  try {
    return Buffer.from(pk.replace(/^pk_(test|live)_/, ''), 'base64')
      .toString('utf8').replace(/\$$/, '')
  } catch { return '' }
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const host = clerkHost()
  const body = (
    <div className={`${display.variable} ${hebrew.variable} ${wordmark.variable}`}>
      {host && (
        <>
          <link rel="preconnect" href={`https://${host}`} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={`https://${host}`} />
        </>
      )}
      {children}
    </div>
  )
  // No key yet → no provider. ClerkProvider throws without one, and a customer
  // app that will not render is worse than one that is briefly open.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return body

  /* Clerk wraps ONLY the customer app. The staff admin keeps its own Django
     login — two audiences, two auth systems, no shared session to confuse. */
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      // Signing out returns you to the shop, blurred behind the door — not to
      // a login page, and never to the staff side.
      afterSignOutUrl="/app"
      appearance={{
        /* Names per Clerk v7: colorText/colorTextSecondary/colorInputBackground
           /colorInputText were renamed to colorForeground/colorMutedForeground
           /colorInput/colorInputForeground. The old ones type-error and, worse,
           are silently ignored at runtime — the modal renders in Clerk's own
           colours and opening your account looks like leaving the app.
           Clerk renders its own account UI — profile, connected accounts,
           security, sign out. Dress it in the app's palette so opening it does
           not feel like leaving the app. */
        variables: {
          colorPrimary: '#C9A063',
          colorBackground: '#141C3B',
          colorForeground: '#F3F1EC',
          colorMutedForeground: '#A8B1D4',
          colorInput: '#1E2957',
          colorInputForeground: '#F3F1EC',
          colorNeutral: '#D8DDEC',
          colorDanger: '#D97C67',
          colorSuccess: '#7FD1AE',
          colorWarning: '#DDBC8A',
          borderRadius: '16px',
          fontFamily: 'var(--font-arabic), system-ui, sans-serif',
        },
        elements: {
          card: { boxShadow: '0 30px 70px -24px rgba(0,0,0,.85)' },
          modalBackdrop: { backdropFilter: 'blur(6px)' },
        },
      }}
    >
      {body}
    </ClerkProvider>
  )
}
