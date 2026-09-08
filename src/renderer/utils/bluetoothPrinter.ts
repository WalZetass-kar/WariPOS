/**
 * Bluetooth ESC/POS Thermal Printer Driver for WariPOS (Mobile & Desktop Web)
 * Supports 58mm (32 chars) and 80mm (48 chars) paper sizes.
 */

type AnyBluetooth = any

export interface PrinterDevice {
  id: string
  name: string
  device?: AnyBluetooth
  server?: AnyBluetooth
  characteristic?: AnyBluetooth
}

export interface PrintStrukData {
  namaToko: string
  alamat?: string
  telepon?: string
  kdTransaksi: string
  waktu: string
  kasir: string
  customer?: string
  items: Array<{
    nama: string
    qty: number
    harga: number
    subtotal: number
    catatan?: string
  }>
  totalItem: number
  subtotal: number
  diskon?: number
  pajak?: number
  totalBayar: number
  nominalBayar: number
  kembalian: number
  metodeBayar: string
  pesanHeader?: string
  pesanFooter?: string
  tipeKertas?: '58mm' | '80mm'
  openCashDrawer?: boolean
}

// Common Bluetooth Printer Service and Characteristic UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Custom POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic serial
]

// ESC/POS Commands
const ESC = '\x1B'
const GS = '\x1D'

export const ESC_COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${ESC}!\x10`,
  DOUBLE_WIDTH_ON: `${ESC}!\x20`,
  DOUBLE_ON: `${ESC}!\x30`,
  TEXT_NORMAL: `${ESC}!\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  CUT_PAPER: `${GS}V\x41\x03`,
  DRAWER_KICK: `${ESC}p\x00\x19\xFA`, // Standard cash drawer pulse
}

class BluetoothPrinterService {
  private activeDevice: AnyBluetooth | null = null
  private characteristic: AnyBluetooth | null = null
  private connectedPrinterName: string | null = null

  /**
   * Check if Web Bluetooth is supported in this browser/WebView
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return Boolean(this.activeDevice && this.activeDevice.gatt?.connected && this.characteristic)
  }

  getConnectedPrinterName(): string | null {
    if (!this.isConnected()) return null
    return this.connectedPrinterName || this.activeDevice?.name || 'Thermal Printer'
  }

  /**
   * Scan and connect to a Bluetooth thermal printer
   */
  async connect(): Promise<{ success: boolean; message: string; deviceName?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        message: 'Web Bluetooth belum didukung pada browser/perangkat ini. Pastikan Bluetooth aktif.',
      }
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      })

      if (!device || !device.gatt) {
        return { success: false, message: 'Tidak ada perangkat yang dipilih.' }
      }

      const server = await device.gatt.connect()
      let targetChar: AnyBluetooth | null = null

      // Find suitable printer service & characteristic
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid)
          const chars = await service.getCharacteristics()
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetChar = char
              break
            }
          }
          if (targetChar) break
        } catch {
          // Try next service
        }
      }

      // Fallback: search all primary services if specific service not matched
      if (!targetChar) {
        try {
          const services = await server.getPrimaryServices()
          for (const service of services) {
            try {
              const chars = await service.getCharacteristics()
              for (const char of chars) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                  targetChar = char
                  break
                }
              }
              if (targetChar) break
            } catch {}
          }
        } catch {}
      }

      if (!targetChar) {
        device.gatt.disconnect()
        return {
          success: false,
          message: 'Karakteristik penulisan data printer tidak ditemukan pada perangkat ini.',
        }
      }

      this.activeDevice = device
      this.characteristic = targetChar
      this.connectedPrinterName = device.name || 'Thermal Printer'

      // Save last printer name
      try {
        if (this.connectedPrinterName) {
          localStorage.setItem('zetass_last_bt_printer_name', this.connectedPrinterName)
        }
      } catch {}

      device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null
        this.activeDevice = null
      })

      return {
        success: true,
        message: `Terhubung ke ${this.connectedPrinterName}`,
        deviceName: this.connectedPrinterName || undefined,
      }
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return { success: false, message: 'Pencarian perangkat dibatalkan.' }
      }
      return {
        success: false,
        message: error.message || 'Gagal menyambungkan ke printer Bluetooth.',
      }
    }
  }

  /**
   * Disconnect the current printer
   */
  disconnect() {
    if (this.activeDevice?.gatt?.connected) {
      this.activeDevice.gatt.disconnect()
    }
    this.activeDevice = null
    this.characteristic = null
    this.connectedPrinterName = null
  }

  /**
   * Send raw byte buffer to printer in chunks (max 128 bytes per write)
   */
  async sendRaw(data: Uint8Array): Promise<boolean> {
    if (!this.characteristic) {
      throw new Error('Printer Bluetooth belum terhubung.')
    }

    const CHUNK_SIZE = 128
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE)
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk)
      } else {
        await this.characteristic.writeValue(chunk)
      }
      // Small pause to prevent buffer overflow in small thermal printers
      await new Promise(r => setTimeout(r, 25))
    }
    return true
  }

  /**
   * Print formatted receipt
   */
  async printStruk(data: PrintStrukData): Promise<{ success: boolean; message: string }> {
    if (!this.isConnected()) {
      return {
        success: false,
        message: 'Printer Bluetooth belum terhubung. Sambungkan printer terlebih dahulu.',
      }
    }

    try {
      const paperWidth = data.tipeKertas === '80mm' ? 48 : 32
      const encoder = new TextEncoder()
      let rawText = ''

      // 1. Initialize Printer
      rawText += ESC_COMMANDS.INIT

      // Open Cash Drawer if enabled
      if (data.openCashDrawer) {
        rawText += ESC_COMMANDS.DRAWER_KICK
      }

      // 2. Header (Nama Toko & Alamat)
      rawText += ESC_COMMANDS.ALIGN_CENTER
      rawText += ESC_COMMANDS.BOLD_ON + ESC_COMMANDS.DOUBLE_HEIGHT_ON
      rawText += `${data.namaToko}\n`
      rawText += ESC_COMMANDS.TEXT_NORMAL

      if (data.alamat) {
        rawText += `${data.alamat}\n`
      }
      if (data.telepon) {
        rawText += `Telp: ${data.telepon}\n`
      }
      if (data.pesanHeader) {
        rawText += `${data.pesanHeader}\n`
      }

      // Divider Line
      rawText += `${'-'.repeat(paperWidth)}\n`

      // 3. Metadata Transaksi
      rawText += ESC_COMMANDS.ALIGN_LEFT
      rawText += `No: ${data.kdTransaksi}\n`
      rawText += `Tgl: ${data.waktu}\n`
      rawText += `Kasir: ${data.kasir}\n`
      if (data.customer) {
        rawText += `Cust: ${data.customer}\n`
      }

      rawText += `${'-'.repeat(paperWidth)}\n`

      // 4. Daftar Item
      for (const item of data.items) {
        const itemLine = `${item.nama}\n`
        const priceStr = `${item.qty} x ${item.harga.toLocaleString('id-ID')}`
        const totalStr = item.subtotal.toLocaleString('id-ID')
        const spaceCount = Math.max(1, paperWidth - priceStr.length - totalStr.length)
        const subLine = `  ${priceStr}${' '.repeat(spaceCount - 2)}${totalStr}\n`

        rawText += itemLine + subLine
        if (item.catatan) {
          rawText += `   * ${item.catatan}\n`
        }
      }

      rawText += `${'-'.repeat(paperWidth)}\n`

      // 5. Total & Pembayaran
      const formatRow = (label: string, value: number, isBold = false) => {
        const valStr = `Rp ${value.toLocaleString('id-ID')}`
        const spaces = Math.max(1, paperWidth - label.length - valStr.length)
        const line = `${label}${' '.repeat(spaces)}${valStr}\n`
        return isBold ? `${ESC_COMMANDS.BOLD_ON}${line}${ESC_COMMANDS.BOLD_OFF}` : line
      }

      rawText += formatRow('Subtotal', data.subtotal)
      if (data.diskon && data.diskon > 0) {
        rawText += formatRow('Diskon', -data.diskon)
      }
      if (data.pajak && data.pajak > 0) {
        rawText += formatRow('Pajak', data.pajak)
      }

      rawText += `${'-'.repeat(paperWidth)}\n`
      rawText += formatRow('TOTAL', data.totalBayar, true)
      rawText += formatRow(`Bayar (${data.metodeBayar})`, data.nominalBayar)
      rawText += formatRow('Kembali', data.kembalian)

      rawText += `${'-'.repeat(paperWidth)}\n`

      // 6. Footer
      rawText += ESC_COMMANDS.ALIGN_CENTER
      rawText += `${data.pesanFooter || 'Terima Kasih Atas Kunjungan Anda'}\n`
      rawText += `Simpan struk sebagai bukti pembayaran.\n`

      // 7. Feed & Cut
      rawText += ESC_COMMANDS.FEED_LINES(3)
      rawText += ESC_COMMANDS.CUT_PAPER

      const bytes = encoder.encode(rawText)
      await this.sendRaw(bytes)

      return { success: true, message: 'Struk berhasil dicetak ke printer Bluetooth.' }
    } catch (error: any) {
      return { success: false, message: error.message || 'Gagal mencetak struk ke printer Bluetooth.' }
    }
  }

  /**
   * Test print command
   */
  async testPrint(): Promise<{ success: boolean; message: string }> {
    if (!this.isConnected()) {
      return { success: false, message: 'Printer belum terhubung.' }
    }

    try {
      const encoder = new TextEncoder()
      let testData = ESC_COMMANDS.INIT
      testData += ESC_COMMANDS.ALIGN_CENTER
      testData += `${ESC_COMMANDS.BOLD_ON}=== TEST PRINT WARIPOS ===${ESC_COMMANDS.BOLD_OFF}\n`
      testData += `Printer: ${this.getConnectedPrinterName()}\n`
      testData += `Waktu: ${new Date().toLocaleString('id-ID')}\n`
      testData += `Status: OK - Siap Digunakan\n`
      testData += `--------------------------------\n`
      testData += ESC_COMMANDS.FEED_LINES(3)
      testData += ESC_COMMANDS.CUT_PAPER

      await this.sendRaw(encoder.encode(testData))
      return { success: true, message: 'Test print berhasil dikirim ke printer.' }
    } catch (error: any) {
      return { success: false, message: error.message || 'Gagal mengirim test print.' }
    }
  }
}

export const bluetoothPrinter = new BluetoothPrinterService()
