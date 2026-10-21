import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  process.env = { ...ORIGINAL_ENV }
}

async function loadConfig() {
  vi.resetModules()
  return (await import('../license-server/src/config')).config
}

describe('license server configuration', () => {
  let tempDir: string

  beforeEach(() => {
    resetEnv()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-config-'))
    process.env.DB_PATH = path.join(tempDir, 'license.db')
    delete process.env.JWT_ACCESS_SECRET
    delete process.env.JWT_REFRESH_SECRET
    delete process.env.ADMIN_PASSWORD
  })

  afterEach(() => {
    resetEnv()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('never falls back to the known development secrets', async () => {
    const config = await loadConfig()

    expect(config.JWT_ACCESS_SECRET).not.toBe('dev-access-secret')
    expect(config.JWT_REFRESH_SECRET).not.toBe('dev-refresh-secret')
    expect(config.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(64)
    expect(config.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(64)
    expect(config.JWT_ACCESS_SECRET).not.toBe(config.JWT_REFRESH_SECRET)
  })

  it('stores the generated secret next to the database with owner only permissions', async () => {
    const config = await loadConfig()

    expect(fs.existsSync(config.SECRETS_FILE)).toBe(true)
    const mode = fs.statSync(config.SECRETS_FILE).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('keeps the generated secret stable across restarts', async () => {
    const first = await loadConfig()
    const second = await loadConfig()

    expect(second.JWT_ACCESS_SECRET).toBe(first.JWT_ACCESS_SECRET)
    expect(second.JWT_REFRESH_SECRET).toBe(first.JWT_REFRESH_SECRET)
  })

  it('generates an initial admin password instead of using the default one', async () => {
    const config = await loadConfig()

    expect(config.ADMIN_PASSWORD).not.toBe('Admin#12345')
    expect(config.ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16)
    expect(config.ADMIN_PASSWORD_GENERATED).toBe(true)
  })

  it('accepts a strong password from the environment', async () => {
    process.env.ADMIN_PASSWORD = 'Kredensial-Yang-Panjang-2026'
    const config = await loadConfig()

    expect(config.ADMIN_PASSWORD).toBe('Kredensial-Yang-Panjang-2026')
    expect(config.ADMIN_PASSWORD_GENERATED).toBe(false)
  })

  it('refuses a weak secret in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_ACCESS_SECRET = 'dev-access-secret'

    await expect(loadConfig()).rejects.toThrow(/lemah/)
  })

  it('refuses a weak admin password in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_PASSWORD = 'Admin#12345'

    await expect(loadConfig()).rejects.toThrow(/lemah/)
  })
})
