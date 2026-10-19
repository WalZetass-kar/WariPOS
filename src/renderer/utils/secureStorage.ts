import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const PREFIX = 'aes256:v2:'
const NATIVE_PREFIX = 'zetass.secure.'

// Generate secret key from origin using Web Crypto API
async function getStorageKey(): Promise<CryptoKey> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'node'
  const encoder = new TextEncoder()
  const data = encoder.encode(`zetass-pos-v2:${origin}`)
  
  // Hash the origin to get consistent key material
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Import as CryptoKey for AES-GCM
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encodePayload(value: string): Promise<string> {
  try {
    const key = await getStorageKey()
    const encoder = new TextEncoder()
    const data = encoder.encode(value)
    
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)
    
    // Base64 encode
    const base64 = btoa(String.fromCharCode(...combined))
    return PREFIX + base64
  } catch (err) {
    console.error('[secureStorage] Encryption failed:', err)
    // Fallback: return plain value with prefix
    return PREFIX + btoa(value)
  }
}

async function decodePayload(value: string): Promise<string | null> {
  // Handle legacy v1 format (crypto-js)
  if (value.startsWith('aes256:v1:')) {
    console.warn('[secureStorage] Legacy v1 format detected, returning null to trigger re-encryption')
    return null
  }
  
  // Plain value without encryption
  if (!value.startsWith(PREFIX)) {
    return value
  }

  try {
    const key = await getStorageKey()
    const base64 = value.slice(PREFIX.length)
    
    // Decode base64
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    
    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (err) {
    console.warn('[secureStorage] Decryption failed:', err)
    return null
  }
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
      try {
        const stored = electronStorage.getItem(key)
        if (stored) return stored
      } catch {}

      const legacyStorage = getStorage()
      const legacyRaw = legacyStorage?.getItem(key)
      if (!legacyRaw) return null
      
      // Can't decrypt synchronously with Web Crypto, return raw for now
      // Will be migrated on next setItem
      if (legacyRaw.startsWith('aes256:v1:')) {
        console.warn('[secureStorage] Legacy encrypted data detected, will be migrated on next write')
        return null
      }
      
      return legacyRaw.startsWith(PREFIX) ? null : legacyRaw
    }

    const storage = getStorage()
    if (!storage) return null
    try {
      const raw = storage.getItem(key)
      if (!raw) return null
      
      // Can't decrypt synchronously, return null and trigger re-fetch
      if (raw.startsWith('aes256:')) {
        // Schedule async decryption
        void this.getItemAsync(key).then(value => {
          if (value) {
            // Store decrypted in memory cache if needed
            window.dispatchEvent(new CustomEvent('secureStorage:decrypted', { detail: { key, value } }))
          }
        })
        return null
      }
      
      return raw
    } catch {
      try {
        storage.removeItem(key)
        removeFromNativePreferences(key)
      } catch {}
      return null
    }
  },

  async getItemAsync(key: string): Promise<string | null> {
    const electronStorage = getElectronStorage()
    if (electronStorage) {
      return electronStorage.getItem(key)
    }

    const storage = getStorage()
    if (!storage) return null
    try {
      const raw = storage.getItem(key)
      if (!raw) return null
      const decoded = await decodePayload(raw)
      if (decoded === null && raw.startsWith('aes256:')) {
        storage.removeItem(key)
        removeFromNativePreferences(key)
      }
      return decoded
    } catch {
      try {
        storage.removeItem(key)
        removeFromNativePreferences(key)
      } catch {}
      return null
    }
  },

  setItem(key: string, value: string) {
    const electronStorage = getElectronStorage()
    if (electronStorage) {
      electronStorage.setItem(key, value)
      return
    }

    // Store plain for now, encrypt async in background
    const storage = getStorage()
    if (!storage) return
    
    try {
      storage.setItem(key, value)
      mirrorToNativePreferences(key, value)
      
      // Encrypt in background
      void encodePayload(value).then(encrypted => {
        try {
          storage.setItem(key, encrypted)
          mirrorToNativePreferences(key, encrypted)
        } catch {}
      })
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
        storage.setItem(key, value)
      } catch {
        // Fallback gracefully without throwing uncaught exception
      }
    }
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
