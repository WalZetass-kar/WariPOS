import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Bell, Menu, ChevronRight, Home, Check, CheckCheck, Trash2, Crown, Clock, Wifi, WifiOff, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { api } from '../utils/api'
import { isDemoMode } from '../utils/demo'
import type { Identitas, Notifikasi } from '../../shared/types'

const ROUTE_MAP: Record<string, { label: string; parent?: string }> = {
  '/': { label: 'Dashboard' },
  '/owner-dashboard': { label: 'Dashboard Owner', parent: 'Utama' },
  '/assistant': { label: 'Asisten AI', parent: 'Utama' },
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
  const { mode, toggleMode } = useTheme()
  const { user } = useAuth()
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
    <header className="h-14 glass border-b border-white/30 dark:border-slate-700/30 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} aria-label="Buka menu navigasi" className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0" title="Buka menu">
          <Menu size={20} />
        </button>
        <nav className="flex items-center gap-1 text-sm min-w-0">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary-500 transition-colors shrink-0" title="Dashboard">
            <Home size={14} />
          </button>
          {parentLabel && (
            <>
              <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline truncate">{parentLabel}</span>
            </>
          )}
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{pageLabel}</span>
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{storeName}</span>
        </div>

        {/* Plan & Subscription Badge */}
        {isDemoMode() ? (
          <button
            onClick={() => navigate('/payment')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md shadow-orange-500/20 animate-pulse hover:opacity-90 transition"
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

        {/* Shift Kasir Shortcut */}
        <button
          type="button"
          onClick={() => navigate('/shifts')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
          title="Buka / Tutup Shift Kasir"
        >
          <Clock size={15} className="text-primary-600 dark:text-primary-400" />
          <span className="hidden sm:inline">Shift</span>
        </button>

        <span
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold ${
            isOnline
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
          }`}
          title={isOnline ? 'Online — tersinkron dengan lisensi & developer' : 'Offline — data tersimpan di perangkat, akan disinkronkan saat online'}
        >
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </span>

        <button onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" title="Toggle dark mode">
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
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

          {/* Dropdown */}
          {showNotif && (
            <div className="fixed left-1/2 top-16 z-50 w-[min(calc(100vw-2rem),360px)] -translate-x-1/2 glass-card shadow-2xl rounded-2xl overflow-hidden border border-white/40 dark:border-slate-700/40 dropdown-popover-animate">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                  Notifikasi {unreadCount > 0 && <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{unreadCount}</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
                    <CheckCheck size={12} /> Tandai semua
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    Tidak ada notifikasi
                  </div>
                ) : (
                  notifs.slice(0, 20).map(n => (
                    <div key={n.kd_notifikasi} className={`flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 transition-colors ${!n.dibaca ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${JENIS_COLOR[n.jenis] ?? JENIS_COLOR.INFO}`}>
                            {n.jenis}
                          </span>
                          {!n.dibaca && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0" />}
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{n.judul}</p>
                        <p className="text-xs text-slate-400 truncate">{n.pesan}</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                          {new Date(n.tgl_dibuat).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!n.dibaca && (
                          <button onClick={() => markRead(n.kd_notifikasi)} className="p-1 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-500" title="Tandai dibaca">
                            <Check size={12} />
                          </button>
                        )}
                        <button onClick={() => deleteNotif(n.kd_notifikasi)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400" title="Hapus">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(v => !v)}
            aria-label="Menu profil dan akun"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-400 flex items-center justify-center text-white text-xs font-bold ml-1 cursor-pointer select-none shadow-md shadow-primary-500/20 overflow-hidden hover:ring-2 hover:ring-primary-500/50 transition-all active:scale-95"
            title={`Profil: ${user?.nama_lengkap ?? user?.nama_pengguna ?? ''}`}
          >
            {user?.foto ? (
              <img src={user.foto} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {showProfileMenu && (
            <div className="fixed right-3 top-16 sm:absolute sm:right-0 sm:top-11 z-50 w-60 glass-card shadow-2xl rounded-2xl overflow-hidden border border-white/40 dark:border-slate-700/40 p-2 dropdown-popover-animate">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.nama_lengkap || user?.nama_pengguna || 'Pengguna'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-slate-400 truncate">@{user?.nama_pengguna}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 uppercase">
                    {user?.hak_akses ?? 'kasir'}
                  </span>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/settings?category=akun')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <SettingsIcon size={15} className="text-slate-400" />
                  <span>Pengaturan Akun</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/shifts')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Clock size={15} className="text-slate-400" />
                  <span>Shift Kasir</span>
                </button>
                <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800/80">
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
