/**
 * Centralized Error Handler Service
 * Handles all errors with proper logging, categorization, and user-friendly messages
 */

import fs from 'fs'
import path from 'path'
import { resolveLogDir } from '../utils/logDir.js'

export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface ErrorLog {
  timestamp: string
  severity: ErrorSeverity
  module: string
  message: string
  stack?: string
  username?: string
  context?: Record<string, any>
}

class ErrorHandler {
  private logDir: string
  private maxRetries = 3
  private retryDelay = 1000 // 1 second

  constructor() {
    // Create logs directory if it doesn't exist
    this.logDir = resolveLogDir()
    try {
      fs.mkdirSync(this.logDir, { recursive: true })
    } catch (err) {
      console.error('[ErrorHandler] Cannot create log directory:', err)
    }
  }

  /**
   * Log an error with proper categorization
   * @param error - Error object or message
   * @param severity - Error severity level
   * @param module - Module where error occurred
   * @param username - Username if available
   * @param context - Additional context
   */
  log(
    error: Error | string,
    severity: ErrorSeverity,
    module: string,
    username?: string,
    context?: Record<string, any>
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      severity,
      module,
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      username,
      context: this.sanitizeContext(context),
    }

    // Write to log file
    this.writeToFile(errorLog)

    // Console log for development
    if (process.env.NODE_ENV !== 'production') {
      this.consoleLog(errorLog)
    }

    // Create notification for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.createCriticalNotification(errorLog)
    }
  }

  /**
   * Handle error with retry mechanism
   * @param fn - Function to execute
   * @param retries - Number of retries
   * @param delay - Delay between retries in ms
   * @returns Result of function execution
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries,
    delay: number = this.retryDelay
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (retries > 0) {
        await this.sleep(delay)
        return this.withRetry(fn, retries - 1, delay * 2) // Exponential backoff
      }
      throw error
    }
  }

  /**
   * Get user-friendly error message
   * @param error - Error object
   * @returns User-friendly message
   */
  getUserFriendlyMessage(error: Error | string): string {
    const message = error instanceof Error ? error.message : error

    // Map technical errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'SQLITE_BUSY': 'Database sedang sibuk. Silakan coba lagi.',
      'SQLITE_LOCKED': 'Database terkunci. Silakan coba lagi.',
      'SQLITE_CONSTRAINT': 'Data tidak valid atau sudah ada.',
      'ENOENT': 'File tidak ditemukan.',
      'EACCES': 'Akses ditolak.',
      'ETIMEDOUT': 'Koneksi timeout. Silakan coba lagi.',
      'ECONNREFUSED': 'Koneksi ditolak.',
      'Network request failed': 'Koneksi jaringan gagal. Periksa koneksi internet Anda.',
    }

    for (const [key, value] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return value
      }
    }

    // Default user-friendly message
    return 'Terjadi kesalahan. Silakan coba lagi atau hubungi administrator.'
  }

  /**
   * Write error log to file
   * @param errorLog - Error log object
   */
  private writeToFile(errorLog: ErrorLog): void {
    try {
      const date = new Date().toISOString().split('T')[0]
      const logFile = path.join(this.logDir, `error-${date}.log`)
      
      const logLine = JSON.stringify(errorLog) + '\n'
      
      fs.appendFileSync(logFile, logLine, 'utf8')
      
      // Clean up old logs (keep last 30 days)
      this.cleanupOldLogs()
    } catch (error) {
      console.error('Failed to write error log:', error)
    }
  }

  /**
   * Console log for development
   * @param errorLog - Error log object
   */
  private consoleLog(errorLog: ErrorLog): void {
    const colors = {
      INFO: '\x1b[36m',      // Cyan
      WARNING: '\x1b[33m',   // Yellow
      ERROR: '\x1b[31m',     // Red
      CRITICAL: '\x1b[35m',  // Magenta
    }
    
    const reset = '\x1b[0m'
    const color = colors[errorLog.severity]
    
    console.log(
      `${color}[${errorLog.severity}]${reset} ${errorLog.timestamp} - ${errorLog.module}: ${errorLog.message}`
    )
    
    if (errorLog.stack) {
      console.log(errorLog.stack)
    }
  }

  /**
   * Create notification for critical errors
   * @param errorLog - Error log object
   */
  private createCriticalNotification(errorLog: ErrorLog): void {
    try {
      // Import NotifikasiModel dynamically to avoid circular dependency
      import('../models/NotifikasiModel.js').then(({ NotifikasiModel }) => {
        NotifikasiModel.create({
          judul: `Critical Error: ${errorLog.module}`,
          pesan: errorLog.message,
          jenis: 'SYSTEM',
          username: errorLog.username || 'SYSTEM',
        })
      })
    } catch (error) {
      console.error('Failed to create critical notification:', error)
    }
  }

  /**
   * Sanitize context to remove sensitive information
   * @param context - Context object
   * @returns Sanitized context
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined

    const sanitized = { ...context }
    const sensitiveKeys = ['password', 'kata_sandi', 'token', 'secret', 'apiKey', 'api_key']

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***'
      }
    }

    return sanitized
  }

  /**
   * Clean up old log files (keep last 30 days)
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
      const now = Date.now()
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)

      for (const file of files) {
        if (file.startsWith('error-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file)
          const stats = fs.statSync(filePath)
          
          if (stats.mtimeMs < thirtyDaysAgo) {
            fs.unlinkSync(filePath)
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * Sleep utility for retry mechanism
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get logs for a specific date
   * @param date - Date in YYYY-MM-DD format
   * @returns Array of error logs
   */
  getLogsByDate(date: string): ErrorLog[] {
    try {
      const logFile = path.join(this.logDir, `error-${date}.log`)
      
      if (!fs.existsSync(logFile)) {
        return []
      }

      const content = fs.readFileSync(logFile, 'utf8')
      const lines = content.trim().split('\n')
      
      return lines
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as ErrorLog)
    } catch (error) {
      console.error('Failed to read logs:', error)
      return []
    }
  }

  /**
   * Get logs by severity
   * @param severity - Error severity
   * @param days - Number of days to look back
   * @returns Array of error logs
   */
  getLogsBySeverity(severity: ErrorSeverity, days: number = 7): ErrorLog[] {
    const logs: ErrorLog[] = []
    
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayLogs = this.getLogsByDate(dateStr)
      logs.push(...dayLogs.filter(log => log.severity === severity))
    }
    
    return logs
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler()

/**
 * Wrap async function with error handling
 * @param fn - Async function to wrap
 * @param module - Module name
 * @param username - Username if available
 * @returns Wrapped function
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  module: string,
  username?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      errorHandler.log(
        error as Error,
        ErrorSeverity.ERROR,
        module,
        username,
        { args }
      )
      
      return {
        success: false,
        message: errorHandler.getUserFriendlyMessage(error as Error),
      }
    }
  }) as T
}
