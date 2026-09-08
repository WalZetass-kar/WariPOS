import { supabase } from './config.js'

const isDebug = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_SUPABASE === 'true'

export function logSupabaseQuery(method: string, table: string, select: string, filter: Record<string, unknown>) {
  if (isDebug) {
    console.log(`[Supabase] ${method} ${table}`, {
      select,
      filter,
      timestamp: new Date().toISOString(),
    })
  }
}

export function logSupabaseResponse(table: string, method: string, status: number | undefined, error: any, data: any) {
  if (error) {
    console.error(`[Supabase] ERROR ${method} ${table}`, {
      status,
      code: (error as any)?.code ?? 'N/A',
      message: (error as any)?.message ?? 'N/A',
      details: (error as any)?.details ?? 'N/A',
      hint: (error as any)?.hint ?? 'N/A',
      timestamp: new Date().toISOString(),
    })
  } else if (isDebug) {
    console.log(`[Supabase] OK ${method} ${table}`, {
      status,
      rows: Array.isArray(data) ? data.length : data ? 1 : 0,
      timestamp: new Date().toISOString(),
    })
  }
}

export interface ActivityLogParams {
  username: string
  actorUserId?: string | null
  action: string
  module: string
  detail: string
  deviceId?: string
  userAgent?: string
}

function eventTypeFromAction(action: string): string {
  if (action.startsWith('APP_ERROR') || action.startsWith('ERROR')) return 'error'
  if (action.startsWith('APP_WARN')) return 'warning'
  return 'info'
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export const logActivity = async (params: ActivityLogParams) => {
  try {
    const userId = params.actorUserId ?? (isUUID(params.username) ? params.username : null)
    const dataToInsert: Record<string, unknown> = {
      action: params.action,
      actor_user_id: userId,
      event_type: eventTypeFromAction(params.action),
      metadata: {
        module: params.module,
        detail: params.detail,
        device_id: params.deviceId,
        username: params.username,
      },
      user_agent: params.userAgent || null,
      created_at: new Date().toISOString(),
    }
    const { error } = await (supabase.from('activity_logs') as any).insert([dataToInsert])
    if (error) {
      console.warn('[ActivityLog] Insert failed (non-critical):', error.code ?? error.message)
    }
    return { success: !error, error }
  } catch (err: any) {
    console.warn('[ActivityLog] Skipped:', err?.message ?? err)
    return { success: false, error: err.message }
  }
}
