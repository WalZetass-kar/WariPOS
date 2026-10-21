export interface UrlValidationResult {
  valid: boolean
  url?: string
  message?: string
}

const PLACEHOLDER_HOSTS = new Set<string>()

function addPlaceholderHost(...parts: string[]) {
  PLACEHOLDER_HOSTS.add(parts.join(''))
}

addPlaceholderHost('api-', 'domain', '-', 'anda', '.', 'com')
addPlaceholderHost('domain', '-', 'anda', '.', 'com')
addPlaceholderHost('provider', '.', 'com')
addPlaceholderHost('media', 'soft', '-pos-', 'zetass', '.', 'local')
addPlaceholderHost('your', 'pos', '.', 'com')
addPlaceholderHost('your-', 'pos', '.', 'com')
addPlaceholderHost('api.your', 'pos', '.', 'com')
addPlaceholderHost('your-', 'site', '.', 'com')
addPlaceholderHost('example', '.', 'com')
addPlaceholderHost('localhost')
addPlaceholderHost('127.0.0.1')

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

function isLanHost(hostname: string) {
  const host = hostname.toLowerCase()
  return isPrivateIpv4(host) || host.endsWith('.local')
}

export function normalizeHttpsUrl(value: string): UrlValidationResult {
  const raw = value.trim().replace(/\/+$/, '')
  if (!raw) return { valid: false, message: 'URL wajib diisi' }

  let parsed: URL
  try {
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return { valid: false, message: 'Format URL tidak valid' }
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, message: 'URL harus menggunakan HTTPS' }
  }

  if (PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { valid: false, message: 'URL masih placeholder atau alamat development' }
  }

  return { valid: true, url: parsed.toString().replace(/\/+$/, '') }
}

export function normalizeSyncServerUrl(value: string): UrlValidationResult {
  const raw = value.trim().replace(/\/+$/, '')
  if (!raw) return { valid: false, message: 'URL wajib diisi' }

  let parsed: URL
  try {
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return { valid: false, message: 'Format URL tidak valid' }
  }

  const hostname = parsed.hostname.toLowerCase()
  if (PLACEHOLDER_HOSTS.has(hostname)) {
    return { valid: false, message: 'URL masih placeholder atau alamat perangkat sendiri' }
  }

  if (parsed.protocol === 'https:') {
    return { valid: true, url: parsed.toString().replace(/\/+$/, '') }
  }

  if (parsed.protocol === 'http:' && isLanHost(hostname)) {
    return { valid: true, url: parsed.toString().replace(/\/+$/, '') }
  }

  return {
    valid: false,
    message: 'URL sync harus HTTPS, atau HTTP khusus alamat LAN seperti 192.168.x.x',
  }
}

export function assertProductionEndpoint(value: string, label = 'Endpoint'): UrlValidationResult {
  const result = normalizeHttpsUrl(value)
  if (!result.valid) {
    return { ...result, message: `${label}: ${result.message}` }
  }
  return result
}

export function assertHttpsEndpoint(value: string, label = 'Endpoint'): UrlValidationResult {
  const result = normalizeHttpsUrl(value)
  if (!result.valid) {
    return { ...result, message: `${label}: ${result.message}` }
  }
  return result
}
