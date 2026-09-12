import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Activity, Award, ArrowRightLeft, ArrowUpDown, BarChart2, Bell, BookOpen, BookOpenCheck, Bot, Building2,
  Calculator, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Clock, CreditCard,
  Crown, Database, DollarSign, FileText, Gift, Globe, History, LayoutDashboard, LogOut,
  Menu, MessageCircle, Monitor, Package, Plug, Printer, Rocket, RotateCcw, Ruler, Settings, Shield,
  ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, Tag, Truck, TrendingUp, UserCircle, Users,
  Wallet, X, UtensilsCrossed, Grid3X3, CalendarCheck, ScrollText, Bike, Landmark, Hammer,
  PiggyBank, Ticket, MessageSquare, Megaphone, Globe2, FileSpreadsheet, LineChart, Percent,
  UserPlus, Briefcase, Clock4, HandCoins, Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDemoGuard } from '../hooks/useDemoGuard'
import { useAppStore } from '../stores'
import { api } from '../utils/api'
import appLogo from '../assets/app-logo.png'
import { canOpenDeveloperPanel, hasRole, type AppRole } from '../../shared/config/rbac'

export interface MenuItem {
  to: string
  icon: LucideIcon
  label: string
  code: string
  adminOnly?: boolean
  feature?: string
  roles?: AppRole[]
  isRestaurantOnly?: boolean
}

interface MenuGroup {
  label: string
  isRestaurantOnly?: boolean
  items: MenuItem[]
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Utama',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', code: 'nav_dashboard' },
      { to: '/assistant', icon: Bot, label: 'Asisten AI', code: 'nav_dashboard' },
      { to: '/transaksi', icon: ShoppingCart, label: 'Kasir POS', code: 'nav_penjualan' },
      { to: '/shifts', icon: Clock, label: 'Shift Kasir', code: 'nav_penjualan' },
      { to: '/riwayat', icon: History, label: 'Riwayat Transaksi', code: 'nav_penjualan' },
      { to: '/customer-display-page', icon: Monitor, label: 'Display & Antrian', code: 'nav_dashboard' },
      { to: '/daily-notes', icon: FileText, label: 'Catatan Harian', code: 'nav_dashboard' },
    ],
  },
  {
    label: 'Inventaris & Stok',
    items: [
      { to: '/produk', icon: Package, label: 'Katalog Produk', code: 'nav_barang' },
      { to: '/kategori', icon: Tag, label: 'Kategori', code: 'nav_barang' },
      { to: '/satuan', icon: Ruler, label: 'Satuan Unit', code: 'nav_barang' },
      { to: '/pembelian', icon: ShoppingBag, label: 'Pembelian Stok', code: 'nav_pembelian' },
      { to: '/stock-opname', icon: ClipboardCheck, label: 'Stok Opname', code: 'nav_barang', feature: 'stock_opname' },
      { to: '/branch', icon: Building2, label: 'Cabang & Transfer', code: 'nav_branch', roles: ['developer', 'super_admin', 'admin'], feature: 'multi_branch' },
      { to: '/price-list', icon: ClipboardList, label: 'Daftar Harga', code: 'nav_barang' },
    ],
  },
  {
    label: 'Keuangan & Laporan',
    items: [
      { to: '/laporan', icon: BarChart2, label: 'Laporan Keuangan', code: 'nav_pembelian', feature: 'reports' },
      { to: '/kas', icon: Wallet, label: 'Arus Kas & Petty Cash', code: 'nav_pembelian' },
      { to: '/debts', icon: DollarSign, label: 'Hutang / Piutang', code: 'nav_pembelian', feature: 'debt_management' },
      { to: '/accounting', icon: BookOpenCheck, label: 'Buku Akuntansi', code: 'nav_pembelian', roles: ['developer', 'super_admin', 'admin'], feature: 'reports' },
      { to: '/returns', icon: RotateCcw, label: 'Retur Barang', code: 'nav_penjualan', feature: 'return_refund' },
      { to: '/payment', icon: Crown, label: 'Status & Langganan', code: 'nav_plans' },
      { to: '/promo', icon: Gift, label: 'Promo & Diskon', code: 'nav_promo' },
    ],
  },
  {
    label: 'Relasi & Member',
    items: [
      { to: '/customer', icon: UserCircle, label: 'Pelanggan & Poin', code: 'nav_supplier' },
      { to: '/supplier', icon: Truck, label: 'Pemasok / Supplier', code: 'nav_supplier' },
      { to: '/sales-commission', icon: TrendingUp, label: 'Komisi Sales', code: 'nav_pengguna' },
    ],
  },
  {
    label: 'SDM & Karyawan',
    items: [
      { to: '/employee', icon: UserPlus, label: 'Data Karyawan', code: 'nav_pengguna' },
      { to: '/attendance', icon: Clock, label: 'Absensi & Jadwal', code: 'nav_pengguna' },
      { to: '/payroll', icon: Briefcase, label: 'Penggajian / Payroll', code: 'nav_pengguna', roles: ['developer', 'super_admin', 'admin'] },
      { to: '/tip-pooling', icon: HandCoins, label: 'Tip Pooling', code: 'nav_pengguna', isRestaurantOnly: true },
    ],
  },
  {
    label: 'Operasional & F&B',
    isRestaurantOnly: true,
    items: [
      { to: '/kitchen-display', icon: UtensilsCrossed, label: 'Kitchen Display (KDS)', code: 'nav_penjualan' },
      { to: '/table-management', icon: Grid3X3, label: 'Meja & Tata Letak', code: 'nav_penjualan' },
      { to: '/reservation', icon: CalendarCheck, label: 'Reservasi Meja', code: 'nav_penjualan' },
      { to: '/recipe', icon: ScrollText, label: 'Resep & Bahan Baku', code: 'nav_barang' },
      { to: '/delivery', icon: Bike, label: 'Kurir & Pengiriman', code: 'nav_pembelian' },
    ],
  },
  {
    label: 'Alat & Sistem',
    items: [
      { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp Notifikasi', code: 'nav_whatsapp' },
      { to: '/hpp', icon: Calculator, label: 'Kalkulator HPP', code: 'nav_hpp' },
      { to: '/tutorials', icon: BookOpen, label: 'Tutorial & Panduan', code: 'nav_tutorials' },
      { to: '/users', icon: Users, label: 'Kelola Pengguna', code: 'nav_pengguna', roles: ['developer', 'super_admin', 'admin'] },
      { to: '/backup', icon: Database, label: 'Backup Database', code: 'nav_export_db', roles: ['developer', 'super_admin', 'admin'], feature: 'backup' },
      { to: '/security', icon: Shield, label: 'Log Keamanan', code: 'nav_security', roles: ['developer', 'super_admin', 'admin'] },
      { to: '/license-admin', icon: ShieldCheck, label: 'Developer Panel', code: 'nav_license_admin', roles: ['developer', 'super_admin'] },
      { to: '/settings', icon: Settings, label: 'Pengaturan Sistem', code: 'nav_identitas' },
    ],
  },
]

const QUICK_MENU_PATHS = ['/', '/transaksi', '/produk', '/laporan', '/settings']
const SIMPLE_MENU_PATHS = new Set(['/', '/assistant', '/transaksi', '/riwayat', '/produk', '/customer', '/kas', '/shifts', '/settings'])

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { posMode, setPosMode } = useAppStore()
  const { isDemo: isDemoGuard, showPricing, remainingUsage } = useDemoGuard()
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user?.nama_pengguna) {
      api<Record<string, boolean>>('user:getPermissions', user.nama_pengguna).then(r => {
        if (r.success && r.data && Object.keys(r.data).length > 0) {
          setPermissions(r.data)
        }
      })
      api<{ feature_flags?: Record<string, boolean>; is_expired?: boolean }>('subscription:getStatus', user.nama_pengguna).then(r => {
        if (r.success && r.data?.feature_flags) setFeatureFlags(r.data.feature_flags)
      })
    }
  }, [user?.nama_pengguna])

  const handleLogout = () => {
    window.dispatchEvent(new CustomEvent('auth:request-logout'))
  }

  const handleNavClick = () => {
    if (window.innerWidth < 1024) onClose()
  }

  const isDemo = user?.hak_akses === 'demo'
  const isSimpleMode = user?.hak_akses === 'kasir'
  const isDeveloper = canOpenDeveloperPanel(user?.hak_akses)
  const canShowRenewal = !isDemo && !isDeveloper
  const accessDaysRemaining = user?.access_days_remaining ?? (() => {
    if (!user?.access_expires_at) return null
    const expires = new Date(user.access_expires_at)
    if (Number.isNaN(expires.getTime())) return null
    return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000))
  })()
  const canShowItem = (item: MenuItem) => {
    if (item.adminOnly && !isDeveloper) return false
    if (item.isRestaurantOnly && posMode !== 'restaurant') return false
    if (item.to === '/tutorials' && typeof window !== 'undefined' && window.innerWidth < 1024) return false
    if (item.roles && !hasRole(user?.hak_akses, item.roles)) return false
    if (isSimpleMode && !SIMPLE_MENU_PATHS.has(item.to)) return false
    if (permissions && !isDeveloper && item.code && permissions[item.code] === false) return false
    if ('feature' in item && item.feature && featureFlags[item.feature] === false) return false
    return true
  }
  const quickItems = MENU_GROUPS
    .flatMap(group => group.items)
    .filter(item => QUICK_MENU_PATHS.includes(item.to) && canShowItem(item))

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-60 ${isCollapsed ? 'lg:w-20' : 'lg:w-60'} h-screen flex flex-col
        glass border-r border-white/30 dark:border-slate-700/30
        transform transition-[width,transform] duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Header with Logo & Burger Menu Button */}
      <div className={`border-b border-white/30 dark:border-slate-700/30 ${isCollapsed ? 'lg:flex lg:flex-col lg:items-center lg:gap-2.5 lg:px-2 lg:py-3.5 px-4 py-4' : 'flex items-center justify-between gap-3 px-4 py-4'}`}>
        <div className={`flex items-center min-w-0 ${isCollapsed ? 'lg:justify-center' : 'gap-3'}`}>
          <img src={appLogo} alt="WariPOS" className={`${isCollapsed ? 'h-8 w-8' : 'h-9 w-9'} shrink-0 object-contain drop-shadow-sm`} />
          <div className={`${isCollapsed ? 'lg:hidden' : ''}`}>
            <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight">WariPOS</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Point of Sale</p>
          </div>
        </div>
        <div className={`flex items-center ${isCollapsed ? 'lg:justify-center' : 'shrink-0'}`}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title={isCollapsed ? 'Buka sidebar penuh' : 'Ciutkan sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            aria-label="Tutup sidebar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Mode Bisnis Switcher (Toko Retail ⇄ Restoran F&B) */}
      <div className={`border-b border-slate-200/60 dark:border-slate-800/80 transition-colors ${
        posMode === 'restaurant'
          ? 'bg-amber-500/10 dark:bg-amber-500/15'
          : 'bg-slate-50/70 dark:bg-slate-900/50'
      } ${isCollapsed ? 'p-2 flex justify-center' : 'px-3 py-2.5'}`}>
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setPosMode(posMode === 'retail' ? 'restaurant' : 'retail')}
            className={`p-2.5 rounded-xl border transition-all ${
              posMode === 'restaurant'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'bg-primary-50 dark:bg-primary-950/40 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 shadow-sm'
            }`}
            title={posMode === 'retail' ? 'Mode Toko (Klik ganti ke Restoran F&B)' : 'Mode Restoran F&B (Klik ganti ke Toko Retail)'}
          >
            {posMode === 'retail' ? <Store size={18} /> : <UtensilsCrossed size={18} />}
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => setPosMode('retail')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  posMode === 'retail'
                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200/80 dark:border-slate-600 scale-[1.01]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Store size={14} />
                <span>Mode Toko</span>
              </button>
              <button
                type="button"
                onClick={() => setPosMode('restaurant')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  posMode === 'restaurant'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 scale-[1.01]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UtensilsCrossed size={14} />
                <span>Restoran</span>
              </button>
            </div>
            <div className="px-1 text-[10px] font-semibold flex items-center justify-between">
              <span className={posMode === 'restaurant' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                {posMode === 'restaurant' ? 'Operasional Restoran & F&B' : 'Operasional Toko Retail'}
              </span>
              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                posMode === 'restaurant' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary-500/15 text-primary-700 dark:text-primary-300'
              }`}>
                Aktif
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 overflow-y-auto scrollbar-thin ${isCollapsed ? 'lg:px-2 px-3 space-y-2.5' : 'px-3 space-y-3'}`}>
        {quickItems.length > 0 && (
          <div className={`rounded-2xl border transition-all duration-200 ${
            isCollapsed
              ? 'lg:p-1.5 p-2 bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/50'
              : 'p-2 bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60 shadow-xs'
          }`}>
            <div className={`px-2 py-1 mb-1 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/40 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Menu Cepat
              </span>
            </div>
            <div className="space-y-0.5">
              {quickItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={`quick-${to}`}
                  to={to}
                  end={to === '/'}
                  onClick={handleNavClick}
                  title={isCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150
                    ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-2' : ''}
                    ${isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/30 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700/70 hover:text-primary-600 dark:hover:text-primary-400'
                    }`
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
        {MENU_GROUPS.map(group => {
          if (group.isRestaurantOnly && posMode !== 'restaurant') return null
          const visibleItems = group.items.filter(item => canShowItem(item) && !QUICK_MENU_PATHS.includes(item.to))
          if (visibleItems.length === 0) return null
          return (
            <div
              key={group.label}
              className={`rounded-2xl border transition-all duration-300 ${
                group.isRestaurantOnly
                  ? 'border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800/40 ring-1 ring-amber-400/20'
                  : isCollapsed
                    ? 'lg:p-1.5 p-2 bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/50'
                    : 'p-2 bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60 shadow-xs'
              } ${isCollapsed && group.isRestaurantOnly ? 'lg:p-1.5 p-2' : group.isRestaurantOnly ? 'p-2 shadow-xs' : ''}`}
            >
              <div className={`px-2 py-1 mb-1 flex items-center justify-between border-b ${
                group.isRestaurantOnly
                  ? 'border-amber-300/40 dark:border-amber-800/40'
                  : 'border-slate-200/50 dark:border-slate-700/40'
              } ${isCollapsed ? 'lg:hidden' : ''}`}>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  group.isRestaurantOnly ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {group.label}
                </span>
                {group.isRestaurantOnly && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                    F&B Resto
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={handleNavClick}
                    title={isCollapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150
                      ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-2' : ''}
                      ${isActive
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/30 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700/70 hover:text-primary-600 dark:hover:text-primary-400'
                      }`
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className={`px-3 py-3.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2 bg-slate-50/50 dark:bg-slate-900/30 ${isCollapsed ? 'lg:px-2' : ''}`}>
        {isDemo && (
          <div className={`${isCollapsed ? 'lg:hidden' : ''}`}>
            <button
              onClick={showPricing}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                bg-primary-600 hover:bg-primary-700
                text-white text-xs font-bold
                transition-colors active:scale-[0.98]
                demo-upgrade-badge mb-1"
            >
              <Rocket size={14} />
              <span className="flex-1 text-left">Upgrade Sekarang</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px]">
                {remainingUsage} sisa
              </span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/15">
              <Shield size={12} className="text-red-500" />
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Demo Mode</span>
            </div>
          </div>
        )}
        {canShowRenewal && (
          <div className={`${isCollapsed ? 'lg:hidden' : ''}`}>
            <button
              onClick={showPricing}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                bg-emerald-600 hover:bg-emerald-700
                text-white text-xs font-bold
                transition-colors active:scale-[0.98] mb-1"
            >
              <Rocket size={14} />
              <span className="flex-1 text-left">Upgrade / Perpanjang</span>
            </button>
            {accessDaysRemaining !== null && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                accessDaysRemaining <= 7
                  ? 'bg-amber-500/10 border-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}>
                <Clock size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {accessDaysRemaining === 0 ? 'Akses berakhir hari ini' : `${accessDaysRemaining} hari akses`}
                </span>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            navigate('/settings?category=akun')
            if (window.innerWidth < 1024) onClose()
          }}
          className={`w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer group ${isCollapsed ? 'lg:justify-center lg:p-1' : ''}`}
          title="Buka Pengaturan Profil & Akun"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden group-hover:ring-2 group-hover:ring-primary-500/50 transition-all ${isDemo ? 'bg-red-500' : 'bg-primary-600'}`}>
            {user?.foto ? (
              <img src={user.foto} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.nama_pengguna?.[0]?.toUpperCase() ?? 'U'
            )}
          </div>
          <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">{user?.nama_lengkap ?? user?.nama_pengguna}</p>
            <p className={`text-[10px] truncate ${isDemo ? 'text-red-400 font-bold' : 'text-slate-400 font-medium'}`}>{user?.hak_akses?.toUpperCase() ?? 'KASIR'}</p>
          </div>
        </button>
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Keluar' : undefined}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-950/25 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-700 transition-colors ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
        >
          <LogOut size={16} className="shrink-0 text-red-600 dark:text-red-400" />
          <span className={`${isCollapsed ? 'lg:hidden' : ''}`}>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
