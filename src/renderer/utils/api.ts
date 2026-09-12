import type { IpcResponse } from '../../shared/types'
import { isDemoMode, getDemoBlockedMessage } from './demo'
import { mobileApi } from './mobileApi'

/**
 * READ-ONLY channel patterns — these are always allowed even in demo mode.
 * We use a conservative approach: if it's NOT clearly a read, we block it.
 */
const READ_PATTERNS: readonly string[] = [
  'getAll', 'get', 'search', 'getDetail', 'getById',
  'getSummary', 'getLaporan', 'getActive', 'getUnread',
  'check', 'download', 'export', 'print',
  'getRiwayat', 'getByProduct', 'getItems', 'getPayments',
  'getCurrent', 'getByModul', 'getByUsername', 'getMigrationStatus',
  'getSettings', 'getPermissions', 'getBirthdayToday',
  'getTransaksi', 'getKasById', 'getAllKas', 'getActiveKas',
  'getUnreadCount', 'getHistory', 'getDetails', 'getUsageCount',
  'calculate', 'ask', 'testAi', 'listAiModels', 'testGoogleSheets', 'exportDashboardToSheets', 'exportReportToSheets',
  'syncBuyerLicense',
] as const

/**
 * Channels that should be retried on failure
 */
const RETRYABLE_CHANNELS: readonly string[] = [
  'network', 'timeout', 'connection',
] as const

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT_MS = 30000

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 2

/**
 * Check if a channel is a read operation based on its name.
 */
function isReadChannel(channel: string): boolean {
  // Auth and demo channels are always allowed
  if (channel.startsWith('auth:') || channel.startsWith('demo:')) return true
  
  // Laporan/export channels are always read-only
  if (channel.startsWith('laporan:') || channel.startsWith('export:')) return true
  
  // Check if any read pattern matches
  return READ_PATTERNS.some(p => channel.includes(p))
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  const message = (error?.message || '').toLowerCase()
  return RETRYABLE_CHANNELS.some(pattern => message.includes(pattern))
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
  })
}

/**
 * Typed wrapper around window.api.invoke with demo mode pre-flight check.
 * Includes retry logic and timeout handling.
 * 
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the handler
 * @returns Typed IPC response
 */
export async function api<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  // ─── DEMO MODE PRE-FLIGHT BLOCK (UX optimization) ─────────────────
  const demoMode = isDemoMode()
  const isRead = isReadChannel(channel)

  if (demoMode && !isRead) {
    console.warn(`[DEMO PRE-FLIGHT] Blocked: ${channel}`)
    return {
      success: false,
      message: getDemoBlockedMessage(),
    } as IpcResponse<T>
  }

  // Debug logging for delete operations
  if (channel.includes('delete')) {
    console.log(`[API DEBUG] Channel: ${channel}, isDemoMode: ${demoMode}, isReadChannel: ${isRead}`)
  }

  // ─── INVOKE THE IPC CHANNEL WITH RETRY LOGIC ────────────────────────
  let lastError: any = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Race between the actual request and timeout
      const result = await Promise.race([
        invokeChannel<T>(channel, ...args),
        createTimeoutPromise<IpcResponse<T>>(REQUEST_TIMEOUT_MS),
      ])

      const errorCode = (result as any)?.error_code
      if (errorCode === 'AUTH_REQUIRED' && channel !== 'auth:restoreSession' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:required'))
      }

      return result
    } catch (error: any) {
      lastError = error

      // Only retry on retryable errors and if we haven't exceeded max retries
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        console.warn(`[API RETRY] Attempt ${attempt + 1}/${MAX_RETRIES} for ${channel}:`, error.message)
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500))
        continue
      }

      break
    }
  }

  // ─── HANDLE FINAL ERROR ──────────────────────────────────────────────
  const message = lastError?.message || 'Terjadi kesalahan pada sistem'
  const missingHandler = /No handler registered/i.test(message)
  const timeout = /timeout/i.test(message)

  console.error(`[API Error] [${channel}]:`, lastError)
  return {
    success: false,
    message: missingHandler
      ? 'Handler Electron belum aktif. Restart aplikasi agar channel IPC terbaru dimuat.'
      : timeout
        ? 'Request timeout. Server tidak merespons dalam 30 detik.'
        : message,
  } as IpcResponse<T>
}

/**
 * Internal function to invoke the actual IPC channel
 */
async function invokeChannel<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  if (!window.api?.invoke) {
    return await mobileApi<T>(channel, ...args)
  }

  return await window.api.invoke(channel, ...args) as IpcResponse<T>
}
