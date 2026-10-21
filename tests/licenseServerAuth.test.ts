import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-auth-'))
process.env.DB_PATH = path.join(tempDir, 'license.db')
process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64)
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)
delete process.env.ADMIN_PASSWORD

// The routers use the express copy that lives in license-server, the test app
// has to use the same instance.
const requireLicenseServer = createRequire(path.join(process.cwd(), 'license-server', 'index.js'))
const express = requireLicenseServer('express')

const { db } = await import('../license-server/src/db')
const { migrate } = await import('../license-server/src/migrations')
const { hashPassword } = await import('../license-server/src/auth')
const authRoutes = (await import('../license-server/src/routes/authRoutes')).default
const adminRoutes = (await import('../license-server/src/routes/adminRoutes')).default

let server: any
let baseUrl = ''

const ADMIN_EMAIL = 'admin@uji.local'
const ADMIN_PASSWORD = 'Kredensial-Awal-2026'

beforeAll(async () => {
  migrate()

  const hash = await hashPassword(ADMIN_PASSWORD)
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role, status, must_change_pwd)
     VALUES ('Super Admin', ?, ?, 'super_admin', 'active', 1)`,
  ).run(ADMIN_EMAIL, hash)

  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  baseUrl = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  db.close()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function login(password: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password,
      device_id: 'uji-perangkat-01',
      device_name: 'Uji',
      platform: 'test',
    }),
  })
  return { status: res.status, body: await res.json() as any }
}

describe('license server password policy', () => {
  it('reports that the initial password must be replaced', async () => {
    const { status, body } = await login(ADMIN_PASSWORD)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.user.must_change_pwd).toBe(true)
  })

  it('blocks every other endpoint while the password is still the initial one', async () => {
    const { body } = await login(ADMIN_PASSWORD)
    const token = body.data.access_token

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await res.json() as any

    expect(res.status).toBe(403)
    expect(payload.error_code).toBe('PASSWORD_CHANGE_REQUIRED')
  })

  it('lets the account through after the password was replaced', async () => {
    const { body } = await login(ADMIN_PASSWORD)
    const token = body.data.access_token

    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ old_password: ADMIN_PASSWORD, new_password: 'Kredensial-Baru-2026' }),
    })
    expect(changeRes.status).toBe(200)

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('refuses a wrong password', async () => {
    const { status, body } = await login('Kredensial-Salah-2026')

    expect(status).toBe(401)
    expect(body.success).toBe(false)
  })
})
