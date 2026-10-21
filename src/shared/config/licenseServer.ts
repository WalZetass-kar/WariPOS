/**
 * Konfigurasi server lisensi dan Supabase.
 *
 * Nilai diambil dari environment build, tidak ada credential yang ditulis di
 * dalam kode sumber. Environment yang dipakai:
 *
 * - VITE_LICENSE_SERVER_URL  URL endpoint license server
 * - VITE_SUPABASE_URL        URL project Supabase
 * - VITE_SUPABASE_ANON_KEY   kunci publik Supabase
 */

function readEnv(key: string): string {
  const fromVite = typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.[key]
    : undefined
  if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim()

  const fromProcess = typeof process !== 'undefined'
    ? (process as any).env?.[key]
    : undefined
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim()

  return ''
}

export function getSupabaseUrl(): string {
  return readEnv('VITE_SUPABASE_URL')
}

export function getSupabaseAnonKey(): string {
  return readEnv('VITE_SUPABASE_ANON_KEY')
}

export function getLicenseServerUrl(): string {
  return readEnv('VITE_LICENSE_SERVER_URL')
}

export function isCloudLicenseConfigured(): boolean {
  return Boolean(getLicenseServerUrl() && getSupabaseAnonKey())
}
