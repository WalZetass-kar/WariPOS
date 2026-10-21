import {
  type SyncEntity,
  type SyncMutation,
  type SyncOperation,
  conflictStrategyFor,
} from './conflict'

/**
 * Antrean mutasi lokal.
 *
 * Antrean ini menyimpan setiap perubahan yang belum tersinkron, lengkap
 * dengan aturan konfliknya, sehingga perangkat yang sempat offline bisa
 * mengirim perubahan itu apa adanya saat jaringan kembali.
 */
export interface SyncQueueStore {
  enqueue(mutation: SyncMutation): void
  listPending(limit?: number): SyncMutation[]
  listConflicts(limit?: number): SyncMutation[]
  markSynced(id: string): void
  markFailed(id: string, error: string): void
  markConflict(id: string, reason: string): void
  countPending(): number
  clear(): void
}

export interface CreateMutationInput {
  entity: SyncEntity
  entityId: string
  operation?: SyncOperation
  payload: Record<string, unknown>
  delta?: number
  deviceId: string
  updatedAt?: string
  id?: string
}

/** Buat mutasi dengan nilai bawaan yang konsisten. */
export function createMutation(input: CreateMutationInput): SyncMutation {
  const strategy = conflictStrategyFor(input.entity)
  const operation: SyncOperation = input.operation
    ?? (strategy === 'append-only' ? 'upsert' : strategy === 'delta' ? 'delta' : 'upsert')

  return {
    id: input.id ?? createMutationId(),
    entity: input.entity,
    entityId: input.entityId,
    operation,
    payload: input.payload,
    delta: input.delta,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    deviceId: input.deviceId,
    attempts: 0,
  }
}

export function createMutationId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `mut_${Date.now().toString(36)}_${random}`
}

/** Antrean yang menyimpan mutasi di memori, dipakai di renderer. */
export class MemorySyncQueue implements SyncQueueStore {
  private mutations: SyncMutation[] = []
  private conflicts = new Map<string, string>()

  enqueue(mutation: SyncMutation): void {
    const existing = this.mutations.findIndex(item => item.id === mutation.id)
    if (existing >= 0) {
      this.mutations[existing] = mutation
      return
    }
    this.mutations.push(mutation)
  }

  listPending(limit = 100): SyncMutation[] {
    return this.mutations.filter(item => !this.conflicts.has(item.id)).slice(0, limit)
  }

  listConflicts(limit = 50): SyncMutation[] {
    return this.mutations.filter(item => this.conflicts.has(item.id)).slice(0, limit)
  }

  markSynced(id: string): void {
    this.mutations = this.mutations.filter(item => item.id !== id)
    this.conflicts.delete(id)
  }

  markFailed(id: string): void {
    this.mutations = this.mutations.map(item => (item.id === id ? { ...item, attempts: item.attempts + 1 } : item))
  }

  markConflict(id: string, reason: string): void {
    this.conflicts.set(id, reason)
  }

  countPending(): number {
    return this.mutations.filter(item => !this.conflicts.has(item.id)).length
  }

  clear(): void {
    this.mutations = []
    this.conflicts.clear()
  }

  /** Serialisasi supaya bisa disimpan di penyimpanan terenkripsi. */
  toJSON(): { mutations: SyncMutation[]; conflicts: Record<string, string> } {
    return { mutations: this.mutations, conflicts: Object.fromEntries(this.conflicts) }
  }

  static fromJSON(
    data: { mutations?: SyncMutation[]; conflicts?: Record<string, string> } | null,
  ): MemorySyncQueue {
    const queue = new MemorySyncQueue()
    queue.mutations = Array.isArray(data?.mutations) ? data.mutations : []
    queue.conflicts = new Map(Object.entries(data?.conflicts ?? {}))
    return queue
  }
}
