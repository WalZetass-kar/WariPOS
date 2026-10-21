import { createClient } from '@supabase/supabase-js'
import type { Database } from './types' // We will define this later

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key]
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

export const supabaseUrl = getEnv('VITE_SUPABASE_URL') || ''
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

class NoopWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = 3
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

const realtimeTransport = typeof WebSocket !== 'undefined'
  ? undefined
  : ((globalThis as any).WebSocket || NoopWebSocket)

// The credentials come from the build environment. There is no fallback value
// in the source, a build without these variables runs without the cloud
// features instead of talking to an unknown project.
const clientUrl = supabaseUrl || 'https://not-configured.invalid'
const clientKey = supabaseAnonKey || 'not-configured'

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  ...(realtimeTransport ? { realtime: { transport: realtimeTransport } } : {}),
})

supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return
  if (event === 'SIGNED_OUT') return
})

// Refresh token expiry is handled by Supabase auth state listener in AuthContext

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey
}

export const getSupabaseConfig = () => {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  }
}

