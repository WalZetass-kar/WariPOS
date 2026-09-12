/**
 * API WRAPPER — Pre-flight demo block + typed IPC invocation
 * 
 * This is the renderer-side API layer with demo mode pre-filtering.
 * 
 * SECURITY NOTE: This pre-flight block is a UX optimization only.
 * Even if bypassed (e.g., by calling window.api.invoke directly from DevTools),
 * the main process IPC guard will still block the mutation.
 */

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
  'calculate', 'ask', 'testAi', 'listAiModels', 'testGoogleSheets', 'exportDashboardToSheets',
  'syncBuyerLicense',
] as const

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
 * Typed wrapper around window.api.invoke with demo mode pre-flight check.
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

  // ─── INVOKE THE IPC CHANNEL ────────────────────────────────────────
  try {
    const result = !window.api?.invoke
      ? await mobileApi<T>(channel, ...args)
      : await window.api.invoke(channel, ...args) as IpcResponse<T>

    const errorCode = (result as any)?.error_code
    if (errorCode === 'AUTH_REQUIRED' && channel !== 'auth:restoreSession' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:required'))
    }

    return result
  } catch (error: any) {
    // During development, Vite can hot-reload the renderer while the Electron
    // main process still runs the old IPC registry.
    const message = error?.message || 'Terjadi kesalahan pada sistem'
    const missingHandler = /No handler registered/i.test(message)

    console.error(`[API Error] [${channel}]:`, error)
    return {
      success: false,
      message: missingHandler
        ? 'Handler Electron belum aktif. Restart aplikasi agar channel IPC terbaru dimuat.'
        : message,
    } as IpcResponse<T>
  }
}
