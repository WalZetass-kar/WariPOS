import https from 'https'

interface WhatsAppMessage {
  to: string // Phone number with country code (e.g., 628123456789)
  message: string
  countryCode?: string
  connectOnly?: boolean
  typing?: boolean
}

export interface WhatsAppSendResult {
  success: boolean
  message?: string
  detail?: string
  requestId?: number
  target?: string[]
}

interface FonnteResponse {
  status?: boolean
  Status?: boolean
  reason?: string
  detail?: string
  requestid?: number
  target?: string[]
  process?: string
}

const DEFAULT_COUNTRY_CODE = '62'
const REQUEST_TIMEOUT_MS = 30000

export function normalizeWhatsAppNumber(phone: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const raw = String(phone ?? '').trim()
  if (!raw) return ''

  if (raw.endsWith('@g.us')) {
    return raw.replace(/\s/g, '')
  }

  let cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2)
  if (cleaned.startsWith('0')) cleaned = `${countryCode}${cleaned.slice(1)}`
  if (countryCode === DEFAULT_COUNTRY_CODE && cleaned.startsWith('8')) cleaned = `${countryCode}${cleaned}`

  return cleaned
}

export function isValidWhatsAppTarget(target: string): boolean {
  if (target.endsWith('@g.us')) {
    return /^[\d-]+@g\.us$/.test(target)
  }
  return /^\d{10,15}$/.test(target)
}

export function buildFonntePayload(data: WhatsAppMessage): URLSearchParams {
  const target = normalizeWhatsAppNumber(data.to, data.countryCode ?? DEFAULT_COUNTRY_CODE)
  if (!isValidWhatsAppTarget(target)) {
    throw new Error('Nomor WhatsApp tidak valid. Gunakan format 08..., 628..., atau +628...')
  }

  const message = String(data.message ?? '').trim()
  if (!message) {
    throw new Error('Pesan WhatsApp tidak boleh kosong')
  }

  const params = new URLSearchParams()
  params.set('target', target)
  params.set('message', message)
  params.set('countryCode', data.countryCode ?? DEFAULT_COUNTRY_CODE)
  params.set('typing', data.typing ? 'true' : 'false')
  params.set('connectOnly', data.connectOnly === false ? 'false' : 'true')
  return params
}

function parseFonnteResponse(body: string): FonnteResponse | null {
  try {
    return JSON.parse(body) as FonnteResponse
  } catch {
    return null
  }
}

function normalizeFonnteError(reason: string): string {
  const normalized = reason.toLowerCase()
  if (normalized.includes('token invalid') || normalized.includes('invalid token')) return 'Token/API key Fonnte tidak valid'
  if (normalized.includes('device disconnected')) return 'Device WhatsApp Fonnte belum terhubung'
  if (normalized.includes('target invalid')) return 'Nomor tujuan WhatsApp tidak valid'
  if (normalized.includes('target required')) return 'Nomor tujuan WhatsApp wajib diisi'
  if (normalized.includes('insufficient quota')) return 'Kuota pesan Fonnte tidak mencukupi'
  if (normalized.includes('input invalid')) return 'Format data WhatsApp tidak valid'
  return reason || 'Gagal mengirim pesan WhatsApp'
}

export class WhatsAppService {
  private static apiKey: string = ''
  private static apiUrl: string = 'https://api.fonnte.com/send'

  /**
   * Initialize WhatsApp service
   */
  static init(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Send WhatsApp message
   */
  static async sendMessage(data: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const apiKey = this.apiKey.trim()
    if (!apiKey) {
      return { success: false, message: 'API key WhatsApp belum dikonfigurasi' }
    }

    let postData: string
    try {
      postData = buildFonntePayload(data).toString()
    } catch (error) {
      return { success: false, message: (error as Error).message }
    }

    return new Promise((resolve) => {
      const options = {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'application/json',
        },
      }

      const req = https.request(this.apiUrl, options, (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          const response = parseFonnteResponse(body)
          if (!response) {
            resolve({ success: false, message: body || `Fonnte mengembalikan respon tidak valid (${res.statusCode ?? 'unknown'})` })
            return
          }

          const status = response.status === true || response.Status === true
          if (status) {
            resolve({
              success: true,
              message: response.detail || 'Pesan WhatsApp masuk antrean Fonnte',
              detail: response.process,
              requestId: response.requestid,
              target: response.target,
            })
            return
          }

          resolve({
            success: false,
            message: normalizeFonnteError(response.reason || response.detail || `HTTP ${res.statusCode ?? 'unknown'}`),
            requestId: response.requestid,
            target: response.target,
          })
        })
      })

      req.on('error', (error) => {
        resolve({ success: false, message: error.message })
      })

      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error('Koneksi ke Fonnte timeout'))
      })

      req.write(postData)
      req.end()
    })
  }

  /**
   * Send transaction receipt
   */
  static async sendReceipt(phone: string, data: {
    storeName: string
    transactionId: string
    date: string
    items: Array<{ name: string; qty: number; price: number }>
    total: number
    payment: string
  }) {
    const itemsList = data.items.map(item => 
      `• ${item.name} (${item.qty}x) - Rp ${item.price.toLocaleString()}`
    ).join('\n')

    const message = `
*${data.storeName}*
Struk Pembelian

No. Transaksi: ${data.transactionId}
Tanggal: ${data.date}

*Daftar Belanja:*
${itemsList}

*Total: Rp ${data.total.toLocaleString()}*
Pembayaran: ${data.payment}

Terima kasih atas kunjungan Anda! 
    `.trim()

    return this.sendMessage({ to: phone, message })
  }

  /**
   * Send low stock alert
   */
  static async sendLowStockAlert(phone: string, products: Array<{ name: string; stock: number }>) {
    const productList = products.map(p => `• ${p.name} (Stok: ${p.stock})`).join('\n')
    
    const message = `
*PERINGATAN STOK MENIPIS*

Produk berikut memerlukan restock:
${productList}

Segera lakukan pemesanan untuk menghindari kehabisan stok.
    `.trim()

    return this.sendMessage({ to: phone, message })
  }

  /**
   * Send payment reminder
   */
  static async sendPaymentReminder(phone: string, data: {
    customerName: string
    amount: number
    dueDate: string
    invoiceNumber: string
  }) {
    const message = `
Halo ${data.customerName},

Ini adalah pengingat pembayaran untuk:
Invoice: ${data.invoiceNumber}
Jumlah: Rp ${data.amount.toLocaleString()}
Jatuh Tempo: ${data.dueDate}

Mohon segera melakukan pembayaran. Terima kasih! 
    `.trim()

    return this.sendMessage({ to: phone, message })
  }

  /**
   * Send promo notification
   */
  static async sendPromo(phone: string, data: {
    customerName: string
    promoTitle: string
    promoDescription: string
    validUntil: string
  }) {
    const message = `
 *PROMO SPESIAL* 

Halo ${data.customerName}!

${data.promoTitle}
${data.promoDescription}

Berlaku hingga: ${data.validUntil}

Jangan lewatkan kesempatan ini! 
    `.trim()

    return this.sendMessage({ to: phone, message })
  }
}
