import { describe, expect, it } from 'vitest'
import {
  applyStockDelta,
  conflictStrategyFor,
  isAppendOnly,
  mergePayloads,
  pickFields,
  resolveConflict,
  type SyncMutation,
} from '../src/shared/sync/conflict'
import { MemorySyncQueue, createMutation } from '../src/shared/sync/queue'
import { classifyRemoteMutations } from '../src/shared/supabase/sync'

function mutation(overrides: Partial<SyncMutation> = {}): SyncMutation {
  return {
    id: 'mut_1',
    entity: 'barang',
    entityId: 'BRG-001',
    operation: 'upsert',
    payload: { nama_barang: 'Kopi Susu', harga_barang: 18000 },
    updatedAt: '2026-10-20T10:00:00.000Z',
    deviceId: 'dev_a',
    attempts: 0,
    ...overrides,
  }
}

describe('aturan konflik', () => {
  it('menandai transaksi dan shift sebagai append-only', () => {
    expect(isAppendOnly('penjualan')).toBe(true)
    expect(isAppendOnly('shift')).toBe(true)
    expect(conflictStrategyFor('stock_mutation')).toBe('delta')
    expect(conflictStrategyFor('barang')).toBe('last-write-wins')
  })

  it('tidak pernah menimpa data append-only', () => {
    const local = mutation({ entity: 'penjualan', entityId: 'FJ-1' })
    const resolution = resolveConflict('penjualan', local, {
      updatedAt: '2026-10-20T11:00:00.000Z',
      deviceId: 'dev_b',
    })

    expect(resolution.outcome).toBe('apply-local')
  })

  it('menjumlahkan delta stok, bukan menimpa angka', () => {
    const local = mutation({ entity: 'stock_mutation', delta: -3 })
    const resolution = resolveConflict('stock_mutation', local, {
      updatedAt: '2026-10-20T11:00:00.000Z',
      deviceId: 'dev_b',
    })

    expect(resolution).toEqual({ outcome: 'merge-delta', delta: -3 })
    expect(applyStockDelta(25, -3)).toBe(22)
  })

  it('pembaruan terbaru menang untuk data yang bisa diubah', () => {
    const local = mutation({ updatedAt: '2026-10-20T12:00:00.000Z' })
    const older = resolveConflict('barang', local, {
      updatedAt: '2026-10-20T11:00:00.000Z',
      deviceId: 'dev_b',
    })
    const newer = resolveConflict('barang', local, {
      updatedAt: '2026-10-20T13:00:00.000Z',
      deviceId: 'dev_b',
    })

    expect(older.outcome).toBe('apply-local')
    expect(newer.outcome).toBe('apply-remote')
  })

  it('waktu yang sama dari perangkat lain menghasilkan konflik untuk ditinjau', () => {
    const local = mutation()
    const resolution = resolveConflict('barang', local, {
      updatedAt: local.updatedAt,
      deviceId: 'dev_b',
    })

    expect(resolution.outcome).toBe('conflict')
  })

  it('menggabungkan payload hanya untuk field yang diizinkan', () => {
    const merged = mergePayloads(
      { nama_barang: 'Kopi Susu Baru', harga_barang: 19000 },
      { nama_barang: 'Kopi Susu', stok: 10 },
      ['nama_barang', 'harga_barang'],
    )

    expect(merged).toEqual({ nama_barang: 'Kopi Susu Baru', harga_barang: 19000, stok: 10 })
  })

  it('menyaring payload agar field di luar daftar tidak ikut tersinkron', () => {
    const filtered = pickFields({ nama_barang: 'Kopi', harga_modal: 12000, internal: 'x' }, ['nama_barang', 'harga_modal'])

    expect(filtered).toEqual({ nama_barang: 'Kopi', harga_modal: 12000 })
  })
})

describe('antrean mutasi', () => {
  it('membuat mutasi dengan aturan sesuai jenis datanya', () => {
    const sale = createMutation({ entity: 'penjualan', entityId: 'FJ-1', payload: {}, deviceId: 'dev_a' })
    const stock = createMutation({ entity: 'stock_mutation', entityId: 'FJ-1:BRG-1', payload: {}, delta: -2, deviceId: 'dev_a' })

    expect(sale.operation).toBe('upsert')
    expect(stock.operation).toBe('delta')
    expect(stock.delta).toBe(-2)
  })

  it('menyimpan, menandai terkirim, dan menghitung antrean', () => {
    const queue = new MemorySyncQueue()
    const item = createMutation({ entity: 'penjualan', entityId: 'FJ-1', payload: {}, deviceId: 'dev_a' })

    queue.enqueue(item)
    expect(queue.countPending()).toBe(1)

    queue.markSynced(item.id)
    expect(queue.countPending()).toBe(0)
  })

  it('memisahkan konflik dari antrean yang akan dikirim', () => {
    const queue = new MemorySyncQueue()
    const item = createMutation({ entity: 'barang', entityId: 'BRG-1', payload: {}, deviceId: 'dev_a' })

    queue.enqueue(item)
    queue.markConflict(item.id, 'waktu sama')

    expect(queue.countPending()).toBe(0)
    expect(queue.listConflicts()).toHaveLength(1)
  })

  it('bisa disimpan dan dibaca ulang dari json', () => {
    const queue = new MemorySyncQueue()
    const item = createMutation({ entity: 'penjualan', entityId: 'FJ-1', payload: { a: 1 }, deviceId: 'dev_a' })
    queue.enqueue(item)

    const restored = MemorySyncQueue.fromJSON(JSON.parse(JSON.stringify(queue.toJSON())))

    expect(restored.countPending()).toBe(1)
    expect(restored.listPending()[0].entityId).toBe('FJ-1')
  })
})

describe('klasifikasi mutasi dari perangkat lain', () => {
  it('mengirim mutasi yang belum punya pasangan', () => {
    const pending = [mutation()]
    const result = classifyRemoteMutations([], pending)

    expect(result.send).toHaveLength(1)
    expect(result.drop).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('membatalkan mutasi lokal yang kalah oleh perubahan lebih baru', () => {
    const pending = [mutation({ updatedAt: '2026-10-20T10:00:00.000Z' })]
    const remote = [{
      id: 'mut_remote',
      device_id: 'dev_b',
      entity: 'barang' as const,
      entity_id: 'BRG-001',
      operation: 'upsert',
      payload: {},
      delta: null,
      updated_at: '2026-10-20T11:00:00.000Z',
    }]

    const result = classifyRemoteMutations(remote, pending)

    expect(result.drop).toHaveLength(1)
    expect(result.send).toHaveLength(0)
  })

  it('mencatat konflik ketika waktunya sama', () => {
    const pending = [mutation({ updatedAt: '2026-10-20T10:00:00.000Z' })]
    const remote = [{
      id: 'mut_remote',
      device_id: 'dev_b',
      entity: 'barang' as const,
      entity_id: 'BRG-001',
      operation: 'upsert',
      payload: {},
      delta: null,
      updated_at: '2026-10-20T10:00:00.000Z',
    }]

    const result = classifyRemoteMutations(remote, pending)

    expect(result.conflicts).toHaveLength(1)
    expect(result.send).toHaveLength(0)
  })

  it('tetap mengirim transaksi append-only walau ada perubahan dari perangkat lain', () => {
    const pending = [mutation({ entity: 'penjualan', entityId: 'FJ-1', updatedAt: '2026-10-20T10:00:00.000Z' })]
    const remote = [{
      id: 'mut_remote',
      device_id: 'dev_b',
      entity: 'penjualan' as const,
      entity_id: 'FJ-1',
      operation: 'upsert',
      payload: {},
      delta: null,
      updated_at: '2026-10-20T11:00:00.000Z',
    }]

    const result = classifyRemoteMutations(remote, pending)

    expect(result.send).toHaveLength(1)
  })
})
