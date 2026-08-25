/* TEMPORARY, dev-only. A doorway for dropping source audio into the repo from
   the browser, because this machine's sandbox cannot reach the sound CDNs.
   Delete this route once the files are in. */
import type { NextRequest } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === 'production') return new Response('not here', { status: 404 })
  const { name } = await ctx.params
  if (!/^[a-z0-9._-]+\.mp3$/i.test(name)) {
    return new Response('bad name', { status: 400, headers: CORS })
  }
  const dir = path.join(process.cwd(), 'public', 'koup', 'sfx', '_src')
  await mkdir(dir, { recursive: true })
  const buf = Buffer.from(await req.arrayBuffer())
  await writeFile(path.join(dir, name), buf)
  return new Response(JSON.stringify({ ok: true, name, bytes: buf.length }), {
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}
