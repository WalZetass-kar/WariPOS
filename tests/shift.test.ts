import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createTestDatabase, seedStore, type SeededStore } from './helpers/testDb'

const harness = createTestDatabase()

vi.mock('../src/database/connection.js', () => ({
  sqlite: harness.sqlite,
  db: harness.db,
  reopenDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}))

const { ShiftController } = await import('../src/backend/controllers/ShiftController')
const { demoSession } = await import('../src/backend/services/demoSessionManager')

let store: SeededStore

beforeAll(() => {
  store = seedStore(harness.sqlite)
})

afterAll(() => {
  harness.sqlite.close()
})

beforeEach(() => {
  demoSession.setSession(store.username, 'kasir')
  harness.sqlite.prepare(`DELETE FROM mediasoft_shifts`).run()
  harness.sqlite.prepare(`DELETE FROM mediasoft_kas_drawer`).run()
})

describe('ShiftController', () => {
  it('refuses to open a shift without a user', () => {
    const result = ShiftController.open({ user_id: '', opening_balance: 0 })

    expect(result.success).toBe(false)
  })

  it('opens a shift with the opening balance and opens the cash drawer', () => {
    const result = ShiftController.open({ user_id: store.username, opening_balance: 100000 })

    expect(result.success).toBe(true)
    const data = result.data as any
    expect(data.shift_number).toMatch(/^SHIFT/)

    const shift = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_shifts WHERE id = ?`)
      .get(data.id) as any
    expect(shift.opening_balance).toBe(100000)
    expect(shift.status).toBe('OPEN')

    const drawer = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_kas_drawer WHERE username = ?`)
      .get(store.username) as any
    expect(drawer.status).toBe('OPEN')
    expect(drawer.modal_awal).toBe(100000)
  })

  it('refuses a second active shift for the same user', () => {
    ShiftController.open({ user_id: store.username, opening_balance: 100000 })
    const second = ShiftController.open({ user_id: store.username, opening_balance: 100000 })

    expect(second.success).toBe(false)
    expect(second.message).toMatch(/shift aktif/i)
  })

  it('closes a balanced shift', () => {
    const opened = ShiftController.open({ user_id: store.username, opening_balance: 100000 })
    const shiftId = (opened.data as any).id

    const closed = ShiftController.close(shiftId, { closing_balance: 100000 })

    expect(closed.success).toBe(true)
    const shift = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_shifts WHERE id = ?`)
      .get(shiftId) as any
    expect(shift.status).toBe('CLOSED')
    expect(shift.difference).toBe(0)
  })

  it('records a surplus and a deficit', () => {
    const surplusShift = ShiftController.open({ user_id: store.username, opening_balance: 100000 })
    ShiftController.close((surplusShift.data as any).id, { closing_balance: 120000 })
    const surplus = harness.sqlite
      .prepare(`SELECT difference FROM mediasoft_shifts WHERE id = ?`)
      .get((surplusShift.data as any).id) as any
    expect(surplus.difference).toBe(20000)

    const deficitShift = ShiftController.open({ user_id: store.username, opening_balance: 100000 })
    ShiftController.close((deficitShift.data as any).id, { closing_balance: 90000 })
    const deficit = harness.sqlite
      .prepare(`SELECT difference FROM mediasoft_shifts WHERE id = ?`)
      .get((deficitShift.data as any).id) as any
    expect(deficit.difference).toBe(-10000)
  })

  it('finds the active shift of the cashier', () => {
    ShiftController.open({ user_id: store.username, opening_balance: 100000 })

    const current = ShiftController.getCurrent(store.username)

    expect(current.success).toBe(true)
    expect((current.data as any).status).toBe('OPEN')
  })
})
