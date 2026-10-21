import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { secureStorage } from '../src/renderer/utils/secureStorage'

/**
 * The session blob is encrypted with Web Crypto, which is asynchronous, so the
 * synchronous getItem() cannot decrypt it. Without a memory cache every
 * synchronous read returned null, which made the stored session look like it
 * had disappeared and logged the cashier out mid shift on Android.
 */
describe('secureStorage', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
    }
  })

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns the value written with setItem on a synchronous read', () => {
    secureStorage.setItem('pos_session', '{"nama_pengguna":"kasir"}')
    expect(secureStorage.getItem('pos_session')).toBe('{"nama_pengguna":"kasir"}')
  })

  it('keeps the value readable after the background encryption finished', async () => {
    secureStorage.setItem('pos_session', '{"nama_pengguna":"kasir"}')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(secureStorage.getItem('pos_session')).toBe('{"nama_pengguna":"kasir"}')
  })

  it('decrypts an encrypted value on the async read', async () => {
    secureStorage.setItem('pos_session', '{"nama_pengguna":"kasir"}')
    await new Promise(resolve => setTimeout(resolve, 50))

    const raw = window.localStorage.getItem('pos_session')
    expect(raw).toBeTruthy()
    expect(raw?.startsWith('aes256:')).toBe(true)

    await expect(secureStorage.getItemAsync('pos_session')).resolves.toBe('{"nama_pengguna":"kasir"}')
  })

  it('does not destroy the stored value when it cannot be decrypted', async () => {
    window.localStorage.setItem('unreadable_key', 'aes256:v2:not-a-valid-payload')
    await expect(secureStorage.getItemAsync('unreadable_key')).resolves.toBeNull()
    expect(window.localStorage.getItem('unreadable_key')).toBe('aes256:v2:not-a-valid-payload')
  })

  it('clears the cached value on removeItem', () => {
    secureStorage.setItem('pos_session', '{"nama_pengguna":"kasir"}')
    secureStorage.removeItem('pos_session')
    expect(secureStorage.getItem('pos_session')).toBeNull()
  })

  it('round trips a JSON value', () => {
    secureStorage.setJSON('rememberMe', { username: 'kasir' })
    expect(secureStorage.getJSON('rememberMe', null)).toEqual({ username: 'kasir' })
  })
})
