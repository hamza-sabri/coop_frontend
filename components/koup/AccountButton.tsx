'use client'
/* ==========================================================================
   The account control.

   Clerk's `UserProfile` (what `openUserProfile()` shows) has no sign-out — that
   lives on `UserButton`, which is the avatar plus a menu: manage account,
   switch account, sign out. So the avatar IS a UserButton, dressed to match
   the app rather than dropped in looking like someone else's component.
   ========================================================================== */
import { UserButton } from '@clerk/nextjs'
import { Settings2 } from 'lucide-react'

export default function AccountButton({ onSettings }: { onSettings?: () => void }) {
  /* Where sign-out lands is set once on <ClerkProvider afterSignOutUrl>.
     Passing it here as well is not a prop of UserButton — it type-errors and
     is dropped, so the redirect quietly came from the provider anyway. */
  return (
    <UserButton
      appearance={{
        elements: {
          // The trigger has to sit inside our 44px avatar slot exactly, or the
          // greeting row reflows the moment Clerk hydrates.
          userButtonBox: { width: 44, height: 44 },
          userButtonTrigger: {
            width: 44,
            height: 44,
            borderRadius: '50%',
            boxShadow:
              '0 8px 18px -8px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,255,255,.45)',
            '&:focus': { boxShadow: '0 0 0 3px rgba(221,188,138,.55)' },
          },
          avatarBox: { width: 44, height: 44 },
          userButtonPopoverCard: {
            background: 'linear-gradient(168deg,#26346C,#0C122A)',
            border: '1px solid rgba(221,188,138,.24)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,.9)',
          },
          userButtonPopoverActionButton: { color: '#F3F1EC' },
          userButtonPopoverActionButtonText: { color: '#F3F1EC' },
          userButtonPopoverFooter: { display: 'none' },
        },
      }}
    >
      {/* Language and sound live HERE, in the account menu, beside "Manage
          account" and "Sign out" — the one place a person already looks for
          things about themselves. A separate gear beside the avatar was a
          second, competing entry point for the same idea. */}
      <UserButton.MenuItems>
        <UserButton.Action
          label="الإعدادات"
          labelIcon={<Settings2 size={15} />}
          onClick={() => onSettings?.()}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
