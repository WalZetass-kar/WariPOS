import { app } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { IpcResponse } from '../shared/types.js'
import { normalizeSyncServerUrl } from '../shared/endpointSecurity.js'

interface SyncClientConfig {
  enabled: boolean
  baseUrl: string
  token: string
  deviceId: string
  deviceName: string
}

interface SyncClientStatus extends SyncClientConfig {
  lastConnectedAt: string | null
  lastError: string | null
  lastChannel: string | null
  requestCount: number
}

const REQUEST_TIMEOUT_MS = 12_000

function randomToken() {
  return crypto.randomBytes(16).toString('hex')
}

function defaultDeviceName() {
  return `${os.hostname() || 'Desktop POS'} (${process.platform})`
}

function defaultConfig(): SyncClientConfig {
  return {
    enabled: false,
    baseUrl: '',
    token: '',
    deviceId: randomToken(),
    deviceName: defaultDeviceName(),
  }
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'sync-client.json')
}

function configKey() {
  return crypto.scryptSync(`${app.getPath('userData')}:${app.getName()}`, 'zetass-pos-sync-client-config', 32)
}

function encryptConfig(config: SyncClientConfig) {
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

function decryptConfig(raw: string): Partial<SyncClientConfig> {
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

function normalizeConfig(value: Partial<SyncClientConfig> | null): SyncClientConfig {
  const base = defaultConfig()
  const baseUrlValue = typeof value?.baseUrl === 'string' ? value.baseUrl : ''
  const normalizedUrl = baseUrlValue ? normalizeSyncServerUrl(baseUrlValue) : null

  return {
    enabled: Boolean(value?.enabled),
    baseUrl: normalizedUrl?.valid ? normalizedUrl.url ?? '' : baseUrlValue.trim().replace(/\/+$/, ''),
    token: typeof value?.token === 'string' ? value.token.trim() : '',
    deviceId: typeof value?.deviceId === 'string' && value.deviceId.length >= 12 ? value.deviceId : base.deviceId,
    deviceName: typeof value?.deviceName === 'string' && value.deviceName.trim() ? value.deviceName.trim() : base.deviceName,
  }
}

function fail<T>(message: string): IpcResponse<T> {
  return { success: false, message }
}

const LOCAL_CHANNELS = new Set([
  'app:openExternal',
  'dialog:showSaveDialog',
  'export:penjualanExcel',
  'export:penjualanPDF',
  'export:stokExcel',
  'export:stokPDF',
  'export:cashFlowExcel',
  'export:priceListPDF',
  'export:taxReportExcel',
  'export:toExcel',
  'export:toPDF',
  'print:getPrinters',
  'print:execute',
  'marketplace:getChannels',
  'marketplace:saveChannel',
  'marketplace:deleteChannel',
  'marketplace:getSkuMap',
  'marketplace:saveSkuMap',
  'marketplace:runStockSync',
])

class SyncClient {
  private config: SyncClientConfig | null = null
  private lastConnectedAt: string | null = null
  private lastError: string | null = null
  private lastChannel: string | null = null
  private requestCount = 0

  init() {
    this.config = this.loadConfig()
  }

  getStatus(): SyncClientStatus {
    const config = this.ensureConfig()
    return {
      ...config,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
      lastChannel: this.lastChannel,
      requestCount: this.requestCount,
    }
  }

  saveConfig(input: Partial<SyncClientConfig>) {
    const current = this.ensureConfig()
    const next = normalizeConfig({
      ...current,
      ...input,
      deviceId: input.deviceId || current.deviceId,
      deviceName: input.deviceName || current.deviceName || defaultDeviceName(),
      token: input.token !== undefined ? input.token : current.token,
    })

    if (next.enabled) {
      const url = normalizeSyncServerUrl(next.baseUrl)
      if (!url.valid || !next.token) {
        return {
          success: false,
          message: url.message ?? 'URL server dan token wajib diisi',
          data: this.getStatus(),
        }
      }
      next.baseUrl = url.url ?? next.baseUrl
    }

    this.config = next
    this.persistConfig(next)
    return {
      success: true,
      data: this.getStatus(),
      message: next.enabled ? 'Mode client desktop diaktifkan' : 'Mode client desktop dimatikan',
    }
  }

  shouldForward(channel: string) {
    const config = this.ensureConfig()
    return (
      config.enabled &&
      Boolean(config.baseUrl && config.token) &&
      !channel.startsWith('sync:') &&
      !channel.startsWith('demo:') &&
      !LOCAL_CHANNELS.has(channel)
    )
  }

  async invoke<T>(channel: string, args: unknown[]): Promise<IpcResponse<T>> {
    const config = this.ensureConfig()
    const url = normalizeSyncServerUrl(config.baseUrl)
    if (!url.valid || !url.url) {
      this.lastError = url.message ?? 'URL server tidak valid'
      this.lastChannel = channel
      return fail(this.lastError)
    }

    const result = await this.postInvoke<T>(url.url, config.token, channel, args)
    this.lastChannel = channel
    this.requestCount += 1
    if (result.success) {
      this.lastConnectedAt = new Date().toISOString()
      this.lastError = null
    } else {
      this.lastError = result.message ?? 'Sync client gagal'
    }
    return result
  }

  async testConnection(input?: Partial<SyncClientConfig>) {
    const current = this.ensureConfig()
    const config = normalizeConfig({
      ...current,
      ...input,
      enabled: true,
      token: input?.token !== undefined ? input.token : current.token,
    })
    const url = normalizeSyncServerUrl(config.baseUrl)
    if (!url.valid || !url.url || !config.token) {
      return fail(url.message ?? 'URL server dan token wajib diisi')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const health = await fetch(`${url.url}/health`, { signal: controller.signal })
      if (!health.ok) return fail('Server developer tidak merespons health check')

      const result = await this.postInvoke(url.url, config.token, 'system:checkDb', [])
      if (!result.success) return result

      this.lastConnectedAt = new Date().toISOString()
      this.lastError = null
      this.lastChannel = 'system:checkDb'
      return {
        success: true,
        data: { connected: true, server: url.url },
        message: 'Desktop client tersambung ke server developer',
      }
    } catch (error) {
      return fail(
        error instanceof Error && error.name === 'AbortError'
          ? 'Koneksi ke server developer timeout'
          : 'Tidak bisa menghubungi server developer. Periksa jaringan, alamat, token, dan firewall.'
      )
    } finally {
      clearTimeout(timeout)
    }
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

  private persistConfig(config: SyncClientConfig) {
    const file = getConfigPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, encryptConfig(config), { mode: 0o600 })
  }

  private devicePayload() {
    const config = this.ensureConfig()
    return {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      userAgent: `WariPOS Desktop/${app.getVersion()} ${process.platform}/${process.arch}`,
    }
  }

  private async postInvoke<T>(baseUrl: string, token: string, channel: string, args: unknown[]): Promise<IpcResponse<T>> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl}/api/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          channel,
          args,
          device: this.devicePayload(),
        }),
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null) as IpcResponse<T> | null
      if (!response.ok || !result) {
        return fail(`Sinkronisasi gagal (${response.status}). Periksa server developer dan token.`)
      }
      return result
    } catch (error) {
      return fail(
        error instanceof Error && error.name === 'AbortError'
          ? 'Koneksi ke server developer timeout'
          : 'Tidak bisa terhubung ke server developer'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const SyncClientService = new SyncClient()
