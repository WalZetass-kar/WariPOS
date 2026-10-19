import { sqlite } from '../../database/connection.js'
import * as fs from 'fs'
import * as path from 'path'
import { resolveLogDir } from '../utils/logDir.js'

const LOG_DIR = resolveLogDir()
const LOG_FILE = path.join(LOG_DIR, 'error.log')

export class ErrorLogService {
  /**
   * Initialize log directory
   */
  static init() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  }

  /**
   * Log to file
   */
  private static logToFile(level: string, message: string, stack?: string, context?: string, userId?: string) {
    try {
      this.init()
      const timestamp = new Date().toISOString()
      const logLine = `[${timestamp}] [${level}] ${message}\n${stack || ''}\nContext: ${context || 'N/A'}\nUser: ${userId || 'N/A'}\n\n`
      fs.appendFileSync(LOG_FILE, logLine)
    } catch (error) {
      console.error('[ErrorLogService] Failed to write to file:', error)
    }
  }

  static log(errorType: string, errorMessage: string, stackTrace?: string, userId?: string, context?: string) {
    try {
      sqlite.prepare('INSERT INTO mediasoft_error_logs (error_type, error_message, stack_trace, user_id, context) VALUES (?, ?, ?, ?, ?)').run(errorType, errorMessage, stackTrace, userId, context)
      
      // Also log to file
      this.logToFile(errorType, errorMessage, stackTrace, context, userId)
    } catch (err) {
      console.error('Failed to log error:', err)
      // Fallback to file only
      this.logToFile(errorType, errorMessage, stackTrace, context, userId)
    }
  }

  static getAll(limit: number = 100) {
    return sqlite.prepare('SELECT * FROM mediasoft_error_logs ORDER BY created_at DESC LIMIT ?').all(limit)
  }

  static deleteOld(days: number = 30) {
    const result = sqlite.prepare('DELETE FROM mediasoft_error_logs WHERE created_at < datetime("now", ?)').run(`-${days} days`)
    return { deleted: result.changes }
  }

  static clear() {
    const result = sqlite.prepare('DELETE FROM mediasoft_error_logs').run()
    return { deleted: result.changes }
  }
}
