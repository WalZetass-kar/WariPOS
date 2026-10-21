/**
 * Skema tabel antrean sinkronisasi.
 *
 * DDL-nya diletakkan di folder database supaya bisa dipakai oleh migrasi
 * startup dan oleh lapisan backend tanpa membuat ketergantungan lingkaran.
 */
export const SYNC_QUEUE_TABLE = 'mediasoft_sync_queue'

export const SYNC_QUEUE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ${SYNC_QUEUE_TABLE} (
  id             TEXT PRIMARY KEY,
  entity         TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  operation      TEXT NOT NULL,
  payload        TEXT NOT NULL DEFAULT '{}',
  delta          REAL,
  device_id      TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  status         TEXT NOT NULL DEFAULT 'PENDING',
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  conflict_note  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON ${SYNC_QUEUE_TABLE} (status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON ${SYNC_QUEUE_TABLE} (entity, entity_id);
`

export interface SqliteLike {
  exec: (sql: string) => void
}

export function ensureSyncQueueTable(sqlite: SqliteLike): void {
  sqlite.exec(SYNC_QUEUE_SCHEMA_SQL)
}
