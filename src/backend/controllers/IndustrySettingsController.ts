import { sqlite } from '../../database/connection.js'
import { normalizeIndustrySettings, type IndustrySettings } from '../../shared/industrySettings.js'
import { dashboardSummaryToSheetsPayload, testGoogleSheetsPayload, type GoogleSheetsPayload } from '../../shared/googleSheetsExport.js'
import type { DashboardSummary } from '../../shared/types.js'
import { decryptData, encryptData } from '../services/crypto.js'

const TABLE = 'mediasoft_industry_settings'
const AI_KEY_PREFIX = 'enc:v1:'

function encryptionSecret() {
  return process.env.ZETASS_POS_LOCAL_SECRET || `${process.cwd()}:zetass-pos:v2`
}

function encryptAiKey(value: string) {
  const plain = String(value ?? '').trim()
  if (!plain) return ''
  if (plain.startsWith(AI_KEY_PREFIX)) return plain
  return `${AI_KEY_PREFIX}${encryptData(plain, encryptionSecret())}`
}

function decryptAiKey(value: unknown) {
  const stored = String(value ?? '').trim()
  if (!stored) return ''
  if (!stored.startsWith(AI_KEY_PREFIX)) return stored

  try {
    return decryptData(stored.slice(AI_KEY_PREFIX.length), encryptionSecret())
  } catch {
    return ''
  }
}

function initTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ai_enabled INTEGER DEFAULT 0,
      ai_provider TEXT DEFAULT 'local',
      ai_model TEXT DEFAULT '',
      ai_base_url TEXT DEFAULT '',
      ai_api_key TEXT DEFAULT '',
      google_sheets_enabled INTEGER DEFAULT 0,
      google_sheets_webapp_url TEXT DEFAULT '',
      auto_backup_enabled INTEGER DEFAULT 1,
      backup_retention_days INTEGER DEFAULT 30,
      updated_at TEXT
    )
  `)

  const columns = sqlite.prepare(`PRAGMA table_info(${TABLE})`).all() as Array<{ name: string }>
  const ensure = (name: string, definition: string) => {
    if (!columns.some(column => column.name === name)) {
      sqlite.exec(`ALTER TABLE ${TABLE} ADD COLUMN ${name} ${definition}`)
    }
  }

  ensure('ai_enabled', 'INTEGER DEFAULT 0')
  ensure('ai_provider', "TEXT DEFAULT 'local'")
  ensure('ai_model', "TEXT DEFAULT ''")
  ensure('ai_base_url', "TEXT DEFAULT ''")
  ensure('ai_api_key', "TEXT DEFAULT ''")
  ensure('google_sheets_enabled', 'INTEGER DEFAULT 0')
  ensure('google_sheets_webapp_url', "TEXT DEFAULT ''")
  ensure('auto_backup_enabled', 'INTEGER DEFAULT 1')
  ensure('backup_retention_days', 'INTEGER DEFAULT 30')
  ensure('updated_at', 'TEXT')

  sqlite.prepare(`INSERT OR IGNORE INTO ${TABLE} (id) VALUES (1)`).run()
}

try { initTable() } catch (error) { console.error('Industry settings init failed:', error) }

function readSettings(): IndustrySettings {
  initTable()
  sqlite.prepare(`INSERT OR IGNORE INTO ${TABLE} (id) VALUES (1)`).run()
  const row = sqlite.prepare(`SELECT * FROM ${TABLE} WHERE id = 1`).get() as Record<string, unknown> | undefined
  const settings = normalizeIndustrySettings({
    ...row,
    ai_api_key: decryptAiKey(row?.ai_api_key),
  })

  const storedKey = String(row?.ai_api_key ?? '').trim()
  if (storedKey && !storedKey.startsWith(AI_KEY_PREFIX)) {
    sqlite.prepare(`UPDATE ${TABLE} SET ai_api_key = ? WHERE id = 1`).run(encryptAiKey(storedKey))
  }

  return settings
}

function assertWebAppUrl(url: string) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\//i.test(url)) {
    throw new Error('URL Apps Script harus diawali https://script.google.com/macros/s/')
  }
}

async function postToGoogleSheets(url: string, payload: unknown) {
  assertWebAppUrl(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow',
    })
    const data = await response.json().catch(() => null) as { success?: boolean; message?: string } | null
    if (!response.ok) {
      throw new Error(data?.message || `Google Sheets HTTP ${response.status}`)
    }
    if (!data || data.success !== true) {
      throw new Error(data?.message || 'Apps Script tidak mengembalikan JSON sukses. Pastikan template Apps Script sudah dipasang dan di-deploy sebagai Web App.')
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export class IndustrySettingsController {
  static get() {
    try {
      return { success: true, data: readSettings() }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static save(data: Partial<IndustrySettings>) {
    try {
      const settings = normalizeIndustrySettings({ ...readSettings(), ...data })
      sqlite.prepare(`
        UPDATE ${TABLE} SET
          ai_enabled = ?,
          ai_provider = ?,
          ai_model = ?,
          ai_base_url = ?,
          ai_api_key = ?,
          google_sheets_enabled = ?,
          google_sheets_webapp_url = ?,
          auto_backup_enabled = ?,
          backup_retention_days = ?,
          updated_at = ?
        WHERE id = 1
      `).run(
        settings.aiEnabled ? 1 : 0,
        settings.aiProvider,
        settings.aiModel,
        settings.aiBaseUrl,
        encryptAiKey(settings.aiApiKey),
        settings.googleSheetsEnabled ? 1 : 0,
        settings.googleSheetsWebAppUrl,
        settings.autoBackupEnabled ? 1 : 0,
        settings.backupRetentionDays,
        new Date().toISOString()
      )
      return { success: true, data: readSettings(), message: 'Pengaturan industri disimpan' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static getSettings() {
    return readSettings()
  }

  static async testGoogleSheets(overrideSettings?: any) {
    try {
      const saved = readSettings()
      const settings = overrideSettings ? { ...saved, ...overrideSettings } : saved
      const url = String(settings.googleSheetsWebAppUrl || '').trim()
      if (!url) {
        return { success: false, message: 'URL Web App Apps Script belum diisi' }
      }
      const result = await postToGoogleSheets(url, testGoogleSheetsPayload())
      return { success: true, data: result, message: 'Koneksi Google Sheets berhasil tersambung' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  static async exportDashboardToSheets(summary: DashboardSummary) {
    try {
      const settings = readSettings()
      if (!settings.googleSheetsEnabled || !settings.googleSheetsWebAppUrl) {
        return {
          success: false,
          data: { mode: 'clipboard' },
          message: 'Google Sheets otomatis belum dikonfigurasi',
        }
      }

      const result = await postToGoogleSheets(settings.googleSheetsWebAppUrl, dashboardSummaryToSheetsPayload(summary))
      return {
        success: true,
        data: { mode: 'apps-script', result },
        message: 'Dashboard berhasil dikirim ke Google Sheets',
      }
    } catch (error) {
      return {
        success: false,
        data: { mode: 'clipboard' },
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  static async exportReportToSheets(payload: GoogleSheetsPayload) {
    try {
      const settings = readSettings()
      if (!settings.googleSheetsEnabled || !settings.googleSheetsWebAppUrl) {
        return {
          success: false,
          data: { mode: 'clipboard' },
          message: 'Google Sheets otomatis belum dikonfigurasi',
        }
      }

      const result = await postToGoogleSheets(settings.googleSheetsWebAppUrl, payload)
      return {
        success: true,
        data: { mode: 'apps-script', result },
        message: 'Laporan berhasil dikirim ke Google Sheets',
      }
    } catch (error) {
      return {
        success: false,
        data: { mode: 'clipboard' },
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
