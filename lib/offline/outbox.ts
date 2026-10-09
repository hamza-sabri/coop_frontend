"use client"

/**
 * The till's other offline writes.
 *
 * Sales have their own queue (queue.ts). Two more things happen at the
 * counter and must work with the internet down:
 *
 *   customer — a regular gives a name and a number for their points. The
 *              till mints a client id for them; a sale rung for them offline
 *              names that id (`customer_client_uuid`), and the server resolves
 *              it once this row has synced. Same phone as someone already on
 *              file = the same person: the server adopts the existing row.
 *   return   — a drink handed back against a synced sale.
 *
 * Replay order is the contract: customers → sales → returns. Each op carries
 * its own client_uuid, so a replay after an ambiguous failure is a no-op on
 * the server rather than a duplicate.
 */
import { customFetch } from "@/api/http"
import { STORE_OUTBOX, idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb"
import { announceQueueChange, uuid } from "@/lib/offline/queue"
import { guideWriteBlocked, isGuideLive } from "@/lib/tour/guide-live"

export type OutboxKind = "customer" | "return"

export type OutboxOp = {
  id: string
  kind: OutboxKind
  url: string
  method: "POST" | "PATCH"
  body: Record<string, unknown>
  /** For the pending list: "زبون: سامر", "إرجاع: لاتيه". */
  label: string
  createdAt: number
  attempts: number
  lastError?: string
}

export async function listOps(kind?: OutboxKind): Promise<OutboxOp[]> {
  try {
    const rows = await idbGetAll<OutboxOp>(STORE_OUTBOX)
    return rows
      .filter((r) => !kind || r.kind === kind)
      .sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

async function put(op: OutboxOp) {
  await idbPut(STORE_OUTBOX, op)
  announceQueueChange()
}

async function drop(id: string) {
  await idbDelete(STORE_OUTBOX, id)
  announceQueueChange()
}

function status(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status
}

/** The server answered and said no — retrying the same body cannot help. */
function rejected(e: unknown): boolean {
  const s = status(e)
  return typeof s === "number" && s >= 400 && s < 500 && s !== 401
}

export type SendResult<T> = { status: "sent"; data: T } | { status: "queued"; op: OutboxOp }

/**
 * Send now if we can; otherwise keep it, durably, for the sync loop.
 * A 4xx is thrown to the caller (the cashier has to fix something); any
 * other failure means "not now", and the op waits.
 */
export async function sendOrQueue<T>(
  kind: OutboxKind,
  url: string,
  body: Record<string, unknown>,
  label: string,
): Promise<SendResult<T>> {
  // A guide is running: never keep a practice write to send later.
  if (isGuideLive()) throw guideWriteBlocked()
  const id = String(body.client_uuid ?? uuid())
  const op: OutboxOp = {
    id,
    kind,
    url,
    method: "POST",
    body: { ...body, client_uuid: id },
    label,
    createdAt: Date.now(),
    attempts: 0,
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await put(op)
    return { status: "queued", op }
  }
  try {
    const res = await customFetch<{ data: T }>(url, {
      method: op.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.body),
    })
    return { status: "sent", data: res.data }
  } catch (e) {
    if (rejected(e)) throw e
    await put(op)
    return { status: "queued", op }
  }
}

export type OutboxFlush = { synced: number; failed: number; stopped: boolean }

/** Replay ops of the given kinds, oldest first. Stops at the first transport
 *  failure (still offline); flags and skips a rejected op. */
export async function flushOutbox(kinds: OutboxKind[]): Promise<OutboxFlush> {
  let synced = 0
  let failed = 0
  for (const op of await listOps()) {
    if (!kinds.includes(op.kind)) continue
    try {
      await customFetch(op.url, {
        method: op.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op.kind === "customer" ? { ...op.body, merge_on_phone: true } : op.body),
      })
      await drop(op.id)
      synced += 1
    } catch (e) {
      if (rejected(e)) {
        await put({ ...op, attempts: op.attempts + 1, lastError: e instanceof Error ? e.message : "rejected" })
        failed += 1
        continue
      }
      return { synced, failed, stopped: true }
    }
  }
  return { synced, failed, stopped: false }
}

/** Customers made at the counter that have not reached the server yet —
 *  shown in the customer picker so the cashier can find them again. */
export async function localCustomers(): Promise<{ clientUuid: string; name: string; phone: string }[]> {
  return (await listOps("customer")).map((op) => ({
    clientUuid: op.id,
    name: String(op.body.name ?? ""),
    phone: String(op.body.phone ?? ""),
  }))
}
