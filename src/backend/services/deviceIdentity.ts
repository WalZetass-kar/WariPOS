import crypto from 'crypto'
import { sqlite } from '../../database/connection.js'

/**
 * Identitas perangkat untuk sinkronisasi.
 *
 * Nilai ini harus sama antar aplikasi dan perangkat, jadi disimpan di dalam
 * database lokal, bukan dibuat ulang tiap kali aplikasi dibuka.
 */
export function getLocalDeviceId(): string {
  try {
    const row = sqlite.prepare(`SELECT device_id FROM mediasoft_identitas LIMIT 1`).get() as
      | { device_id?: string | null }
      | undefined

    if (row?.device_id) return row.device_id

    const generated = `dev_${crypto.randomUUID()}`
    const existing = sqlite.prepare(`SELECT kode FROM mediasoft_identitas LIMIT 1`).get() as
      | { kode?: number }
      | undefined

    if (existing?.kode) {
      sqlite.prepare(`UPDATE mediasoft_identitas SET device_id = ? WHERE kode = ?`).run(generated, existing.kode)
    } else {
      sqlite.prepare(
        `INSERT INTO mediasoft_identitas (kode, device_id) VALUES (1, ?)
         ON CONFLICT(kode) DO UPDATE SET device_id = excluded.device_id`,
      ).run(generated)
    }

    return generated
  } catch {
    return `dev_${crypto.randomUUID()}`
  }
}
