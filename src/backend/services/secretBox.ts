import crypto from 'crypto'
import os from 'os'
import { createRequire } from 'module'

/**
 * Encryption at rest for the license server credentials kept in SQLite.
 *
 * The values are bearer tokens, so a hash is not an option, they have to be
 * recoverable. The Electron keychain is used when it is available, otherwise
 * the value is encrypted with a key derived from the machine.
 */

const SAFE_STORAGE_PREFIX = 'ss:'
const AES_PREFIX = 'v1:'

interface ElectronSafeStorage {
  isEncryptionAvailable: () => boolean
  encryptString: (value: string) => Buffer
  decryptString: (buffer: Buffer) => string
}

let safeStorageCache: ElectronSafeStorage | null | undefined

function getSafeStorage(): ElectronSafeStorage | null {
  if (safeStorageCache !== undefined) return safeStorageCache
  try {
    const require = createRequire(import.meta.url)
    const { safeStorage } = require('electron')
    safeStorageCache = (safeStorage as ElectronSafeStorage | undefined) ?? null
  } catch {
    safeStorageCache = null
  }
  return safeStorageCache
}

function localKey(): Buffer {
  const configured = process.env.ZETASS_POS_LOCAL_SECRET
  const material = configured && configured.length >= 16
    ? configured
    : `${os.hostname()}:${os.userInfo().username}:${os.platform()}:${os.homedir()}`
  return crypto.scryptSync(material, 'zetass-pos-license-secret', 32)
}

/** Encrypt a value, values that are already encrypted are returned unchanged. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain
  if (plain.startsWith(SAFE_STORAGE_PREFIX) || plain.startsWith(AES_PREFIX)) return plain

  const safeStorage = getSafeStorage()
  if (safeStorage?.isEncryptionAvailable()) {
    return `${SAFE_STORAGE_PREFIX}${safeStorage.encryptString(plain).toString('base64')}`
  }

  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = crypto.scryptSync(localKey(), salt, 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${AES_PREFIX}${Buffer.concat([salt, iv, tag, encrypted]).toString('base64')}`
}

/** Decrypt a value, plain values are returned unchanged. */
export function decryptSecret(stored: string): string {
  if (!stored) return stored

  if (stored.startsWith(SAFE_STORAGE_PREFIX)) {
    const safeStorage = getSafeStorage()
    if (!safeStorage?.isEncryptionAvailable()) return ''
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(SAFE_STORAGE_PREFIX.length), 'base64'))
    } catch {
      return ''
    }
  }

  if (stored.startsWith(AES_PREFIX)) {
    try {
      const raw = Buffer.from(stored.slice(AES_PREFIX.length), 'base64')
      const salt = raw.subarray(0, 16)
      const iv = raw.subarray(16, 28)
      const tag = raw.subarray(28, 44)
      const encrypted = raw.subarray(44)
      const key = crypto.scryptSync(localKey(), salt, 32)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    } catch {
      return ''
    }
  }

  return stored
}

/** True when the value is stored in plain text. */
export function isPlainSecret(stored: string): boolean {
  return !!stored && !stored.startsWith(SAFE_STORAGE_PREFIX) && !stored.startsWith(AES_PREFIX)
}
