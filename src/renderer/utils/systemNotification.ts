import { Capacitor } from '@capacitor/core'
import { api } from './api'

export interface NotificationBannerOptions {
  id?: number
  title: string
  body: string
  sound?: string
  actionRoute?: string
}

let channelsCreated = false
let listenersRegistered = false

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { electronAPI?: unknown }).electronAPI)
}

/**
 * Inisialisasi channel notifikasi untuk Android 8+
 */
export async function initNotificationChannels(): Promise<void> {
  if (!isNativeAndroid() || channelsCreated) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: 'waripos_daily',
      name: 'Pengingat Kasir Harian',
      description: 'Notifikasi pengingat pagi untuk membuka kasir dan transaksi',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#4f46e5',
    })

    await LocalNotifications.createChannel({
      id: 'waripos_stock',
      name: 'Peringatan Stok Produk',
      description: 'Notifikasi saat stok produk habis atau menipis',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#ef4444',
    })

    await LocalNotifications.createChannel({
      id: 'waripos_sale',
      name: 'Transaksi Kasir POS',
      description: 'Notifikasi saat transaksi kasir berhasil diproses',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#10b981',
    })

    await LocalNotifications.createChannel({
      id: 'waripos_broadcast',
      name: 'Pengumuman Developer',
      description: 'Notifikasi pesan dan pengumuman dari developer sistem',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#3b82f6',
    })

    channelsCreated = true
  } catch (error) {
    console.warn('[Notification] Failed to create notification channels:', error)
  }
}

/**
 * Minta izin notifikasi ke pengguna jika diperlukan
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const check = await LocalNotifications.checkPermissions()
      if (check.display === 'granted') return true

      const requested = await LocalNotifications.requestPermissions()
      return requested.display === 'granted'
    } catch (error) {
      console.warn('[Notification] Error requesting Android permission:', error)
      return false
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') return true
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission()
        return res === 'granted'
      }
    } catch {}
  }

  return true
}

/**
 * Menampilkan notifikasi banner sistem seketika
 */
export async function showSystemNotification(options: NotificationBannerOptions): Promise<void> {
  const { id = Math.floor(Date.now() % 100000), title, body, actionRoute } = options

  // 1. Android Native via Capacitor LocalNotifications
  if (isNativeAndroid()) {
    try {
      await initNotificationChannels()
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            channelId: id === 1001 ? 'waripos_daily' : 'waripos_stock',
            extra: actionRoute ? { route: actionRoute } : undefined,
          },
        ],
      })
      return
    } catch (error) {
      console.warn('[Notification] Android schedule banner failed:', error)
    }
  }

  // 2. Desktop Electron via IPC
  if (isElectron()) {
    try {
      await api('notification:showBanner', { title, body, silent: false })
      return
    } catch (error) {
      console.warn('[Notification] Desktop IPC showBanner failed:', error)
    }
  }

  // 3. Fallback Web Browser Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new window.Notification(title, {
        body,
        icon: '/app-icon.png',
      })
      if (actionRoute) {
        notif.onclick = () => {
          window.focus()
          window.location.hash = actionRoute
        }
      }
    } catch (error) {
      console.warn('[Notification] Web Notification failed:', error)
    }
  }
}

/**
 * Menjadwalkan pengingat harian pagi (Alarm berulang)
 */
export async function scheduleDailyMorningReminder(
  jamPagi: string = '07:00',
  enabled: boolean = true
): Promise<void> {
  if (!isNativeAndroid()) return

  try {
    await initNotificationChannels()
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Batalkan jadwal lama jika ada
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: 1001 }],
      })
    } catch {}

    if (!enabled) return

    const parts = jamPagi.split(':')
    const hour = parseInt(parts[0] || '7', 10)
    const minute = parseInt(parts[1] || '0', 10)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1001,
          title: 'WariPOS - Pengingat Pagi',
          body: 'Selamat pagi! Buka kasir dan mulai pencatatan transaksi hari ini.',
          channelId: 'waripos_daily',
          schedule: {
            on: {
              hour,
              minute,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          extra: {
            route: '/transaksi',
          },
        },
      ],
    })
  } catch (error) {
    console.warn('[Notification] Failed to schedule morning reminder:', error)
  }
}

/**
 * Notifikasi peringatan stok seketika (habis atau menipis)
 */
export async function showStockBannerAlert(
  productName: string,
  remainingStock: number,
  isOutOfStock: boolean
): Promise<void> {
  const title = isOutOfStock ? 'Peringatan: Stok Habis!' : 'Peringatan: Stok Menipis'
  const body = isOutOfStock
    ? `Produk "${productName}" telah habis (stok: 0). Segera lakukan restock.`
    : `Produk "${productName}" tersisa ${remainingStock}. Segera lakukan pemesanan restock.`

  await showSystemNotification({
    id: Math.floor(Math.random() * 90000) + 1000,
    title,
    body,
    actionRoute: '/produk',
  })
}

/**
 * Setup listener saat banner notifikasi diklik oleh pengguna
 */
export async function setupNotificationClickListeners(
  navigate?: (route: string) => void
): Promise<void> {
  if (!isNativeAndroid() || listenersRegistered) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const targetRoute = action?.notification?.extra?.route
      if (targetRoute && typeof navigate === 'function') {
        navigate(targetRoute)
      } else if (targetRoute && typeof window !== 'undefined') {
        window.location.hash = targetRoute
      }
    })
    listenersRegistered = true
  } catch (error) {
    console.warn('[Notification] Failed to setup notification click listener:', error)
  }
}

/**
 * Notifikasi banner saat transaksi kasir berhasil diselesaikan
 */
export async function showSaleSuccessNotification(
  kdTransaksi: string,
  total: number,
  jenisBayar: string = 'TUNAI'
): Promise<void> {
  try {
    const res = await api<{ notif_banner_system?: boolean; notif_transaksi_berhasil?: boolean }>('notifSettings:get')
    if (res.success && res.data) {
      if (res.data.notif_banner_system === false) return
      if (res.data.notif_transaksi_berhasil === false) return
    }

    const { formatRupiah } = await import('./format')
    await showSystemNotification({
      id: Math.floor(Math.random() * 90000) + 1000,
      title: 'Transaksi Kasir Berhasil',
      body: `Nota: ${kdTransaksi} • Total: ${formatRupiah(total)} (${jenisBayar})`,
      actionRoute: '/riwayat',
    })
  } catch (error) {
    console.warn('[Notification] showSaleSuccessNotification failed:', error)
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Memeriksa pengumuman / pesan baru dari developer dan menampilkan banner notifikasi OS jika belum pernah dilihat
 */
export async function checkAndShowDeveloperAnnouncements(): Promise<void> {
  try {
    const res = await api<Array<{ id: string | number; title: string; message: string; type?: string; severity?: string; is_active?: boolean }>>('license:getAnnouncements')
    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) return

    const seenKey = 'waripos_seen_announcements'
    const seenRaw = localStorage.getItem(seenKey)
    let seenIds: string[] = []
    try {
      seenIds = seenRaw ? JSON.parse(seenRaw) : []
    } catch {}

    const unseen = res.data.filter(item => {
      const idStr = String(item.id)
      return item.is_active !== false && !seenIds.includes(idStr)
    })

    for (const ann of unseen) {
      const idStr = String(ann.id)
      seenIds.push(idStr)
      localStorage.setItem(seenKey, JSON.stringify(seenIds))

      // Trigger OS banner notification
      const numericId = 9000 + (hashString(idStr) % 900)
      await showSystemNotification({
        id: numericId,
        title: ann.title || 'Pengumuman Developer',
        body: ann.message,
        actionRoute: '/lisensi',
      })
    }
  } catch (error) {
    console.warn('[Notification] Failed to check developer announcements:', error)
  }
}
