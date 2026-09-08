import { sqlite } from '../../database/connection.js'
import { WhatsAppService, type WhatsAppSendResult } from '../services/whatsappService.js'
import { decryptData, encryptData } from '../services/crypto.js'
import { sanitizeText } from '../../shared/sanitize.js'

const TABLE = 'mediasoft_whatsapp_settings'
const TEMPLATE_TABLE = 'mediasoft_whatsapp_templates'
const HISTORY_TABLE = 'mediasoft_whatsapp_broadcast_history'
const DEFAULT_TEMPLATE = 'Terima kasih {customer}! Pesanan Anda sebesar {total} telah diterima. No. Transaksi: {invoice}'
const DEFAULT_BROADCAST_TEMPLATE = 'Halo {{nama_customer}}, terima kasih sudah berbelanja. Total belanja Anda {{total_belanja}} dan poin loyalty {{poin_loyalty}}.'
const SECRET_PREFIX = 'enc:v1:'

type WhatsAppSettingsRow = {
  id: number
  api_key: string | null
  enabled: number | null
  notify_on_sale: number | null
  notify_on_return: number | null
  notify_on_low_stock: number | null
  notify_on_payment: number | null
  message_template: string | null
  provider?: string | null
  rate_limit_per_minute?: number | null
  updated_at: string | null
}

type WhatsAppNotificationResult = WhatsAppSendResult & {
  attempted: boolean
}

function initTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY DEFAULT 1,
      api_key TEXT DEFAULT '',
      enabled INTEGER DEFAULT 0,
      notify_on_sale INTEGER DEFAULT 1,
      notify_on_return INTEGER DEFAULT 1,
      notify_on_low_stock INTEGER DEFAULT 0,
      notify_on_payment INTEGER DEFAULT 1,
      message_template TEXT DEFAULT 'Terima kasih {customer}! Pesanan Anda sebesar {total} telah diterima. No. Transaksi: {invoice}',
      provider TEXT DEFAULT 'fonnte',
      rate_limit_per_minute INTEGER DEFAULT 20,
      updated_at TEXT
    )
  `)

  ensureColumn('provider', "TEXT DEFAULT 'fonnte'")
  ensureColumn('rate_limit_per_minute', 'INTEGER DEFAULT 20')
  ensureColumn('api_key', "TEXT DEFAULT ''")
  ensureColumn('enabled', 'INTEGER DEFAULT 0')
  ensureColumn('notify_on_sale', 'INTEGER DEFAULT 1')
  ensureColumn('notify_on_return', 'INTEGER DEFAULT 1')
  ensureColumn('notify_on_low_stock', 'INTEGER DEFAULT 0')
  ensureColumn('notify_on_payment', 'INTEGER DEFAULT 1')
  ensureColumn('message_template', `TEXT DEFAULT '${DEFAULT_TEMPLATE.replace(/'/g, "''")}'`)
  ensureColumn('updated_at', 'TEXT')

  sqlite.prepare(`INSERT OR IGNORE INTO ${TABLE} (id) VALUES (1)`).run()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${TEMPLATE_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_type TEXT NOT NULL,
      total_targets INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      scheduled_at TEXT,
      sent_at TEXT,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )
  `)
  const templateCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${TEMPLATE_TABLE}`).get() as { c: number }
  if (templateCount.c === 0) {
    sqlite.prepare(`INSERT INTO ${TEMPLATE_TABLE} (name, content, created_at) VALUES (?, ?, ?)`)
      .run('Promo Customer', DEFAULT_BROADCAST_TEMPLATE, new Date().toISOString())
  }
}

try { initTable() } catch (e) { console.error('WhatsApp table init failed:', e) }

function ensureColumn(name: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${TABLE})`).all() as Array<{ name: string }>
  if (!columns.some(column => column.name === name)) {
    sqlite.exec(`ALTER TABLE ${TABLE} ADD COLUMN ${name} ${definition}`)
  }
}

function ensureRow(): WhatsAppSettingsRow {
  initTable()
  sqlite.prepare(`INSERT OR IGNORE INTO ${TABLE} (id) VALUES (1)`).run()
  const row = sqlite.prepare(`SELECT * FROM ${TABLE} WHERE id = 1`).get() as WhatsAppSettingsRow
  const storedKey = String(row.api_key ?? '').trim()
  if (storedKey && !storedKey.startsWith(SECRET_PREFIX)) {
    sqlite.prepare(`UPDATE ${TABLE} SET api_key = ? WHERE id = 1`).run(encryptSecret(storedKey))
  }
  return { ...row, api_key: decryptSecret(row.api_key) }
}

function encryptionSecret() {
  return process.env.ZETASS_POS_LOCAL_SECRET || `${process.cwd()}:zetass-pos:v2`
}

function encryptSecret(value: unknown) {
  const plain = String(value ?? '').trim()
  if (!plain) return ''
  if (plain.startsWith(SECRET_PREFIX)) return plain
  return `${SECRET_PREFIX}${encryptData(plain, encryptionSecret())}`
}

function decryptSecret(value: unknown) {
  const stored = String(value ?? '').trim()
  if (!stored) return ''
  if (!stored.startsWith(SECRET_PREFIX)) return stored
  try {
    return decryptData(stored.slice(SECRET_PREFIX.length), encryptionSecret())
  } catch {
    return ''
  }
}

function boolToDb(value: unknown, fallback = false): number {
  if (value === undefined || value === null) return fallback ? 1 : 0
  return value ? 1 : 0
}

function normalizeTemplate(template: unknown): string {
  const value = String(template ?? '').trim()
  return value || DEFAULT_TEMPLATE
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((message, [key, value]) => (
    message
      .split(`{${key}}`).join(value)
      .split(`{{${key}}}`).join(value)
  ), template)
}

function rateLimit(value: unknown) {
  const limit = Number(value)
  if (!Number.isFinite(limit)) return 20
  return Math.min(60, Math.max(1, Math.round(limit)))
}

export class WhatsAppController {
  static get() {
    try {
      const data = ensureRow()
      return { success: true, data }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static save(data: any) {
    try {
      ensureRow()
      const apiKey = String(data.apiKey ?? '').trim()
      if (data.enabled && !apiKey) {
        return { success: false, message: 'API key Fonnte wajib diisi sebelum WhatsApp diaktifkan' }
      }

      sqlite.prepare(`
        UPDATE ${TABLE} SET
          api_key = ?,
          enabled = ?,
          notify_on_sale = ?,
          notify_on_return = ?,
          notify_on_low_stock = ?,
          notify_on_payment = ?,
          message_template = ?,
          provider = ?,
          rate_limit_per_minute = ?,
          updated_at = ?
        WHERE id = 1
      `).run(
        encryptSecret(apiKey),
        boolToDb(data.enabled),
        boolToDb(data.notifyOnSale, true),
        boolToDb(data.notifyOnReturn, true),
        boolToDb(data.notifyOnLowStock),
        boolToDb(data.notifyOnPayment, true),
        normalizeTemplate(data.messageTemplate),
        String(data.provider ?? 'fonnte'),
        rateLimit(data.rateLimitPerMinute),
        new Date().toISOString()
      )
      return { success: true, data: ensureRow() }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static async test(input: string | { phone?: string; apiKey?: string; message?: string }) {
    try {
      const row = ensureRow()
      const payload = typeof input === 'string' ? { phone: input } : input
      const phone = String(payload?.phone ?? '').trim()
      const apiKey = String(payload?.apiKey ?? row?.api_key ?? '').trim()

      if (!apiKey) return { success: false, message: 'API key Fonnte belum dikonfigurasi' }
      if (!phone) return { success: false, message: 'Nomor HP wajib diisi' }

      WhatsAppService.init(apiKey)
      const result = await WhatsAppService.sendMessage({
        to: phone,
        message: payload?.message || 'Test notifikasi dari WariPOS berhasil.',
        typing: true,
      })
      return result
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static getTemplates() {
    try {
      initTable()
      const rows = sqlite.prepare(`SELECT * FROM ${TEMPLATE_TABLE} ORDER BY id DESC`).all()
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static saveTemplate(data: { id?: number; name?: string; content?: string }) {
    try {
      initTable()
      const name = String(data.name ?? '').trim() || 'Template Broadcast'
      const content = String(data.content ?? '').trim() || DEFAULT_BROADCAST_TEMPLATE
      const now = new Date().toISOString()
      if (data.id) {
        sqlite.prepare(`UPDATE ${TEMPLATE_TABLE} SET name = ?, content = ?, updated_at = ? WHERE id = ?`)
          .run(name, content, now, data.id)
      } else {
        sqlite.prepare(`INSERT INTO ${TEMPLATE_TABLE} (name, content, created_at) VALUES (?, ?, ?)`)
          .run(name, content, now)
      }
      return this.getTemplates()
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static getBroadcastHistory() {
    try {
      initTable()
      const rows = sqlite.prepare(`SELECT * FROM ${HISTORY_TABLE} ORDER BY id DESC LIMIT 100`).all()
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static saveBroadcastHistory(data: {
    title?: string
    targetType?: string
    totalTargets?: number
    delivered?: number
    failed?: number
    scheduledAt?: string | null
    sentAt?: string | null
    status?: string
    detail?: unknown
  }) {
    try {
      initTable()
      sqlite.prepare(`
        INSERT INTO ${HISTORY_TABLE}
          (title, target_type, total_targets, delivered, failed, scheduled_at, sent_at, status, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(data.title ?? 'Broadcast WhatsApp'),
        String(data.targetType ?? 'manual'),
        Number(data.totalTargets ?? 0),
        Number(data.delivered ?? 0),
        Number(data.failed ?? 0),
        data.scheduledAt ?? null,
        data.sentAt ?? null,
        String(data.status ?? 'completed'),
        data.detail === undefined ? null : JSON.stringify(data.detail),
        new Date().toISOString()
      )
      return this.getBroadcastHistory()
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  /** Get settings row (used internally by other controllers) */
  static getSettings() {
    return ensureRow()
  }

  static async sendSaleNotification(data: {
    phone?: string | null
    customerName?: string | null
    invoice: string
    total: number
  }): Promise<WhatsAppNotificationResult> {
    const row = ensureRow()
    if (!row.enabled || (!row.notify_on_sale && !row.notify_on_payment)) {
      return { attempted: false, success: true, message: 'Notifikasi WhatsApp transaksi nonaktif' }
    }
    if (!row.api_key) return { attempted: false, success: false, message: 'API key Fonnte belum dikonfigurasi' }
    if (!data.phone) return { attempted: false, success: false, message: 'Customer belum memiliki nomor WhatsApp' }

    const message = renderTemplate(normalizeTemplate(row.message_template), {
      customer: sanitizeText(data.customerName || 'Customer'),
      total: `Rp ${data.total.toLocaleString('id-ID')}`,
      invoice: sanitizeText(data.invoice),
    })

    WhatsAppService.init(row.api_key)
    const result = await WhatsAppService.sendMessage({ to: data.phone, message, typing: true })
    return { attempted: true, ...result }
  }

  static async sendReturnNotification(data: {
    phone?: string | null
    customerName?: string | null
    returnNumber: string
    total: number
    refundMethod?: string | null
  }): Promise<WhatsAppNotificationResult> {
    const row = ensureRow()
    if (!row.enabled || !row.notify_on_return) {
      return { attempted: false, success: true, message: 'Notifikasi WhatsApp return nonaktif' }
    }
    if (!row.api_key) return { attempted: false, success: false, message: 'API key Fonnte belum dikonfigurasi' }
    if (!data.phone) return { attempted: false, success: false, message: 'Customer belum memiliki nomor WhatsApp' }

    const message = [
      `Halo ${data.customerName || 'Customer'},`,
      '',
      `Return ${data.returnNumber} sebesar Rp ${data.total.toLocaleString('id-ID')} sudah dicatat.`,
      data.refundMethod ? `Metode refund: ${data.refundMethod}.` : '',
      '',
      'Terima kasih.',
    ].filter(Boolean).join('\n')

    WhatsAppService.init(row.api_key)
    const result = await WhatsAppService.sendMessage({ to: data.phone, message, typing: true })
    return { attempted: true, ...result }
  }

  static async sendLowStockNotification(ownerPhone: string | null | undefined, products: Array<{ name: string; stock: number }>): Promise<WhatsAppNotificationResult> {
    const row = ensureRow()
    if (!row.enabled || !row.notify_on_low_stock) {
      return { attempted: false, success: true, message: 'Notifikasi WhatsApp stok menipis nonaktif' }
    }
    if (!row.api_key) return { attempted: false, success: false, message: 'API key Fonnte belum dikonfigurasi' }
    if (!ownerPhone) return { attempted: false, success: false, message: 'Nomor WhatsApp owner belum diisi' }
    if (!products.length) return { attempted: false, success: true, message: 'Tidak ada stok menipis' }

    WhatsAppService.init(row.api_key)
    const result = await WhatsAppService.sendLowStockAlert(ownerPhone, products)
    return { attempted: true, ...result }
  }
}
