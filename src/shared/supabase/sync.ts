import { supabase } from './config.js'
import {
  type RemoteVersion,
  type SyncEntity,
  type SyncMutation,
  resolveConflict,
} from '../sync/conflict.js'

/**
 * Sinkronisasi mutasi dengan Supabase.
 *
 * Server tidak menerima angka stok langsung, dia menerima mutasi. Klien
 * mengirim perubahan yang belum tersinkron, lalu menarik perubahan dari
 * perangkat lain. Perubahan yang berhadapan diselesaikan dengan aturan
 * konflik yang sama di semua perangkat.
 */

const MUTATION_TABLE = 'sync_mutations'

export interface RemoteMutation {
  id: string
  device_id: string
  entity: SyncEntity
  entity_id: string
  operation: string
  payload: Record<string, unknown>
  delta: number | null
  updated_at: string
}

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: number
  error?: string
}

function toRemoteMutation(row: any): RemoteMutation {
  return {
    id: String(row.id),
    device_id: String(row.device_id ?? ''),
    entity: row.entity as SyncEntity,
    entity_id: String(row.entity_id ?? ''),
    operation: String(row.operation ?? 'upsert'),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    delta: row.delta ?? null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

/** Kirim mutasi lokal ke server. */
export async function pushMutations(mutations: SyncMutation[]): Promise<number> {
  if (mutations.length === 0) return 0

  const rows = mutations.map(mutation => ({
    id: mutation.id,
    device_id: mutation.deviceId,
    entity: mutation.entity,
    entity_id: mutation.entityId,
    operation: mutation.operation,
    payload: mutation.payload ?? {},
    delta: mutation.delta ?? null,
    updated_at: mutation.updatedAt,
  }))

  const { error } = await (supabase.from(MUTATION_TABLE) as any).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(error.message)

  return rows.length
}

/** Tarik mutasi dari perangkat lain yang lebih baru dari kursor. */
export async function pullMutations(since?: string, limit = 200): Promise<RemoteMutation[]> {
  let query = (supabase.from(MUTATION_TABLE) as any)
    .select('*')
    .order('received_at', { ascending: true })
    .limit(limit)

  if (since) query = query.gt('received_at', since)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(toRemoteMutation)
}

/**
 * Bandingkan mutasi yang datang dari perangkat lain dengan mutasi lokal yang
 * masih tertunda. Hasilnya menentukan apakah perubahan lokal tetap dikirim,
 * dibatalkan, atau ditandai sebagai konflik.
 */
export function classifyRemoteMutations(
  remote: RemoteMutation[],
  pending: SyncMutation[],
): { send: SyncMutation[]; drop: SyncMutation[]; conflicts: Array<{ local: SyncMutation; reason: string }> } {
  const send: SyncMutation[] = []
  const drop: SyncMutation[] = []
  const conflicts: Array<{ local: SyncMutation; reason: string }> = []

  for (const local of pending) {
    const counterpart = remote.find(
      item => item.entity === local.entity && item.entity_id === local.entityId && item.device_id !== local.deviceId,
    )

    if (!counterpart) {
      send.push(local)
      continue
    }

    const remoteVersion: RemoteVersion = {
      updatedAt: counterpart.updated_at,
      deviceId: counterpart.device_id,
      payload: counterpart.payload,
    }
    const resolution = resolveConflict(local.entity, local, remoteVersion)

    if (resolution.outcome === 'apply-local') {
      send.push(local)
    } else if (resolution.outcome === 'apply-remote') {
      drop.push(local)
    } else if (resolution.outcome === 'merge-delta') {
      send.push(local)
    } else {
      conflicts.push({ local, reason: resolution.reason })
    }
  }

  return { send, drop, conflicts }
}

export interface SyncCallbacks {
  getPending: () => SyncMutation[]
  markSynced: (id: string) => void
  markFailed: (id: string, error: string) => void
  markConflict: (id: string, reason: string) => void
  onRemoteMutations?: (mutations: RemoteMutation[]) => void
}

/** Jalankan satu siklus sinkronisasi. */
export async function runSync(callbacks: SyncCallbacks): Promise<SyncResult> {
  const pending = callbacks.getPending()
  if (pending.length === 0) return { pushed: 0, pulled: 0, conflicts: 0 }

  try {
    const remote = await pullMutations()
    const { send, drop, conflicts } = classifyRemoteMutations(remote, pending)

    for (const mutation of drop) callbacks.markSynced(mutation.id)
    for (const conflict of conflicts) callbacks.markConflict(conflict.local.id, conflict.reason)

    const pushed = await pushMutations(send)
    for (const mutation of send) callbacks.markSynced(mutation.id)

    callbacks.onRemoteMutations?.(remote)

    return { pushed, pulled: remote.length, conflicts: conflicts.length }
  } catch (error: any) {
    const message = error?.message || 'Sinkronisasi gagal'
    for (const mutation of pending) callbacks.markFailed(mutation.id, message)
    return { pushed: 0, pulled: 0, conflicts: 0, error: message }
  }
}
