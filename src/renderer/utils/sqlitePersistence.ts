import { Capacitor } from '@capacitor/core'
import { secureStorage } from './secureStorage'

const DB_NAME = 'zetass_pos_secure_store'
const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`

let dbPromise: Promise<any | null> | null = null
const pendingWrites = new Map<string, string>()
let flushTimeout: any = null

async function openDb() {
  if (!Capacitor.isNativePlatform()) return null

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const sqliteModule = await import('@capacitor-community/sqlite')
        const sqlite = new sqliteModule.SQLiteConnection(sqliteModule.CapacitorSQLite)
        let db: any
        try {
          db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
        } catch {
          db = await sqlite.retrieveConnection(DB_NAME, false)
        }
        await db.open()
        await db.execute(TABLE_SQL)
        return db
      } catch (error) {
        console.warn('SQLite persistence unavailable, falling back to encrypted storage:', error)
        return null
      }
    })()
  }

  return dbPromise
}

export async function getPersistentItem(key: string): Promise<string | null> {
  // 1. Try Native SQLite first on native devices (highest capacity and reliability)
  if (Capacitor.isNativePlatform()) {
    try {
      const db = await openDb()
      if (db) {
        const result = await db.query('SELECT value FROM app_kv WHERE key = ? LIMIT 1', [key])
        const row = result.values?.[0]
        if (row?.value) return row.value
      }
    } catch (e) {
      console.warn('[SQLite] Read error, falling back to secureStorage:', e)
    }
  }

  // 2. Fallback to encrypted web storage
  return secureStorage.getItem(key)
}

/**
 * Flush debounced writes to SQLite and localStorage
 */
async function flushPendingWrites() {
  const entries = Array.from(pendingWrites.entries())
  pendingWrites.clear()
  if (entries.length === 0) return

  // 1. Save to secureStorage (with quota guard)
  for (const [key, value] of entries) {
    try {
      secureStorage.setItem(key, value)
    } catch (err) {
      // localStorage quota exceeded is common on mobile, continue to SQLite
      console.warn(`[Storage] SecureStorage quota exceeded for ${key}, relying on SQLite:`, err)
    }
  }

  // 2. Persist to Native SQLite
  if (Capacitor.isNativePlatform()) {
    try {
      const db = await openDb()
      if (db) {
        const now = new Date().toISOString()
        for (const [key, value] of entries) {
          await db.run(
            'INSERT OR REPLACE INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)',
            [key, value, now]
          )
        }
      }
    } catch (err) {
      console.error('[SQLite] Batch save error:', err)
    }
  }
}

export async function setPersistentItem(key: string, value: string, immediate = false): Promise<void> {
  pendingWrites.set(key, value)

  if (immediate) {
    if (flushTimeout) clearTimeout(flushTimeout)
    await flushPendingWrites()
    return
  }

  // Debounce writes (100ms) to prevent freezing UI thread during burst operations
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushTimeout = null
      void flushPendingWrites()
    }, 100)
  }
}

export async function removePersistentItem(key: string): Promise<void> {
  pendingWrites.delete(key)
  try {
    secureStorage.removeItem(key)
  } catch {}

  const db = await openDb()
  if (!db) return
  try {
    await db.run('DELETE FROM app_kv WHERE key = ?', [key])
  } catch {}
}

export async function estimateStorageUsage() {
  const estimate = typeof navigator !== 'undefined' && 'storage' in navigator
    ? await navigator.storage.estimate()
    : {}

  const usage = estimate.usage ?? 0
  const quota = estimate.quota ?? 0
  return {
    usage,
    quota,
    percent: quota ? Math.round((usage / quota) * 100) : 0,
  }
}
