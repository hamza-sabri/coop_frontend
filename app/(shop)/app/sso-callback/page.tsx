/* Server wrapper. This route exists to read the OAuth params Clerk appends to
   the URL, so there is nothing to gain from prerendering it — and plenty to
   lose: at build time there is no ClerkProvider (the layout only mounts one
   when a publishable key is present), so prerendering crashed the whole build
   with "AuthenticateWithRedirectCallback can only be used within
   <ClerkProvider />" whenever the key was missing from the build args.

   Route segment config cannot live in a 'use client' file, hence the split. */
export const dynamic = 'force-dynamic'

import SsoCallbackClient from './sso-callback-client'

export default function SsoCallback() {
  return <SsoCallbackClient />
}
