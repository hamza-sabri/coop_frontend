/* GET /version — which build this server is running.
 *
 * The open app compares it with the build it was loaded from; when they
 * differ, a new version has been deployed AND is up and answering, and the
 * app offers «يوجد تحديث جديد — اضغط للتحديث». While a deploy is still
 * starting (or failed), this does not answer, so nobody is offered a version
 * that is not running. Never cached. */
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
