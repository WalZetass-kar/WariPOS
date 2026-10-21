-- Antrean mutasi untuk sinkronisasi multi perangkat.
--
-- Setiap baris adalah satu perubahan yang belum atau sudah tersinkron ke
-- server. Entri tidak pernah dihapus, statusnya yang berubah, jadi riwayat
-- bisa dipakai saat menelusuri selisih antar perangkat.
CREATE TABLE IF NOT EXISTS mediasoft_sync_queue (
  id            TEXT PRIMARY KEY,
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  operation     TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  delta         REAL,
  device_id     TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL DEFAULT 'PENDING',
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  conflict_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON mediasoft_sync_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON mediasoft_sync_queue (entity, entity_id);
