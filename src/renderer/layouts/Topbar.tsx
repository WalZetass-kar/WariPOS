import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Bell, Menu, ChevronRight, Home, Check, CheckCheck, Trash2, Crown, Clock, Wifi, WifiOff, LogOut, Settings as SettingsIcon, Store, UtensilsCrossed, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useAppStore } from '../stores'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { api } from '../utils/api'
import { isDemoMode } from '../utils/demo'
import type { Identitas, Notifikasi } from '../../shared/types'

const ROUTE_MAP: Record<string, { label: string; parent?: string }> = {
  '/': { label: 'Dashboard' },
  '/owner-dashboard': { label: 'Dashboard Owner', parent: 'Utama' },
  '/assistant': { label: 'WariAI', parent: 'Utama' },
  '/transaksi': { label: 'Kasir', parent: 'Transaksi' },
  '/riwayat': { label: 'Riwayat', parent: 'Transaksi' },
  '/produk': { label: 'Produk', parent: 'Inventaris' },
  '/kategori': { label: 'Kategori', parent: 'Inventaris' },
  '/satuan': { label: 'Satuan', parent: 'Inventaris' },
  '/supplier': { label: 'Supplier', parent: 'Relasi' },
  '/customer': { label: 'Customer', parent: 'Relasi' },
  '/kas': { label: 'Kas', parent: 'Keuangan' },
  '/accounting': { label: 'Akuntansi', parent: 'Keuangan' },
  '/shifts': { label: 'Shift Kasir', parent: 'Kasir & Penjualan' },
  '/debts': { label: 'Hutang/Piutang', parent: 'Keuangan' },
  '/returns': { label: 'Return', parent: 'Keuangan' },
  '/laporan': { label: 'Laporan', parent: 'Keuangan' },
  '/users': { label: 'Pengguna', parent: 'Administrasi' },
  '/license-admin': { label: 'Developer Panel', parent: 'Administrasi' },
  '/payment': { label: 'Status & Langganan', parent: 'Keuangan' },
  '/subscription': { label: 'Status & Langganan', parent: 'Keuangan' },
  '/my-subscription': { label: 'Status & Langganan', parent: 'Keuangan' },
  '/activity-log': { label: 'Activity Log', parent: 'Administrasi' },
  '/security': { label: 'Keamanan', parent: 'Administrasi' },
  '/ecommerce-api': { label: 'E-commerce API', parent: 'Administrasi' },
  '/marketplace': { label: 'Marketplace', parent: 'Administrasi' },
  '/settings': { label: 'Pengaturan', parent: 'Administrasi' },
  '/pembelian': { label: 'Pembelian', parent: 'Inventaris' },
  '/stock-opname': { label: 'Stok Opname', parent: 'Inventaris' },
  '/backup': { label: 'Backup', parent: 'Administrasi' },
  '/tutorials': { label: 'Tutorial', parent: 'Alat Bantu' },
  '/hpp': { label: 'Kalkulator HPP', parent: 'Alat Bantu' },
  '/promo': { label: 'Promo', parent: 'Keuangan' },
  '/branch': { label: 'Cabang/Gudang', parent: 'Inventaris' },
  '/loyalty': { label: 'Loyalty', parent: 'Relasi' },
  '/whatsapp': { label: 'WhatsApp', parent: 'Alat Bantu' },
  '/print-queue': { label: 'Antrian Print', parent: 'Alat Bantu' },
  '/payment-automation': { label: 'Pembayaran Digital', parent: 'Keuangan' },
  '/customer-display-page': { label: 'Display & Antrian', parent: 'Utama' },
  '/queue-display': { label: 'Layar TV Antrian', parent: 'Utama' },
  '/daily-notes': { label: 'Daily Notes', parent: 'Utama' },
  '/price-list': { label: 'Price List', parent: 'Inventaris' },
  '/stock-history': { label: 'Riwayat Stok', parent: 'Inventaris' },
  '/supplier-rating': { label: 'Supplier Rating', parent: 'Inventaris' },
  '/membership-card': { label: 'Membership Card', parent: 'Relasi' },
  '/sales-commission': { label: 'Komisi Sales', parent: 'Relasi' },
  '/tax-report': { label: 'Laporan Pajak', parent: 'Keuangan' },
  '/petty-cash': { label: 'Petty Cash', parent: 'Keuangan' },
  '/cash-flow': { label: 'Arus Kas', parent: 'Keuangan' },
  '/label-print': { label: 'Label Cetak', parent: 'Alat Bantu' },
  '/notification-settings': { label: 'Notifikasi', parent: 'Alat Bantu' },
  '/integrations': { label: 'Integrasi', parent: 'Alat Bantu' },
  '/audit-trail': { label: 'Audit Trail', parent: 'Administrasi' },
  // New Feature Routes
  '/employee': { label: 'Karyawan', parent: 'SDM & HR' },
  '/employee-contract': { label: 'Kontrak Karyawan', parent: 'SDM & HR' },
  '/attendance': { label: 'Absensi', parent: 'SDM & HR' },
  '/payroll': { label: 'Penggajian', parent: 'SDM & HR' },
  '/tip-pooling': { label: 'Tip Pooling', parent: 'SDM & HR' },
  '/shift-schedule': { label: 'Jadwal Shift', parent: 'SDM & HR' },
  '/kitchen-display': { label: 'KDS Dapur', parent: 'F&B' },
  '/table-management': { label: 'Meja & Layout', parent: 'F&B' },
  '/reservation': { label: 'Reservasi', parent: 'F&B' },
  '/recipe': { label: 'Resep & BOM', parent: 'Inventaris' },
  '/delivery': { label: 'Pengiriman', parent: 'Logistik' },
  '/bank-account': { label: 'Rekening Bank', parent: 'Keuangan' },
  '/fixed-asset': { label: 'Aset Tetap', parent: 'Keuangan' },
  '/budget': { label: 'Anggaran', parent: 'Keuangan' },
  '/gift-card': { label: 'Gift Card', parent: 'Marketing' },
  '/customer-feedback': { label: 'Feedback', parent: 'Marketing' },
  '/campaign': { label: 'Kampanye', parent: 'Marketing' },
  '/storefront': { label: 'Toko Online', parent: 'Marketing' },
}

const JENIS_COLOR: Record<string, string> = {
  STOK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SYSTEM: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  INFO: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { mode, isDark, toggleMode } = useTheme()
  const { user } = useAuth()
  const { posMode, setPosMode } = useAppStore()
  const { isOnline } = useNetworkStatus()
  const [storeName, setStoreName] = useState('WariPOS')
  const [notifs, setNotifs] = useState<Notifikasi[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<Identitas>('identitas:get').then(r => {
      if (r.success && r.data?.namatoko) setStoreName(r.data.namatoko)
    })
    loadNotifs()

    // Smart polling: 90s interval, pauses when tab not visible
    let interval: ReturnType<typeof setInterval>
    const startPolling = () => {
      interval = setInterval(() => {
        if (!document.hidden && user?.nama_pengguna) loadNotifs()
      }, 90000)
    }
    startPolling()

    const handleVisibility = () => {
      if (!document.hidden && user?.nama_pengguna) loadNotifs()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.nama_pengguna])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadNotifs = async () => {
    const [r1, r2] = await Promise.all([
      api<Notifikasi[]>('notifikasi:getAll', user?.nama_pengguna),
      api<{ count: number }>('notifikasi:getUnreadCount', user?.nama_pengguna),
    ])
    if (r1.success) setNotifs(r1.data ?? [])
    if (r2.success) setUnreadCount(r2.data?.count ?? 0)
  }

  const markRead = async (kd: number) => {
    await api('notifikasi:markAsRead', kd)
    loadNotifs()
  }

  const markAllRead = async () => {
    await api('notifikasi:markAllAsRead', user?.nama_pengguna)
    loadNotifs()
  }

  const deleteNotif = async (kd: number) => {
    await api('notifikasi:delete', kd)
    loadNotifs()
  }

  const normalizedPath = pathname.replace(/^\/app(?=\/|$)/, '') || '/'
  const route = ROUTE_MAP[normalizedPath]
  const pageLabel = route?.label ?? 'WariPOS'
  const parentLabel = route?.parent

  const initials = (user?.nama_lengkap ?? user?.nama_pengguna ?? 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="h-14 glass border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-3 sm:px-6 shrink-0 relative z-30">
      {/* Kiri: Hamburger Menu + Page Title */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          className="lg:hidden w-11 h-11 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0 flex items-center justify-center"
          title="Buka menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center min-w-0">
          <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight truncate">
            {pageLabel}
          </span>
        </div>
      </div>

      {/* Kanan: Desktop Full Icons, Mobile Clean Avatar [MI] */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{storeName}</span>
        </div>

        {/* Plan & Subscription Badge (Desktop) */}
        {isDemoMode() ? (
          <button
            onClick={() => navigate('/payment')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md shadow-orange-500/20 animate-pulse hover:opacity-90 transition"
            title="Klik untuk lihat status langganan & upgrade"
          >
            DEMO
          </button>
        ) : user?.subscription_plan_name ? (
          <button
            onClick={() => navigate('/payment')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition"
            title="Status Langganan Aktif - Klik untuk detail"
          >
            <Crown size={13} className="text-violet-500" />
            <span className="truncate max-w-[120px]">{user.subscription_plan_name}</span>
          </button>
        ) : null}

        {/* Mode Operasional Bisnis Quick Switcher (Desktop) */}
        <button
          type="button"
          onClick={() => setPosMode(posMode === 'retail' ? 'restaurant' : 'retail')}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            posMode === 'restaurant'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shadow-xs'
              : 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 shadow-xs'
          }`}
          title={posMode === 'retail' ? 'Mode Toko Retail aktif. Klik untuk beralih ke Mode Restoran F&B.' : 'Mode Restoran F&B aktif. Klik untuk beralih ke Mode Toko Retail.'}
        >
          {posMode === 'restaurant' ? <UtensilsCrossed size={14} className="text-amber-500" /> : <Store size={14} className="text-primary-500" />}
          <span>{posMode === 'restaurant' ? 'Resto F&B' : 'Mode Toko'}</span>
        </button>

        {/* Shift Kasir Shortcut (Desktop) */}
        <button
          type="button"
          onClick={() => navigate('/shifts')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
          title="Buka / Tutup Shift Kasir"
        >
          <Clock size={15} className="text-primary-600 dark:text-primary-400" />
          <span>Shift</span>
        </button>

        {/* Status Jaringan (Desktop) */}
        <span
          className={`hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold ${
            isOnline
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
          }`}
          title={isOnline ? 'Online — tersinkron dengan lisensi & developer' : 'Offline — data tersimpan di perangkat, akan disinkronkan saat online'}
        >
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </span>

        {/* Dark Mode Toggle (Desktop) */}
        <button onClick={toggleMode} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="hidden sm:flex p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" title={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification Bell (Desktop) */}
        <div ref={notifRef} className="relative hidden sm:block">
          <button
            onClick={() => setShowNotif(v => !v)}
            aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Centered Modal Backdrop & Dialog */}
          {showNotif && (
            <>
              {/* Thin Transparent Backdrop Overlay */}
              <div
                className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-[1px] transition-opacity"
                onClick={() => setShowNotif(false)}
                aria-hidden="true"
              />

              {/* Centered Modal Card */}
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="notif-dialog-title"
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[88vw] max-w-[400px] max-h-[82vh] flex flex-col bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/20 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 id="notif-dialog-title" className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Notifikasi
                    </h3>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5 leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-semibold flex items-center gap-1 mr-1"
                      >
                        <CheckCheck size={13} />
                        <span>Tandai semua</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotif(false)}
                      aria-label="Tutup notifikasi"
                      className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="overflow-y-auto max-h-[60vh] overscroll-contain">
                  {notifs.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-3">
                        <Bell size={24} className="opacity-40 text-slate-500 dark:text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tidak ada notifikasi</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Semua info dan stok aman terkendali</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifs.slice(0, 30).map(n => (
                        <div
                          key={n.kd_notifikasi}
                          className={`flex gap-3 px-4 py-3 transition-colors ${
                            !n.dibaca
                              ? 'bg-primary-50/40 dark:bg-primary-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${JENIS_COLOR[n.jenis] ?? JENIS_COLOR.INFO}`}>
                                {n.jenis}
                              </span>
                              {!n.dibaca && <span className="w-1.5 h-1.5 bg-primary-600 rounded-full shrink-0" />}
                            </div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">
                              {n.judul}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words leading-relaxed">
                              {n.pesan}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                              {new Date(n.tgl_dibuat).toLocaleString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                            {!n.dibaca && (
                              <button
                                type="button"
                                onClick={() => markRead(n.kd_notifikasi)}
                                className="p-1 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-600 dark:text-primary-400 transition-colors"
                                title="Tandai dibaca"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteNotif(n.kd_notifikasi)}
                              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(v => !v)}
            aria-label="Menu profil dan akun"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none active:scale-95"
            title={`Profil: ${user?.nama_lengkap ?? user?.nama_pengguna ?? ''}`}
          >
            <div className="relative w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
              {user?.foto ? (
                <img src={user.foto} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
              {unreadCount > 0 && (
                <span className="sm:hidden absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </div>
          </button>

          {showProfileMenu && (
            <div className="fixed right-3 top-16 sm:absolute sm:right-0 sm:top-12 z-50 w-64 bg-white dark:bg-slate-900 shadow-xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 p-2.5 dropdown-popover-animate">
              {/* Header Profil */}
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.nama_lengkap || user?.nama_pengguna || 'Pengguna'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-slate-400 truncate">@{user?.nama_pengguna}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 uppercase">
                    {user?.hak_akses ?? 'kasir'}
                  </span>
                </div>
                {/* Store Name on Mobile */}
                <p className="sm:hidden text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {storeName}
                </p>
              </div>

              {/* Mobile Quick Action Strip */}
              <div className="sm:hidden grid grid-cols-3 gap-1.5 py-2 border-b border-slate-100 dark:border-slate-800">
                {/* 1. Status Jaringan */}
                <div
                  className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-[10px] font-bold ${
                    isOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/40'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-900/40'
                  }`}
                  title={isOnline ? 'Perangkat Online' : 'Perangkat Offline'}
                >
                  {isOnline ? <Wifi size={14} className="mb-0.5 text-emerald-600" /> : <WifiOff size={14} className="mb-0.5 text-amber-600" />}
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>

                {/* 2. Toggle Mode Gelap / Terang */}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold transition-colors"
                  title="Ganti Tema"
                >
                  {isDark ? <Sun size={14} className="mb-0.5 text-amber-500" /> : <Moon size={14} className="mb-0.5 text-slate-600" />}
                  <span>{isDark ? 'Terang' : 'Gelap'}</span>
                </button>

                {/* 3. Notifikasi Mobile */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false)
                    setShowNotif(true)
                  }}
                  className="relative flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold transition-colors"
                  title="Lihat Notifikasi"
                >
                  <Bell size={14} className="mb-0.5 text-slate-600 dark:text-slate-300" />
                  <span>Notif</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Menu Links */}
              <div className="py-1 space-y-0.5">
                {/* Mobile: Mode Toko/Resto switcher */}
                <button
                  type="button"
                  onClick={() => {
                    setPosMode(posMode === 'retail' ? 'restaurant' : 'retail')
                  }}
                  className="sm:hidden w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {posMode === 'restaurant' ? <UtensilsCrossed size={15} className="text-amber-500" /> : <Store size={15} className="text-primary-600" />}
                    <span>Mode Operasional</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {posMode === 'restaurant' ? 'Resto F&B' : 'Retail'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/shifts')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Clock size={15} className="text-slate-400" />
                  <span>Shift Kasir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/settings?category=akun')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <SettingsIcon size={15} className="text-slate-400" />
                  <span>Pengaturan Akun</span>
                </button>

                <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false)
                      window.dispatchEvent(new CustomEvent('auth:request-logout'))
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
                  >
                    <LogOut size={15} className="text-rose-500" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
