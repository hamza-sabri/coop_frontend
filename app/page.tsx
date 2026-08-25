import { redirect } from "next/navigation"

/**
 * `/` IS the customer app.
 *
 * كوب's front door is the shop, not the till. A customer who types the bare
 * domain — or lands here after signing out — should get the menu and their
 * cup, never a staff login form they have no business seeing.
 *
 * Staff go to /login directly; the login page bounces an already
 * authenticated session on to /pos.
 *
 * (The template shipped a landing page guarded by `isCentral()`. That guard
 * can never fire from a Server Component: lib/site.ts documents that
 * currentTenant() returns CENTRAL on the server because only
 * lib/tenant.server.ts can see the Host header. So the guard was inert and
 * every tenant domain rendered the marketing page.)
 */
export default function HomePage() {
  redirect("/app")
}
