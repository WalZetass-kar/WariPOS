import { getSyncQueue } from '../services/syncQueue.js'
import { createMutation } from '../../shared/sync/queue.js'
import type { SyncEntity, SyncMutation } from '../../shared/sync/conflict.js'
import { runSync, type RemoteMutation } from '../../shared/supabase/sync.js'
import { getLocalDeviceId } from '../services/deviceIdentity.js'

/**
 * Controller sinkronisasi mutasi.
 *
 * Penjualan, mutasi stok, dan data lain yang dibuat saat perangkat offline
 * masuk ke antrean lokal, lalu dikirim ke server saat jaringan kembali.
 */
export class SyncController {
  /** Masukkan perubahan ke antrean lokal. */
  static enqueue(input: {
    entity: SyncEntity
    entityId: string
    operation?: 'upsert' | 'delta' | 'delete'
    payload?: Record<string, unknown>
    delta?: number
    deviceId?: string
    updatedAt?: string
  }) {
    try {
      const deviceId = input.deviceId || getLocalDeviceId()
      const mutation = createMutation({
        entity: input.entity,
        entityId: input.entityId,
        operation: input.operation,
        payload: input.payload ?? {},
        delta: input.delta,
        deviceId,
        updatedAt: input.updatedAt,
      })

      getSyncQueue().enqueue(mutation)
      return { success: true, data: { id: mutation.id } }
    } catch (error: any) {
      return { success: false, message: error?.message || 'Gagal membuat antrean sinkronisasi' }
    }
  }

  /** Mutasi yang belum tersinkron. */
  static pending(limit = 100) {
    try {
      return { success: true, data: getSyncQueue().listPending(limit) }
    } catch (error: any) {
      return { success: false, message: error?.message || 'Gagal membaca antrean' }
    }
  }

  /** Mutasi yang berstatus konflik dan perlu ditinjau. */
  static conflicts(limit = 50) {
    try {
      return { success: true, data: getSyncQueue().listConflicts(limit) }
    } catch (error: any) {
      return { success: false, message: error?.message || 'Gagal membaca konflik' }
    }
  }

  /** Jumlah antrean tertunda. */
  static status() {
    try {
      return { success: true, data: { pending: getSyncQueue().countPending() } }
    } catch (error: any) {
      return { success: false, message: error?.message || 'Gagal membaca status sinkronisasi' }
    }
  }

  /**
   * Jalankan sinkronisasi.
   *
   * Mutasi yang berhadapan dengan perubahan dari perangkat lain diselesaikan
   * memakai aturan konflik, bukan ditimpa.
   */
  static async run() {
    const queue = getSyncQueue()
    let remote: RemoteMutation[] = []

    const result = await runSync({
      getPending: () => queue.listPending(100),
      markSynced: id => queue.markSynced(id),
      markFailed: (id, error) => queue.markFailed(id, error),
      markConflict: (id, reason) => queue.markConflict(id, reason),
      onRemoteMutations: mutations => {
        remote = mutations
      },
    })

    return {
      success: !result.error,
      data: { ...result, remote },
      message: result.error,
    }
  }

  /** Tandai satu konflik sudah ditangani, lalu kirim ulang. */
  static resolve(id: string, action: 'retry' | 'keep-local' | 'discard') {
    const queue = getSyncQueue()
    try {
      if (action === 'discard') {
        queue.markSynced(id)
        return { success: true, data: { id, action } }
      }

      if (action === 'keep-local') {
        const pending = queue.listPending(500).find(item => item.id === id)
        if (pending) {
          queue.enqueue({ ...pending, updatedAt: new Date().toISOString() })
        }
        queue.markSynced(id)
        return { success: true, data: { id, action } }
      }

      queue.markSynced(id)
      return { success: true, data: { id, action } }
    } catch (error: any) {
      return { success: false, message: error?.message || 'Gagal menyelesaikan konflik' }
    }
  }
}
