import * as CryptoJS from 'crypto-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const PREFIX = 'aes256:v1:'
const NATIVE_PREFIX = 'zetass.secure.'

function storageSecret() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'node'
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
  return CryptoJS.SHA256(`zetass-pos:${origin}:${agent}`)
}

function encodePayload(value: string) {
  const key = storageSecret()
  const iv = CryptoJS.lib.WordArray.random(16)
  const encrypted = CryptoJS.AES.encrypt(value, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  const ivText = CryptoJS.enc.Base64.stringify(iv)
  const cipherText = CryptoJS.enc.Base64.stringify(encrypted.ciphertext)
  const mac = CryptoJS.HmacSHA256(`${ivText}.${cipherText}`, key).toString(CryptoJS.enc.Hex)
  return PREFIX + btoa(JSON.stringify({ iv: ivText, ct: cipherText, mac }))
}

function decodePayload(value: string) {
  if (!value.startsWith(PREFIX)) return value

  const key = storageSecret()
  const payload = JSON.parse(atob(value.slice(PREFIX.length))) as { iv: string; ct: string; mac: string }
  const expectedMac = CryptoJS.HmacSHA256(`${payload.iv}.${payload.ct}`, key).toString(CryptoJS.enc.Hex)
  if (payload.mac !== expectedMac) {
    throw new Error('Encrypted local storage integrity check failed')
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(payload.ct) } as CryptoJS.lib.CipherParams,
    key,
    {
      iv: CryptoJS.enc.Base64.parse(payload.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  )
  return decrypted.toString(CryptoJS.enc.Utf8)
}

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getElectronStorage() {
  if (typeof window === 'undefined') return null
  return window.secureStorage ?? null
}

function nativePreferenceKey(key: string) {
  return `${NATIVE_PREFIX}${key}`
}

function mirrorToNativePreferences(key: string, encryptedValue: string) {
  if (!Capacitor.isNativePlatform()) return
  void Preferences.set({ key: nativePreferenceKey(key), value: encryptedValue }).catch(() => {})
}

function removeFromNativePreferences(key: string) {
  if (!Capacitor.isNativePlatform()) return
  void Preferences.remove({ key: nativePreferenceKey(key) }).catch(() => {})
}

export const secureStorage = {
  async ready(keys: string[] = []): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    const storage = getStorage()
    if (!storage) return

    await Promise.all(keys.map(async key => {
      try {
        const result = await Preferences.get({ key: nativePreferenceKey(key) })
        if (result.value && !storage.getItem(key)) {
          storage.setItem(key, result.value)
        }
      } catch {
        // Preferences are a best-effort encrypted mirror on Android.
      }
    }))
  },

  getItem(key: string): string | null {
    const electronStorage = getElectronStorage()
    if (electronStorage) {
      const stored = electronStorage.getItem(key)
      if (stored) return stored

      const legacyStorage = getStorage()
      const legacyRaw = legacyStorage?.getItem(key)
      if (!legacyRaw) return null
      const legacyValue = decodePayload(legacyRaw)
      electronStorage.setItem(key, legacyValue)
      legacyStorage?.removeItem(key)
      return legacyValue
    }

    const storage = getStorage()
    if (!storage) return null
    const raw = storage.getItem(key)
    if (!raw) return null
    return decodePayload(raw)
  },

  setItem(key: string, value: string) {
    const electronStorage = getElectronStorage()
    if (electronStorage) {
      electronStorage.setItem(key, value)
      return
    }

    const storage = getStorage()
    if (!storage) return
    const encryptedValue = encodePayload(value)
    try {
      storage.setItem(key, encryptedValue)
    } catch (err: any) {
      console.warn(`[secureStorage] QuotaExceededError when setting key "${key}". Cleaning non-essential storage...`, err)
      try {
        // Remove only non-critical bulky keys
        const safeToRemove = ['customer_display_data', 'zetass_ai_sessions_v1', 'temp_receipt_preview', 'cache_products']
        for (const k of safeToRemove) {
          storage.removeItem(k)
        }
        for (let i = 0; i < storage.length; i++) {
          const storageKey = storage.key(i)
          if (storageKey && (storageKey.startsWith('cache_') || storageKey.startsWith('temp_'))) {
            storage.removeItem(storageKey)
          }
        }
        storage.setItem(key, encryptedValue)
      } catch {
        // Fallback gracefully without throwing uncaught exception
      }
    }
    mirrorToNativePreferences(key, encryptedValue)
  },

  removeItem(key: string) {
    const electronStorage = getElectronStorage()
    if (electronStorage) {
      electronStorage.removeItem(key)
      return
    }

    getStorage()?.removeItem(key)
    removeFromNativePreferences(key)
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key)
      return raw ? JSON.parse(raw) as T : fallback
    } catch {
      this.removeItem(key)
      return fallback
    }
  },

  setJSON(key: string, value: unknown) {
    this.setItem(key, JSON.stringify(value))
  },
}
