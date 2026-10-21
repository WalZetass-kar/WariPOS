/**
 * Aturan sinkronisasi data.
 *
 * Dua kasir yang sama-sama offline tidak boleh saling menimpa angka. Karena
 * itu tiap jenis data punya aturan sendiri:
 *
 * - Data append-only (transaksi, mutasi stok, shift) tidak pernah ditimpa.
 *   Perubahan dikirim sebagai delta dan dijumlahkan di server.
 * - Data yang bisa diubah (produk, pelanggan, harga) memakai last-write-wins
 *   berdasarkan `updated_at`, dan selisih yang tidak bisa digabung dicatat
 *   sebagai konflik untuk ditinjau manusia.
 */

export type SyncEntity =
  | 'penjualan'
  | 'penjualan_detail'
  | 'stock_mutation'
  | 'shift'
  | 'kas'
  | 'barang'
  | 'harga'
  | 'customer'
  | 'supplier'
  | 'kategori'
  | 'satuan'
  | 'promo'
  | 'purchase'

export type SyncOperation = 'upsert' | 'delta' | 'delete'

export type ConflictStrategy = 'append-only' | 'last-write-wins' | 'delta'

export interface SyncMutation {
  id: string
  entity: SyncEntity
  entityId: string
  operation: SyncOperation
  /** Isi perubahan dalam bentuk JSON. */
  payload: Record<string, unknown>
  /** Nilai yang ditambahkan untuk operasi delta, misal -3 untuk stok keluar. */
  delta?: number
  /** Waktu perubahan pada perangkat asal. */
  updatedAt: string
  /** Perangkat yang membuat perubahan. */
  deviceId: string
  attempts: number
}

export interface RemoteVersion {
  updatedAt: string
  deviceId: string
  payload?: Record<string, unknown>
}

export type ConflictResolution =
  | { outcome: 'apply-local' }
  | { outcome: 'apply-remote' }
  | { outcome: 'merge-delta'; delta: number }
  | { outcome: 'conflict'; reason: string }

/** Entitas yang isinya hanya bertambah dan tidak pernah ditimpa. */
const APPEND_ONLY: ReadonlySet<SyncEntity> = new Set<SyncEntity>([
  'penjualan',
  'penjualan_detail',
  'shift',
  'kas',
])

/** Entitas yang perubahannya dijumlahkan, misalnya penyesuaian stok. */
const DELTA_ENTITIES: ReadonlySet<SyncEntity> = new Set<SyncEntity>([
  'stock_mutation',
])

export function conflictStrategyFor(entity: SyncEntity): ConflictStrategy {
  if (DELTA_ENTITIES.has(entity)) return 'delta'
  if (APPEND_ONLY.has(entity)) return 'append-only'
  return 'last-write-wins'
}

export function isAppendOnly(entity: SyncEntity): boolean {
  return conflictStrategyFor(entity) === 'append-only'
}

/**
 * Putuskan apa yang harus berlaku ketika perubahan lokal bertemu perubahan
 * dari perangkat lain.
 *
 * Aturan main:
 * 1. Data append-only selalu ikut tersinkron, tidak pernah ditimpa.
 * 2. Delta dijumlahkan, jadi dua kasir offline tidak saling menghapus stok.
 * 3. Selain itu, perubahan yang lebih baru menang. Kalau waktunya sama dan
 *    datang dari perangkat lain, perubahan dicatat sebagai konflik untuk
 *    ditinjau manusia, tidak ada perubahan yang dibuang diam-diam.
 */
export function resolveConflict(
  entity: SyncEntity,
  local: SyncMutation,
  remote: RemoteVersion,
): ConflictResolution {
  const strategy = conflictStrategyFor(entity)

  if (strategy === 'append-only') {
    return { outcome: 'apply-local' }
  }

  if (strategy === 'delta') {
    return { outcome: 'merge-delta', delta: local.delta ?? 0 }
  }

  const localTime = Date.parse(local.updatedAt)
  const remoteTime = Date.parse(remote.updatedAt)

  if (Number.isNaN(localTime) || Number.isNaN(remoteTime)) {
    return { outcome: 'apply-local' }
  }

  if (localTime > remoteTime) return { outcome: 'apply-local' }
  if (localTime < remoteTime) return { outcome: 'apply-remote' }

  // Waktu sama, perangkat berbeda: perlakukan sebagai konflik agar ada yang
  // reviewing, jangan ada perubahan yang hilang tanpa jejak.
  if (remote.deviceId && remote.deviceId !== local.deviceId) {
    return {
      outcome: 'conflict',
      reason: `Perubahan ${entity} ${local.entityId} berhadapan dengan perubahan dari perangkat lain pada waktu yang sama`,
    }
  }

  return {
    outcome: 'conflict',
    reason: `Perubahan ${entity} ${local.entityId} tidak bisa dipastikan urutan waktunya`,
  }
}

/** Gabungkan delta stok menjadi saldo akhir. */
export function applyStockDelta(currentStock: number, delta: number): number {
  const next = Number(currentStock) + Number(delta)
  return Number.isFinite(next) ? next : Number(currentStock) || 0
}

/** Susun perubahan minimal dari dua versi payload. */
export function mergePayloads(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...remote }
  for (const field of fields) {
    if (local[field] !== undefined) merged[field] = local[field]
  }
  return merged
}

/** Saring payload agar hanya field yang diizinkan ikut tersinkron. */
export function pickFields(
  payload: Record<string, unknown>,
  allowed: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of allowed) {
    if (payload[field] !== undefined) result[field] = payload[field]
  }
  return result
}
