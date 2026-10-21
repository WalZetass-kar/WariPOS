import { sqlite } from '../../database/connection.js'
import { ensureSyncQueueTable, SYNC_QUEUE_TABLE as TABLE } from '../../database/syncQueueSchema.js'
import type { SyncMutation } from '../../shared/sync/conflict.js'
import type { SyncQueueStore } from '../../shared/sync/queue.js'

/**
 * Antrean mutasi di database lokal.
 *
 * Tabelnya memakai pola append-only, jadi mutasi yang sudah terkirim tidak
 * pernah dihapus, hanya ditandai. Riwayat ini dipakai saat dibutuhkan untuk
 * memeriksaselisih antara perangkat.
 */

function rowToMutation(row: any): SyncMutation {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row.payload || '{}')
  } catch {
    payload = {}
  }

  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    operation: row.operation,
    payload,
    delta: row.delta ?? undefined,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    attempts: row.attempts ?? 0,
  }
}

export class SqliteSyncQueue implements SyncQueueStore {
  constructor() {
    ensureSyncQueueTable(sqlite)
  }

  enqueue(mutation: SyncMutation): void {
    sqlite.prepare(
      `INSERT OR REPLACE INTO ${TABLE}
       (id, entity, entity_id, operation, payload, delta, device_id, updated_at, status, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
    ).run(
      mutation.id,
      mutation.entity,
      mutation.entityId,
      mutation.operation,
      JSON.stringify(mutation.payload ?? {}),
      mutation.delta ?? null,
      mutation.deviceId,
      mutation.updatedAt,
    )
  }

  listPending(limit = 100): SyncMutation[] {
    const rows = sqlite
      .prepare(`SELECT * FROM ${TABLE} WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`)
      .all(limit) as any[]
    return rows.map(rowToMutation)
  }

  listConflicts(limit = 50): SyncMutation[] {
    const rows = sqlite
      .prepare(`SELECT * FROM ${TABLE} WHERE status = 'CONFLICT' ORDER BY created_at ASC LIMIT ?`)
      .all(limit) as any[]
    return rows.map(rowToMutation)
  }

  markSynced(id: string): void {
    sqlite.prepare(`UPDATE ${TABLE} SET status = 'SYNCED', last_error = NULL WHERE id = ?`).run(id)
  }

  markFailed(id: string, error: string): void {
    sqlite.prepare(
      `UPDATE ${TABLE} SET status = 'FAILED', attempts = attempts + 1, last_error = ? WHERE id = ?`,
    ).run(error, id)
  }

  markConflict(id: string, reason: string): void {
    sqlite.prepare(
      `UPDATE ${TABLE} SET status = 'CONFLICT', conflict_note = ?, attempts = attempts + 1 WHERE id = ?`,
    ).run(reason, id)
  }

  countPending(): number {
    const row = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${TABLE} WHERE status = 'PENDING'`).get() as { c: number }
    return row?.c ?? 0
  }

  clear(): void {
    sqlite.prepare(`DELETE FROM ${TABLE} WHERE status IN ('PENDING', 'FAILED')`).run()
  }
}

let queueInstance: SqliteSyncQueue | null = null

export function getSyncQueue(): SqliteSyncQueue {
  if (!queueInstance) queueInstance = new SqliteSyncQueue()
  return queueInstance
}
