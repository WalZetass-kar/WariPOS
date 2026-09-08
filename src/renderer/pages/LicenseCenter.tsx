import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BadgeDollarSign,
  Bell,
  CreditCard,
  Database,
  FileWarning,
  Globe,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Menu,
  MonitorSmartphone,
  ServerCog,
  Shield,
  TrendingUp,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LicenseServerConfig from './license/LicenseServerConfig'
import LicenseUsersPage from './license/LicenseUsers'
import LicensePlansPage from './license/LicensePlans'
import LicenseFeaturesPage from './license/LicenseFeatures'
import LicensePopupsPage from './license/LicensePopups'
import LicensePaymentsPage from './license/LicensePayments'
import LicenseDashboardPage from './license/LicenseDashboard'
import LicenseDevicesPage from './license/LicenseDevices'
import LicenseUpdatesPage from './license/LicenseUpdates'
import LicenseErrorsPage from './license/LicenseErrors'
import LicenseAnnouncementsPage from './license/LicenseAnnouncements'
import LicenseRevenuePage from './license/LicenseRevenue'
import ActivityLogPage from './ActivityLog'
import BackupPage from './Backup'
import EcommerceApiPage from './EcommerceApi'
import SecurityPage from './Security'
import LocalUsersPage from './Users'
import { api } from '../utils/api'
import developerPanelIcon from '../assets/developer-panel-icon.png'
import { SkeletonPage } from '../components/Skeleton'

export type LicenseTab =
  | 'dashboard'
  | 'connection'
  | 'users'
  | 'devices'
  | 'updates'
  | 'errors'
  | 'announcements'
  | 'revenue'
  | 'plans'
  | 'features'
  | 'popups'
  | 'payments'
  | 'localUsers'
  | 'backup'
  | 'security'
  | 'activityLog'
  | 'ecommerceApi'

interface TabDef {
  id: LicenseTab
  label: string
  hint: string
  icon: any
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Statistik dan ringkasan lisensi', icon: LayoutDashboard },
  { id: 'connection', label: 'Koneksi Server', hint: 'Konfigurasi Supabase & sync', icon: ServerCog },
  { id: 'revenue', label: 'Pendapatan', hint: 'Pertumbuhan & total revenue', icon: TrendingUp },
  { id: 'users', label: 'Data Pembeli', hint: 'Akun pembeli, lisensi & password', icon: Users },
  { id: 'devices', label: 'Perangkat', hint: 'Monitoring & blokir device', icon: MonitorSmartphone },
  { id: 'payments', label: 'Persetujuan Lisensi', hint: 'Verifikasi permintaan checkout', icon: CreditCard },
  { id: 'plans', label: 'Paket Lisensi', hint: 'Master paket & penetapan harga', icon: BadgeDollarSign },
  { id: 'features', label: 'Fitur Premium', hint: 'Master feature flags aplikasi', icon: ListChecks },
  { id: 'popups', label: 'Popup Upgrade', hint: 'Pesan banner promosi & upgrade', icon: Megaphone },
  { id: 'updates', label: 'Update Aplikasi', hint: 'Versi rilis & force update', icon: Wrench },
  { id: 'announcements', label: 'Broadcast Pesan', hint: 'Pengumuman & info maintenance', icon: Bell },
  { id: 'errors', label: 'Log Error', hint: 'Crash report & log error sistem', icon: FileWarning },
  { id: 'localUsers', label: 'Pengguna Lokal', hint: 'Akun kasir & hak akses toko', icon: Users },
  { id: 'backup', label: 'Backup Database', hint: 'Cadangan data & restore SQLite', icon: Database },
  { id: 'security', label: 'Log Keamanan', hint: 'Aktivitas sesi & login user', icon: Shield },
  { id: 'activityLog', label: 'Activity Log', hint: 'Audit trail transaksi sistem', icon: Activity },
  { id: 'ecommerceApi', label: 'E-commerce API', hint: 'Integrasi API online store', icon: Globe },
]

const GROUPS: Array<{
  id: string
  label: string
  icon: any
  tabs: LicenseTab[]
}> = [
  { id: 'overview', label: 'Ringkasan & Server', icon: LayoutDashboard, tabs: ['dashboard', 'connection', 'revenue'] },
  { id: 'customers', label: 'Pembeli & Lisensi', icon: Users, tabs: ['users', 'devices', 'payments'] },
  { id: 'products', label: 'Produk & Paket', icon: BadgeDollarSign, tabs: ['plans', 'features', 'popups'] },
  { id: 'operations', label: 'Operasional & Update', icon: Wrench, tabs: ['updates', 'announcements', 'errors'] },
  { id: 'tools', label: 'Alat Sistem & Backup', icon: Database, tabs: ['localUsers', 'backup', 'security', 'activityLog', 'ecommerceApi'] },
]

const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t])) as Record<LicenseTab, TabDef>

export default function LicenseCenter() {
  const { user } = useAuth()
  const [tab, setTab] = useState<LicenseTab>('connection')
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  const activeGroup = useMemo(() => {
    return GROUPS.find(g => g.tabs.includes(tab)) ?? GROUPS[0]
  }, [tab])

  const activeTabDef = useMemo(() => TAB_BY_ID[tab] ?? TABS[0], [tab])

  useEffect(() => {
    let cancelled = false
    api<{ connected: boolean; hasRefreshToken?: boolean }>('license:getConfig').then(result => {
      if (cancelled) return
      if (result.success && result.data?.connected) {
        setIsConnected(true)
        if (result.data.hasRefreshToken) {
          setTab('dashboard')
        }
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!user || user.hak_akses !== 'developer') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="rounded-3xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-8 text-center max-w-md shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-600/10 text-red-600 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Akses Dibatasi</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Halaman ini hanya dapat diakses oleh akun hak akses Developer.</p>
        </div>
      </div>
    )
  }

  if (loading) return <SkeletonPage rows={6} />

  const ActiveIcon = activeTabDef.icon

  return (
    <div className="space-y-4 select-none pb-12">
      {/* ─── Header Info & Status ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <img
            src={developerPanelIcon}
            alt="Developer Panel"
            className="h-11 w-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Developer Panel</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-red-600/10 text-red-600 dark:bg-red-950/60 dark:text-red-400 text-[11px] font-bold border border-red-600/20">
                Mode Master
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Pusat manajemen lisensi pembeli, paket harga, update aplikasi, dan kontrol database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            isConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isConnected ? 'Mode Master Aktif' : 'Server Offline / Belum Login'}</span>
          </div>
        </div>
      </div>

      {/* ─── Top Horizontal Navigation Bar (No Nested Sidebar!) ─────── */}
      <div className="space-y-2">
        {/* Tier 1: Primary Category Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none touch-pan-x">
          {GROUPS.map(grp => {
            const GroupIcon = grp.icon
            const isGroupActive = activeGroup.id === grp.id
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => setTab(grp.tabs[0])}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  isGroupActive
                    ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GroupIcon size={15} />
                <span>{grp.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tier 2: Sub-tabs of Active Group */}
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto scrollbar-none touch-pan-x">
          {activeGroup.tabs.map(tabId => {
            const item = TAB_BY_ID[tabId]
            const ItemIcon = item.icon
            const isTabActive = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  isTabActive
                    ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <ItemIcon size={14} />
                <span>{item.label}</span>
              </button>
            )
          })}

          <div className="hidden lg:flex items-center gap-1.5 ml-auto text-[11px] text-slate-400 font-medium px-2 shrink-0">
            <ActiveIcon size={13} className="text-red-600" />
            <span className="truncate">{activeTabDef.hint}</span>
          </div>
        </div>
      </div>

      {/* ─── Full-Width Content Container ───────────────────────────── */}
      <div className="min-w-0 pt-1">
        {tab === 'dashboard' && <LicenseDashboardPage />}
        {tab === 'connection' && <LicenseServerConfig />}
        {tab === 'users' && <LicenseUsersPage />}
        {tab === 'devices' && <LicenseDevicesPage />}
        {tab === 'updates' && <LicenseUpdatesPage />}
        {tab === 'errors' && <LicenseErrorsPage />}
        {tab === 'announcements' && <LicenseAnnouncementsPage />}
        {tab === 'revenue' && <LicenseRevenuePage />}
        {tab === 'plans' && <LicensePlansPage />}
        {tab === 'features' && <LicenseFeaturesPage />}
        {tab === 'popups' && <LicensePopupsPage />}
        {tab === 'payments' && <LicensePaymentsPage />}
        {tab === 'localUsers' && <LocalUsersPage />}
        {tab === 'backup' && <BackupPage />}
        {tab === 'security' && <SecurityPage />}
        {tab === 'activityLog' && <ActivityLogPage />}
        {tab === 'ecommerceApi' && <EcommerceApiPage />}
      </div>
    </div>
  )
}
