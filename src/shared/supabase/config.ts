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

export const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://azhkvmkmimepmflzqqty.supabase.co'
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6aGt2bWttaW1lcG1mbHpxcXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjk4MDgsImV4cCI6MjA5NDk0NTgwOH0.GqkMaagU-slATsjVB_6T0dA4JH0u4RvQ_eiEugtJuM4'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
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

