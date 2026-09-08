export const SUBSCRIPTION_UPGRADE_WA_NUMBER = '08988098238'
const STORAGE_SUPPORT_WA_KEY = 'zetass_support_wa_number'

export function getSupportWaNumber(): string {
  try {
    const saved = localStorage.getItem(STORAGE_SUPPORT_WA_KEY)
    if (saved && saved.trim()) return saved.trim()
  } catch {}
  return SUBSCRIPTION_UPGRADE_WA_NUMBER
}

export function setSupportWaNumber(phone: string): void {
  try {
    localStorage.setItem(STORAGE_SUPPORT_WA_KEY, phone.trim())
  } catch {}
}

/** Fallback WhatsApp number if a custom number is missing or invalid. */
const FALLBACK_WA_NUMBER = SUBSCRIPTION_UPGRADE_WA_NUMBER

/**
 * Normalize a phone number to international format (without +).
 * Handles common Indonesian formats:
 *   08xxx → 628xxx
 *   +628xxx → 628xxx
 *   628xxx → 628xxx (unchanged)
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  // Convert local format to international
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  return cleaned
}

function isValidPhoneNumber(phone: string): boolean {
  return phone.length >= 10 && /^\d+$/.test(phone)
}

export interface WhatsAppUpgradeParams {
  /** Owner/admin phone number (will be normalized) */
  phone?: string | null
  /** Selected plan name (e.g., "Bulanan") */
  planName: string
  /** Plan price formatted (e.g., "Rp 299.000") */
  planPrice: string
  /** Plan period (e.g., "/bulan") */
  planPeriod: string
  /** Demo user's display name */
  userName: string
  /** Store/business name (from Identitas) */
  storeName?: string | null
  /** User's email (optional) */
  email?: string | null
}

function openExternalUrl(url: string): void {
  if (window.api?.invoke) {
    window.api.invoke('app:openExternal', url)
      .then(result => {
        const response = result as { success?: boolean } | undefined
        if (response?.success === false) {
          window.location.href = url
        }
      })
      .catch(() => {
        window.location.href = url
      })
    return
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.href = url
  }
}

/**
 * Build a pre-filled WhatsApp message for upgrade intent.
 * Structured for easy parsing by the admin.
 */
export function buildUpgradeMessage(params: WhatsAppUpgradeParams): string {
  const lines: string[] = [
    `Halo Admin, saya ingin upgrade paket WariPOS`,
    ``,
    `*Detail Pesanan:*`,
    `• Paket: *${params.planName}* (${params.planPrice}${params.planPeriod})`,
    `• Nama: ${params.userName}`,
  ]

  if (params.storeName) {
    lines.push(`• Toko: ${params.storeName}`)
  }
  if (params.email) {
    lines.push(`• Email: ${params.email}`)
  }

  lines.push(
    ``,
    `Mohon info cara pembayaran dan aktivasinya. Terima kasih!`,
  )

  return lines.join('\n')
}

/**
 * Open WhatsApp with a pre-filled upgrade message.
 * Works on both desktop (wa.me redirect) and mobile (WhatsApp app).
 *
 * @returns true if successfully opened, false if number is invalid
 */
export function openWhatsAppUpgrade(params: WhatsAppUpgradeParams): boolean {
  const phone = normalizePhoneNumber(params.phone || '')
  const fallbackPhone = normalizePhoneNumber(getSupportWaNumber())
  const targetPhone = isValidPhoneNumber(phone) ? phone : fallbackPhone

  // Basic validation
  if (!isValidPhoneNumber(targetPhone)) {
    console.error('[WhatsApp] Invalid phone number:', targetPhone)
    return false
  }

  const message = buildUpgradeMessage(params)
  const encodedMessage = encodeURIComponent(message)
  const url = `https://wa.me/${targetPhone}?text=${encodedMessage}`

  openExternalUrl(url)
  return true
}

/**
 * Open WhatsApp with a custom message (generic helper).
 */
export function openWhatsApp(phone: string, message: string): void {
  const normalized = normalizePhoneNumber(phone)
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
  openExternalUrl(url)
}
