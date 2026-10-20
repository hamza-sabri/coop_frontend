/* /app/i/<token> — the link staff texted. Signs the customer in with no
   second SMS. The token is spent by a POST from the page's own script (see
   InviteClient), never by loading the URL: messaging apps open links to draw
   previews, and a page that signed people in on GET would be spent by the
   preview bot before the customer ever tapped it. */
export const dynamic = 'force-dynamic'

import InviteClient from './invite-client'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <InviteClient token={token} />
}
