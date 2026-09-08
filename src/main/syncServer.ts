import { app } from 'electron'
import crypto from 'crypto'
import http, { type IncomingMessage, type ServerResponse } from 'http'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { canInvokeRemoteSyncChannel } from '../backend/middleware/demoGuardV2.js'

interface SyncServerConfig {
  enabled: boolean
  port: number
  token: string
}

interface SyncServerStatus {
  enabled: boolean
  running: boolean
  port: number
  token: string
  urls: string[]
  devices: SyncConnectedDevice[]
  error: string | null
  requestCount: number
  lastRequestAt: string | null
  lastChannel: string | null
}

interface SyncConnectedDevice {
  deviceId: string
  deviceName: string
  userAgent: string
  address: string
  firstSeenAt: string
  lastSeenAt: string
  lastChannel: string
  requestCount: number
}

const DEFAULT_PORT = 38573
const MAX_BODY_BYTES = 5 * 1024 * 1024

let invokeChannel: (channel: string, args: unknown[]) => Promise<unknown> = async (channel) => ({
  success: false,
  message: `Dispatcher sinkronisasi belum siap: ${channel}`,
})

export function setSyncChannelInvoker(invoker: (channel: string, args: unknown[]) => Promise<unknown>) {
  invokeChannel = invoker
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex')
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'sync-server.json')
}

function configKey() {
  return crypto.scryptSync(`${app.getPath('userData')}:${app.getName()}`, 'zetass-pos-sync-config', 32)
}

function encryptConfig(config: SyncServerConfig) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', configKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(config), 'utf8'),
    cipher.final(),
  ])
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  })
}

function decryptConfig(raw: string): Partial<SyncServerConfig> {
  const parsed = JSON.parse(raw)
  if (parsed?.alg !== 'aes-256-gcm') return parsed

  const decipher = crypto.createDecipheriv('aes-256-gcm', configKey(), Buffer.from(parsed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(plain)
}

function defaultConfig(): SyncServerConfig {
  return {
    enabled: false,
    port: DEFAULT_PORT,
    token: randomToken(),
  }
}

function normalizeConfig(value: Partial<SyncServerConfig> | null): SyncServerConfig {
  const base = defaultConfig()
  const port = Number(value?.port)
  return {
    enabled: value?.enabled ?? base.enabled,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : base.port,
    token: typeof value?.token === 'string' && value.token.length >= 16 ? value.token : base.token,
  }
}

function localUrls(port: number) {
  const urls = [`http://127.0.0.1:${port}`]
  const interfaces = os.networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`)
      }
    }
  }

  return [...new Set(urls)]
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('Payload terlalu besar'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Payload JSON tidak valid'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(data))
}

class SyncServer {
  private config: SyncServerConfig | null = null
  private server: http.Server | null = null
  private lastError: string | null = null
  private requestCount = 0
  private lastRequestAt: string | null = null
  private lastChannel: string | null = null
  private devices = new Map<string, SyncConnectedDevice>()

  init() {
    this.config = this.loadConfig()
    if (this.config.enabled) {
      void this.start()
    }
  }

  getStatus(): SyncServerStatus {
    const config = this.ensureConfig()
    return {
      enabled: config.enabled,
      running: Boolean(this.server?.listening),
      port: config.port,
      token: config.token,
      urls: localUrls(config.port),
      devices: [...this.devices.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
      error: this.lastError,
      requestCount: this.requestCount,
      lastRequestAt: this.lastRequestAt,
      lastChannel: this.lastChannel,
    }
  }

  saveConfig(input: Partial<SyncServerConfig>) {
    const current = this.ensureConfig()
    const next = normalizeConfig({
      ...current,
      ...input,
      token: input.token || current.token,
    })

    this.config = next
    this.persistConfig(next)

    if (next.enabled) {
      void this.restart()
    } else {
      void this.stop()
    }

    return this.getStatus()
  }

  rotateToken() {
    return this.saveConfig({ token: randomToken() })
  }

  async start() {
    const config = this.ensureConfig()
    if (this.server?.listening) return

    this.lastError = null
    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolve) => {
      this.server!.once('error', error => {
        this.lastError = error instanceof Error ? error.message : String(error)
        console.error('[Sync Server Error]:', this.lastError)
        resolve()
      })
      this.server!.listen(config.port, '127.0.0.1', () => {
        console.log(`[Sync Server] Running at ${localUrls(config.port).join(', ')}`)
        resolve()
      })
    })
  }

  async restart() {
    await this.stop()
    await this.start()
  }

  async stop() {
    const server = this.server
    this.server = null
    if (!server?.listening) return

    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  }

  private ensureConfig() {
    if (!this.config) this.config = this.loadConfig()
    return this.config
  }

  private loadConfig() {
    const file = getConfigPath()
    try {
      if (!fs.existsSync(file)) {
        const config = defaultConfig()
        this.persistConfig(config)
        return config
      }
      const config = normalizeConfig(decryptConfig(fs.readFileSync(file, 'utf8')))
      this.persistConfig(config)
      return config
    } catch {
      const config = defaultConfig()
      this.persistConfig(config)
      return config
    }
  }

  private persistConfig(config: SyncServerConfig) {
    const file = getConfigPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, encryptConfig(config), { mode: 0o600 })
  }

  private trackDevice(req: IncomingMessage, rawDevice: unknown, channel: string) {
    const input = rawDevice && typeof rawDevice === 'object'
      ? rawDevice as Record<string, unknown>
      : {}
    const address = (req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '')
    const headerAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'].join(' ')
      : req.headers['user-agent']
    const userAgent = typeof input.userAgent === 'string' && input.userAgent.trim()
      ? input.userAgent.trim().slice(0, 220)
      : String(headerAgent || 'unknown').slice(0, 220)
    const deviceName = typeof input.deviceName === 'string' && input.deviceName.trim()
      ? input.deviceName.trim().slice(0, 120)
      : 'Device POS'
    const rawDeviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : ''
    const deviceId = rawDeviceId || crypto
      .createHash('sha256')
      .update(`${address}:${userAgent}`)
      .digest('hex')
      .slice(0, 24)
    const existing = this.devices.get(deviceId)
    const timestamp = new Date().toISOString()

    this.devices.set(deviceId, {
      deviceId,
      deviceName,
      userAgent,
      address,
      firstSeenAt: existing?.firstSeenAt ?? timestamp,
      lastSeenAt: timestamp,
      lastChannel: channel,
      requestCount: (existing?.requestCount ?? 0) + 1,
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, {
        success: true,
        data: {
          app: 'WariPOS',
          serverTime: new Date().toISOString(),
          tokenRequired: true,
        },
      })
      return
    }

    if (req.method !== 'POST' || req.url !== '/api/invoke') {
      sendJson(res, 404, { success: false, message: 'Endpoint tidak ditemukan' })
      return
    }

    try {
      const body = await readJsonBody(req)
      const token = String(body.token ?? '')
      const config = this.ensureConfig()

      const tokenBuffer = Buffer.from(token)
      const expectedBuffer = Buffer.from(config.token)
      if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
        sendJson(res, 401, { success: false, message: 'Token sinkronisasi tidak valid' })
        return
      }

      const channel = String(body.channel ?? '')
      if (!canInvokeRemoteSyncChannel(channel)) {
        sendJson(res, 403, { success: false, message: 'Channel sinkronisasi tidak diizinkan' })
        return
      }

      const args = Array.isArray(body.args) ? body.args : []
      this.requestCount += 1
      this.lastRequestAt = new Date().toISOString()
      this.lastChannel = channel
      this.trackDevice(req, body.device, channel)
      const result = await invokeChannel(channel, args)
      sendJson(res, 200, result)
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const SyncServerService = new SyncServer()
