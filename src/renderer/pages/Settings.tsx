import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toDataURL } from 'qrcode'
import {
  Sun, Moon, Palette, Store, Receipt, Barcode, Printer, Database, Bell, AlertTriangle,
  Server, RefreshCw, Wifi, Bot, FileSpreadsheet, KeyRound, QrCode, Copy, CheckCircle2,
  Code2, ExternalLink, MessageCircle, ChevronLeft, Search, Monitor, Shield, HardDrive,
  Info, User, Fingerprint, PackagePlus, Trash2, UtensilsCrossed, LogOut,
} from 'lucide-react'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import appLogo from '../assets/app-logo.png'
import { useTheme, type ThemeColor } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useAppStore } from '../stores'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { secureStorage } from '../utils/secureStorage'
import { playDangerSound, playWarningSound } from '../utils/sound'
import { collectAuthDeviceInfo } from '../utils/authDevice'
import { SkeletonPage } from '../components/Skeleton'
import { openWhatsApp, SUBSCRIPTION_UPGRADE_WA_NUMBER } from '../utils/whatsapp'
import { DEFAULT_INDUSTRY_SETTINGS, defaultBaseUrlForProvider, defaultModelForProvider, normalizeIndustrySettings, type AiProvider, type IndustrySettings } from '../../shared/industrySettings'
import type { Identitas } from '../../shared/types'
import { normalizeSyncServerUrl } from '../../shared/endpointSecurity'
import { GOOGLE_SHEETS_APPS_SCRIPT } from '../../shared/googleSheetsAppsScript'
import { appConfig } from '../utils/productionConfig'
import { validatePasswordStrength } from '../../shared/passwordPolicy'

const COLORS: { key: ThemeColor; label: string; hex: string }[] = [
  { key: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b' },
  { key: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { key: 'pink', label: 'Pink Soft', hex: '#ec4899' },
  { key: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { key: 'teal', label: 'Teal', hex: '#14b8a6' },
  { key: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { key: 'orange', label: 'Orange', hex: '#f97316' },
]

type SyncMode = 'server' | 'client'

type SettingCategory =
  | 'tampilan'
  | 'akun'
  | 'sinkronisasi'
  | 'toko'
  | 'perangkat'
  | 'notifikasi'
  | 'backup'
  | 'jaringan'
  | 'tentang'

interface CategoryDef {
  id: SettingCategory
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

const CATEGORIES: CategoryDef[] = [
  { id: 'tampilan', label: 'Tampilan', description: 'Tema warna dan mode tampilan', icon: <Palette size={20} />, color: 'bg-violet-500' },
  { id: 'akun', label: 'Akun', description: 'Ganti sandi dan profil pengguna', icon: <User size={20} />, color: 'bg-blue-500' },
  { id: 'sinkronisasi', label: 'Sinkronisasi', description: 'Multi-device dan pairing', icon: <Server size={20} />, color: 'bg-emerald-500' },
  { id: 'toko', label: 'Toko', description: 'Identitas, pajak, struk, dan barcode', icon: <Store size={20} />, color: 'bg-amber-500' },
  { id: 'perangkat', label: 'Perangkat', description: 'Pengaturan perangkat lokal', icon: <Monitor size={20} />, color: 'bg-cyan-500' },
  { id: 'notifikasi', label: 'Notifikasi', description: 'Batas stok dan pengingat', icon: <Bell size={20} />, color: 'bg-rose-500' },
  { id: 'backup', label: 'Backup', description: 'Cadangan database otomatis', icon: <HardDrive size={20} />, color: 'bg-teal-500' },
  { id: 'jaringan', label: 'Jaringan', description: 'AI, Google Sheets, dan integrasi', icon: <Bot size={20} />, color: 'bg-pink-500' },
  { id: 'tentang', label: 'Tentang', description: 'Info aplikasi dan pengembang', icon: <Info size={20} />, color: 'bg-slate-500' },
]

export default function Settings() {
  const { color, mode, setColor, setMode } = useTheme()
  const [customColor, setCustomColor] = useState(color.startsWith('#') ? color : '#ec4899')
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [identitas, setIdentitas] = useState<Partial<Identitas>>({})
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncError, setSyncError] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncForm, setSyncForm] = useState({
    enabled: false,
    mode: 'server' as SyncMode,
    port: '38573',
    baseUrl: '',
    token: '',
    deviceName: '',
  })
  const [pairingText, setPairingText] = useState('')
  const [syncQr, setSyncQr] = useState('')
  const [industrySettings, setIndustrySettings] = useState<IndustrySettings>(DEFAULT_INDUSTRY_SETTINGS)
  const [industryLoading, setIndustryLoading] = useState(false)
  const [aiModels, setAiModels] = useState<string[]>([])
  const [loadingAiModels, setLoadingAiModels] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testingSheets, setTestingSheets] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [profileForm, setProfileForm] = useState({ nama_lengkap: '', email: '', no_telp: '', foto: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  const [searchParams] = useSearchParams()
  const initialCategory = (searchParams.get('category') || searchParams.get('tab')) as SettingCategory | null
  const [activeCategory, setActiveCategory] = useState<SettingCategory | null>(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const cat = (searchParams.get('category') || searchParams.get('tab')) as SettingCategory | null
    if (cat) setActiveCategory(cat)
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      api<Identitas>('identitas:get').then(r => {
        if (r.success && r.data) setIdentitas(r.data)
      }),
      loadSyncStatus(),
      loadIndustrySettings(),
    ]).finally(() => setInitialLoading(false))
  }, [])

  useEffect(() => {
    if (user) {
      setProfileForm({
        nama_lengkap: user.nama_lengkap ?? '',
        email: user.email ?? '',
        no_telp: (user as any).no_telp ?? '',
        foto: (user as any).foto ?? '',
      })
    }
  }, [user?.nama_lengkap, user?.email, (user as any)?.foto, (user as any)?.no_telp])

  const loadSyncStatus = async () => {
    const r = await api<any>('sync:getStatus')
    if (!r.success || !r.data) return

    setSyncStatus(r.data)
    if (r.data.mode === 'android-client') {
      setSyncForm({
        enabled: Boolean(r.data.client?.enabled),
        mode: 'client',
        port: '38573',
        baseUrl: r.data.client?.baseUrl ?? '',
        token: r.data.client?.token ?? '',
        deviceName: '',
      })
    } else if (r.data.client?.enabled) {
      setSyncForm({
        enabled: Boolean(r.data.client?.enabled),
        mode: 'client',
        port: String(r.data.port ?? 38573),
        baseUrl: r.data.client?.baseUrl ?? '',
        token: r.data.client?.token ?? '',
        deviceName: r.data.client?.deviceName ?? '',
      })
    } else {
      setSyncForm({
        enabled: Boolean(r.data.enabled),
        mode: 'server',
        port: String(r.data.port ?? 38573),
        baseUrl: r.data.urls?.[1] ?? r.data.urls?.[0] ?? '',
        token: r.data.token ?? '',
        deviceName: r.data.client?.deviceName ?? '',
      })
    }
  }

  const saveIdentitas = async () => {
    setLoading(true)
    try {
      const r = await api('identitas:save', identitas)
      if (r.success) toast(r.message as string)
      else toast(r.message as string, 'error')
    } finally {
      setLoading(false)
    }
  }

  const isAndroidSyncClient = syncStatus?.mode === 'android-client'
  const isSyncClient = isAndroidSyncClient || syncForm.mode === 'client'

  const getSyncPairingPayload = () => {
    const baseUrl = syncForm.baseUrl || (syncStatus?.urls ?? []).find((url: string) => !url.includes('127.0.0.1')) || syncStatus?.urls?.[0] || ''
    return JSON.stringify({
      type: 'waripos-sync',
      app: 'WariPOS',
      baseUrl,
      token: syncForm.token,
      generatedAt: new Date().toISOString(),
    })
  }

  useEffect(() => {
    if (isSyncClient || !syncForm.token || !(syncStatus?.urls ?? []).length) {
      setSyncQr('')
      return
    }

    let cancelled = false
    toDataURL(getSyncPairingPayload(), { width: 180, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => {
        if (!cancelled) setSyncQr(url)
      })
      .catch(() => {
        if (!cancelled) setSyncQr('')
      })

    return () => {
      cancelled = true
    }
  }, [isSyncClient, syncForm.token, syncForm.baseUrl, syncStatus?.urls])

  const loadIndustrySettings = async () => {
    const r = await api<IndustrySettings>('integrations:get')
    if (r.success && r.data) setIndustrySettings(normalizeIndustrySettings(r.data))
  }

  const saveIndustrySettings = async () => {
    setIndustryLoading(true)
    try {
      const r = await api<IndustrySettings>('integrations:save', industrySettings)
      if (r.success && r.data) {
        setIndustrySettings(normalizeIndustrySettings(r.data))
        toast('Pengaturan berhasil disimpan', 'success')
      } else {
        toast(r.message as string || 'Gagal menyimpan pengaturan', 'error')
      }
    } finally {
      setIndustryLoading(false)
    }
  }

  const changeIndustrySetting = <K extends keyof IndustrySettings>(key: K, value: IndustrySettings[K]) => {
    setIndustrySettings(prev => ({ ...prev, [key]: value }))
  }

  const changeAiProvider = (provider: AiProvider) => {
    setAiModels([])
    setIndustrySettings(prev => ({
      ...prev,
      aiProvider: provider,
      aiModel: defaultModelForProvider(provider) || prev.aiModel,
      aiBaseUrl: provider === 'openai'
        ? (appConfig.aiProviderUrl || defaultBaseUrlForProvider(provider))
        : defaultBaseUrlForProvider(provider),
    }))
  }

  const loadAiModels = async () => {
    if (!industrySettings.aiEnabled || industrySettings.aiProvider === 'local') {
      toast('Aktifkan AI online dan pilih provider terlebih dahulu', 'error')
      return
    }
    if (industrySettings.aiProvider === 'gemini') {
      setAiModels([
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002',
      ])
      if (!industrySettings.aiModel) changeIndustrySetting('aiModel', 'gemini-2.0-flash')
      toast('Daftar model Gemini dimuat dari default', 'success')
      return
    }

    setLoadingAiModels(true)
    try {
      const r = await api<string[]>('integrations:listAiModels', industrySettings)
      if (r.success) {
        const models = r.data ?? []
        setAiModels(models)
        if (!industrySettings.aiModel && models[0]) changeIndustrySetting('aiModel', models[0])
        toast(r.message as string || 'Daftar model dimuat', 'success')
      } else {
        toast(r.message as string || 'Gagal memuat daftar model', 'error')
      }
    } finally {
      setLoadingAiModels(false)
    }
  }

  const testAiConnection = async () => {
    if (!industrySettings.aiEnabled || industrySettings.aiProvider === 'local') {
      toast('Aktifkan AI online dan pilih provider terlebih dahulu', 'error')
      return
    }

    setTestingAi(true)
    try {
      const r = await api('integrations:testAi', industrySettings)
      toast(r.message as string || (r.success ? 'Koneksi AI berhasil' : 'Koneksi AI gagal'), r.success ? 'success' : 'error')
    } finally {
      setTestingAi(false)
    }
  }

  const testGoogleSheets = async () => {
    setTestingSheets(true)
    try {
      const r = await api('integrations:testGoogleSheets')
      toast(r.message as string || (r.success ? 'Google Sheets tersambung' : 'Google Sheets gagal'), r.success ? 'success' : 'error')
    } finally {
      setTestingSheets(false)
    }
  }

  const copyGoogleSheetsScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT)
      toast('Template Apps Script disalin', 'success')
    } catch {
      toast('Clipboard tidak tersedia', 'error')
    }
  }

  const openAppsScript = () => {
    api('app:openExternal', 'https://script.google.com/home').catch(() => {
      window.open('https://script.google.com/home', '_blank', 'noopener,noreferrer')
    })
  }

  const copyPairingData = async () => {
    try {
      await navigator.clipboard.writeText(getSyncPairingPayload())
      toast('Data pairing disalin', 'success')
    } catch {
      toast('Clipboard tidak tersedia', 'error')
    }
  }

  const applyPairingData = () => {
    try {
      const data = JSON.parse(pairingText)
      if ((data?.type !== 'waripos-sync' && data?.type !== 'zetass-pos-sync') || !data.baseUrl || !data.token) {
        throw new Error('Format pairing tidak valid')
      }
      const url = normalizeSyncServerUrl(String(data.baseUrl))
      if (!url.valid || !url.url) throw new Error(url.message ?? 'URL pairing tidak valid')
      setSyncForm(prev => ({
        ...prev,
        enabled: true,
        baseUrl: url.url!,
        token: String(data.token),
      }))
      toast('Data pairing diterapkan. Tekan Simpan lalu Tes.', 'success')
      setPairingText('')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Format pairing tidak valid', 'error')
    }
  }

  const saveSync = async () => {
    if (isSyncClient && syncForm.enabled) {
      const url = normalizeSyncServerUrl(syncForm.baseUrl)
      if (!url.valid || !url.url) {
        toast(url.message as string || 'URL sinkronisasi tidak valid', 'error')
        return
      }
      setSyncForm(prev => ({ ...prev, baseUrl: url.url! }))
    }
    setSyncLoading(true)
    try {
      const payload = isSyncClient
        ? { enabled: syncForm.enabled, baseUrl: syncForm.baseUrl, token: syncForm.token, deviceName: syncForm.deviceName }
        : { enabled: syncForm.enabled, port: parseInt(syncForm.port, 10), token: syncForm.token }
      const channel = isAndroidSyncClient || !isSyncClient ? 'sync:saveConfig' : 'sync:saveClientConfig'
      const r = await api<any>(channel, payload)
      if (r.success) {
        toast(r.message as string || 'Sinkronisasi disimpan', 'success')
        await loadSyncStatus()
      } else {
        toast(r.message as string || 'Gagal menyimpan sinkronisasi', 'error')
      }
    } finally {
      setSyncLoading(false)
    }
  }

  const testSync = async () => {
    if (isSyncClient) {
      const url = normalizeSyncServerUrl(syncForm.baseUrl)
      if (!url.valid || !url.url) {
        toast(url.message as string || 'URL sinkronisasi tidak valid', 'error')
        return
      }
    }
    setSyncLoading(true)
    try {
      const channel = isAndroidSyncClient
        ? 'sync:testConnection'
        : isSyncClient
          ? 'sync:testClientConnection'
          : 'sync:testConnection'
      const payload = isSyncClient ? { baseUrl: syncForm.baseUrl, token: syncForm.token, deviceName: syncForm.deviceName } : undefined
      const r = await api<any>(channel, payload)
      if (r.success) {
        toast(r.message as string || 'Sinkronisasi tersambung', 'success')
        await loadSyncStatus()
      } else {
        toast(r.message as string || 'Sinkronisasi gagal', 'error')
      }
    } finally {
      setSyncLoading(false)
    }
  }

  const rotateSyncToken = async () => {
    setSyncLoading(true)
    try {
      const r = await api<any>('sync:rotateToken')
      if (r.success) {
        toast(r.message as string || 'Token diganti', 'success')
        await loadSyncStatus()
      } else {
        toast(r.message as string || 'Gagal mengganti token', 'error')
      }
    } finally {
      setSyncLoading(false)
    }
  }

  const updatePasswordField = (key: keyof typeof passwordForm, value: string) => {
    setPasswordForm(prev => ({ ...prev, [key]: value }))
  }

  const handleChangePassword = async () => {
    if (!user?.nama_pengguna) {
      toast('Session user tidak ditemukan. Login ulang terlebih dahulu.', 'error')
      return
    }
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      toast('Sandi lama, sandi baru, dan konfirmasi wajib diisi', 'error')
      return
    }

    const validation = validatePasswordStrength(passwordForm.next)
    if (!validation.valid) {
      toast(validation.message ?? 'Sandi baru tidak valid', 'error')
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast('Sandi baru dan konfirmasi sandi tidak cocok', 'error')
      return
    }
    if (passwordForm.current === passwordForm.next) {
      toast('Sandi baru harus berbeda dari sandi lama', 'error')
      return
    }

    setChangingPassword(true)
    try {
      const r = await api('auth:changePassword', user.nama_pengguna, passwordForm.current, passwordForm.next, collectAuthDeviceInfo())
      if (!r.success) {
        toast(r.message as string || 'Gagal mengganti sandi', 'error')
        return
      }

      setPasswordForm({ current: '', next: '', confirm: '' })
      toast('Sandi berhasil diganti. Silakan login ulang.', 'success')
      logout()
      navigate('/login', { replace: true })
    } catch (error) {
      toast('Gagal mengganti sandi: ' + String(error), 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const contactDeveloperForPassword = () => {
    openWhatsApp(
      SUBSCRIPTION_UPGRADE_WA_NUMBER,
      [
        'Halo Developer, saya lupa sandi akun WariPOS.',
        `Username: ${user?.nama_pengguna ?? '-'}`,
        '',
        'Mohon bantu reset sandi akun saya.',
      ].join('\n')
    )
  }

  const handleSaveProfile = async () => {
    if (!user?.nama_pengguna) return
    if (!profileForm.nama_lengkap.trim()) {
      toast('Nama lengkap wajib diisi', 'error')
      return
    }
    setSavingProfile(true)
    try {
      const r = await api('user:update', user.nama_pengguna, {
        nama_lengkap: profileForm.nama_lengkap.trim(),
        email: profileForm.email.trim() || null,
        no_telp: profileForm.no_telp.trim() || null,
        foto: profileForm.foto || null,
      })
      if (r.success) {
        toast('Profil berhasil diperbarui', 'success')
        try {
          const raw = secureStorage.getItem('pos_session')
          if (raw) {
            const stored = typeof raw === 'string' ? JSON.parse(raw) : raw
            stored.nama_lengkap = profileForm.nama_lengkap.trim()
            stored.email = profileForm.email.trim() || null
            stored.foto = profileForm.foto || null
            secureStorage.setJSON('pos_session', stored)
          }
        } catch { /* ignore */ }
        refreshUser()
      } else {
        toast(r.message as string || 'Gagal memperbarui profil', 'error')
      }
    } catch (error) {
      toast('Gagal memperbarui profil: ' + String(error), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast('Ukuran foto maksimal 2MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProfileForm(prev => ({ ...prev, foto: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const openResetDialog = () => {
    playWarningSound()
    setConfirmReset(true)
    setConfirmText('')
  }

  const handleReset = async () => {
    if (confirmText !== 'RESET SEMUA DATA') {
      playDangerSound()
      toast('Ketik "RESET SEMUA DATA" untuk konfirmasi', 'error')
      return
    }

    playDangerSound()
    setResetting(true)
    try {
      const r = await api('system:resetData')
      if (r.success) {
        toast('Semua data berhasil direset!', 'success')
        setConfirmReset(false)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast(r.message as string || 'Gagal reset data', 'error')
      }
    } finally {
      setResetting(false)
    }
  }

  const f = (k: string, v: string | number) => setIdentitas(prev => ({ ...prev, [k]: v }))

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES
    const q = searchQuery.toLowerCase()
    return CATEGORIES.filter(
      cat => cat.label.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q)
    )
  }, [searchQuery])

  if (initialLoading) return <SkeletonPage rows={6} />

  const resetModalNode = (
    <Modal
      open={confirmReset}
      onClose={() => {
        setConfirmReset(false)
        setConfirmText('')
      }}
      title="PERINGATAN - ZONA BERBAHAYA!"
      size="lg"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-red-500 text-white animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle size={32} className="shrink-0" />
            <div>
              <p className="font-bold text-lg">TINDAKAN TIDAK DAPAT DIBATALKAN!</p>
              <p className="text-sm opacity-90">Semua data akan dihapus permanen</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
          <p className="font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
            <Database size={18} />
            Data yang akan DIHAPUS PERMANEN:
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm text-red-600 dark:text-red-400">
            {['Transaksi Penjualan', 'Transaksi Pembelian', 'Data Produk & Stok', 'Data Customer', 'Data Supplier', 'Data Kas & Shift', 'Hutang & Piutang', 'Backup & Activity Log'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-red-500">X</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <strong>Data yang TETAP tersimpan:</strong> User & Identitas Toko
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Ketik <span className="text-red-600 dark:text-red-400 font-mono bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">RESET SEMUA DATA</span> untuk konfirmasi:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Ketik: RESET SEMUA DATA"
            className="w-full px-4 py-3 rounded-xl border-2 border-red-300 dark:border-red-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
            autoFocus
          />
          {confirmText && confirmText !== 'RESET SEMUA DATA' && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              Teks tidak sesuai! Harus persis: RESET SEMUA DATA
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmReset(false)
              setConfirmText('')
            }}
            className="flex-1"
            disabled={resetting}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleReset}
            loading={resetting}
            disabled={confirmText !== 'RESET SEMUA DATA'}
            className="flex-1"
          >
            <AlertTriangle size={16} />
            {resetting ? 'Menghapus...' : 'Ya, Reset Semua Data'}
          </Button>
        </div>
      </div>
    </Modal>
  )

  if (activeCategory) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveCategory(null)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {CATEGORIES.find(c => c.id === activeCategory)?.description}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {activeCategory === 'tampilan' && (
            <TampilanSettings
              color={color}
              mode={mode}
              customColor={customColor}
              setCustomColor={setCustomColor}
              setColor={setColor}
              setMode={setMode}
            />
          )}
          {activeCategory === 'akun' && (
            <AkunSettings
              user={user}
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              savingProfile={savingProfile}
              handleSaveProfile={handleSaveProfile}
              handlePhotoUpload={handlePhotoUpload}
              passwordForm={passwordForm}
              updatePasswordField={updatePasswordField}
              handleChangePassword={handleChangePassword}
              changingPassword={changingPassword}
              contactDeveloperForPassword={contactDeveloperForPassword}
            />
          )}
          {activeCategory === 'sinkronisasi' && (
            <SinkronisasiSettings
              syncStatus={syncStatus}
              syncForm={syncForm}
              setSyncForm={setSyncForm}
              syncLoading={syncLoading}
              syncQr={syncQr}
              pairingText={pairingText}
              setPairingText={setPairingText}
              isAndroidSyncClient={isAndroidSyncClient}
              isSyncClient={isSyncClient}
              saveSync={saveSync}
              testSync={testSync}
              rotateSyncToken={rotateSyncToken}
              copyPairingData={copyPairingData}
              applyPairingData={applyPairingData}
            />
          )}
          {activeCategory === 'toko' && (
            <TokoSettings
              identitas={identitas}
              f={f}
              loading={loading}
              saveIdentitas={saveIdentitas}
            />
          )}
          {activeCategory === 'perangkat' && (
            <PerangkatSettings
              identitas={identitas}
              f={f}
              loading={loading}
              saveIdentitas={saveIdentitas}
            />
          )}
          {activeCategory === 'notifikasi' && (
            <NotifikasiSettings
              identitas={identitas}
              f={f}
              loading={loading}
              saveIdentitas={saveIdentitas}
            />
          )}
          {activeCategory === 'backup' && (
            <BackupSettings
              industrySettings={industrySettings}
              changeIndustrySetting={changeIndustrySetting}
              industryLoading={industryLoading}
              saveIndustrySettings={saveIndustrySettings}
            />
          )}
          {activeCategory === 'jaringan' && (
            <JaringanSettings
              industrySettings={industrySettings}
              changeIndustrySetting={changeIndustrySetting}
              changeAiProvider={changeAiProvider}
              aiModels={aiModels}
              loadingAiModels={loadingAiModels}
              testingAi={testingAi}
              testingSheets={testingSheets}
              industryLoading={industryLoading}
              loadAiModels={loadAiModels}
              testAiConnection={testAiConnection}
              testGoogleSheets={testGoogleSheets}
              saveIndustrySettings={saveIndustrySettings}
              copyGoogleSheetsScript={copyGoogleSheetsScript}
              openAppsScript={openAppsScript}
            />
          )}
          {activeCategory === 'tentang' && <TentangSettings openResetDialog={openResetDialog} />}
        </div>
        {resetModalNode}
      </div>
    )
  }

  return (
    <div className="space-y-5 select-none">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Pengaturan Sistem</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Kelola identitas toko, format struk, tema aplikasi, keamanan, hingga sinkronisasi data.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari pengaturan (toko, printer, tema, akun, backup)..."
          className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-600 shadow-sm transition-all"
        />
      </div>

      {/* Grouped Settings Cards with Dividers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-red-600/60 hover:shadow-md transition-all text-left group active:scale-[0.99]"
          >
            <div className={`w-11 h-11 rounded-xl ${cat.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
              {cat.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
                  {cat.label}
                </p>
                <ChevronLeft size={15} className="text-slate-300 dark:text-slate-600 rotate-180 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {cat.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
          <Search size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada pengaturan ditemukan</p>
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center pt-2">WariPOS • Semua perubahan preferensi disimpan secara otomatis</p>

      {resetModalNode}
    </div>
  )
}

// ─── Sub-page Components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600" />
    </label>
  )
}

function SettingRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pt-2 pb-1 px-1">{children}</p>
}

function TampilanSettings({ color, mode, customColor, setCustomColor, setColor, setMode }: {
  color: string; mode: string; customColor: string; setCustomColor: (v: string) => void
  setColor: (v: ThemeColor) => void; setMode: (v: 'light' | 'dark') => void
}) {
  return (
    <div className="space-y-3">
      <SectionTitle>Mode Tampilan</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(['light', 'dark'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              mode === m
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary-300'
            }`}
          >
            {m === 'light' ? <Sun size={16} /> : <Moon size={16} />}
            {m === 'light' ? 'Light Mode' : 'Dark Mode'}
          </button>
        ))}
      </div>

      <SectionTitle>Tema Warna</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {COLORS.map(c => (
          <button
            key={c.key}
            onClick={() => setColor(c.key)}
            className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
              color === c.key
                ? 'shadow-md scale-[1.02]'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
            style={{
              color: c.hex,
              borderColor: color === c.key ? c.hex : undefined,
              backgroundColor: color === c.key ? `${c.hex}15` : undefined,
            }}
          >
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
            {c.label}
            {color === c.key && <CheckCircle2 size={14} className="shrink-0" style={{ color: c.hex }} />}
          </button>
        ))}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-all relative overflow-hidden ${
            color.startsWith('#')
              ? 'border-dashed shadow-md scale-[1.02]'
              : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-primary-400'
          }`}
          style={{ borderColor: color.startsWith('#') ? customColor : undefined }}
        >
          <input
            type="color"
            value={customColor}
            onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value) }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <span className="w-4 h-4 rounded-full shadow-sm border border-white" style={{ backgroundColor: customColor }} />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Custom</span>
          {color.startsWith('#') && <CheckCircle2 size={14} className="shrink-0 text-slate-500" />}
        </div>
      </div>
      {color.startsWith('#') && (
        <p className="text-[10px] text-slate-400 font-mono px-1">Custom Color: {color.toUpperCase()}</p>
      )}
    </div>
  )
}

function AkunSettings({ user, profileForm, setProfileForm, savingProfile, handleSaveProfile, handlePhotoUpload, passwordForm, updatePasswordField, handleChangePassword, changingPassword, contactDeveloperForPassword }: {
  user: any; profileForm: any; setProfileForm: (fn: any) => void; savingProfile: boolean; handleSaveProfile: () => void
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  passwordForm: any; updatePasswordField: (k: 'current' | 'next' | 'confirm', v: string) => void
  handleChangePassword: () => void; changingPassword: boolean; contactDeveloperForPassword: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-3">
      <SectionTitle>Profil Pengguna</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-400 transition-colors"
          >
            {profileForm.foto ? (
              <img src={profileForm.foto} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                <User size={28} />
                <span className="text-[9px] mt-0.5">Upload</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">Ganti</span>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Foto Profil</p>
            <p className="text-[11px] text-slate-400">Klik untuk upload. Maks 2MB.</p>
          </div>
        </div>
        <Input
          label="Nama Lengkap"
          value={profileForm.nama_lengkap}
          onChange={e => setProfileForm((prev: any) => ({ ...prev, nama_lengkap: e.target.value }))}
          placeholder="Nama lengkap Anda"
          icon={<User size={16} />}
        />
        <Input
          label="Email"
          type="email"
          value={profileForm.email}
          onChange={e => setProfileForm((prev: any) => ({ ...prev, email: e.target.value }))}
          placeholder="email@contoh.com"
        />
        <Input
          label="No. Telepon"
          value={profileForm.no_telp}
          onChange={e => setProfileForm((prev: any) => ({ ...prev, no_telp: e.target.value }))}
          placeholder="08xxxxxxxxxx"
        />
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Username</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.nama_pengguna ?? '-'}</p>
          </div>
          <Fingerprint size={20} className="text-primary-500" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Role</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.hak_akses ?? 'user'}</p>
          </div>
        </div>
        <Button
          type="button"
          loading={savingProfile}
          onClick={handleSaveProfile}
          className="w-full"
        >
          Simpan Profil
        </Button>
      </div>

      <SectionTitle>Ganti Sandi</SectionTitle>
      <div className="space-y-3">
        <Input
          label="Sandi Saat Ini"
          type="password"
          value={passwordForm.current}
          onChange={e => updatePasswordField('current', e.target.value)}
          autoComplete="current-password"
        />
        <Input
          label="Sandi Baru"
          type="password"
          value={passwordForm.next}
          onChange={e => updatePasswordField('next', e.target.value)}
          autoComplete="new-password"
          helperText="Minimal 8 karakter dengan huruf besar, kecil, angka, dan simbol"
        />
        <Input
          label="Konfirmasi Sandi Baru"
          type="password"
          value={passwordForm.confirm}
          onChange={e => updatePasswordField('confirm', e.target.value)}
          autoComplete="new-password"
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
          Setelah sandi diganti, semua sesi lama dicabut dan Anda perlu login ulang.
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={contactDeveloperForPassword}
            icon={<MessageCircle size={14} />}
            className="w-full"
          >
            Lupa Sandi?
          </Button>
          <Button
            type="button"
            loading={changingPassword}
            onClick={handleChangePassword}
            className="w-full"
          >
            Simpan Sandi Baru
          </Button>
        </div>
      </div>

      <SectionTitle>Sesi & Akun</SectionTitle>
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 p-4 space-y-3">
        <div>
          <p className="text-xs font-bold text-red-700 dark:text-red-400">Keluar dari Akun</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Selesaikan shift kerja dan akhiri sesi login pada perangkat ini.</p>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={() => window.dispatchEvent(new CustomEvent('auth:request-logout'))}
          icon={<LogOut size={15} />}
          className="w-full"
        >
          Keluar dari Akun
        </Button>
      </div>
    </div>
  )
}

function SinkronisasiSettings({ syncStatus, syncForm, setSyncForm, syncLoading, syncQr, pairingText, setPairingText, isAndroidSyncClient, isSyncClient, saveSync, testSync, rotateSyncToken, copyPairingData, applyPairingData }: any) {
  return (
    <div className="space-y-3">
      {!isAndroidSyncClient && (
        <>
          <SectionTitle>Mode</SectionTitle>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSyncForm((prev: any) => ({ ...prev, mode: 'server' }))}
              className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                syncForm.mode === 'server'
                  ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Server Developer
            </button>
            <button
              type="button"
              onClick={() => setSyncForm((prev: any) => ({ ...prev, mode: 'client' }))}
              className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                syncForm.mode === 'client'
                  ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Client Device
            </button>
          </div>
        </>
      )}

      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {isSyncClient ? 'Mode Client ke Server' : 'Server Developer Pusat'}
          </p>
          <p className={`text-xs mt-0.5 ${syncStatus?.running || syncForm.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            {isSyncClient ? (syncForm.enabled ? 'Aktif' : 'Offline lokal') : (syncStatus?.running ? 'Aktif' : 'Nonaktif')}
          </p>
        </div>
        <Toggle checked={syncForm.enabled} onChange={v => setSyncForm((prev: any) => ({ ...prev, enabled: v }))} />
      </SettingRow>

      {isSyncClient ? (
        <div className="space-y-3">
          {!isAndroidSyncClient && (
            <Input label="Nama Device" value={syncForm.deviceName} onChange={e => setSyncForm((prev: any) => ({ ...prev, deviceName: e.target.value }))} placeholder="Kasir Windows 1" />
          )}
          <Input label="URL Server Developer" value={syncForm.baseUrl} onChange={e => setSyncForm((prev: any) => ({ ...prev, baseUrl: e.target.value }))} placeholder="http://192.168.1.10:38573" icon={<Wifi size={16} />} helperText="Bisa HTTP untuk IP LAN privat, atau HTTPS untuk domain produksi." />
          <Input label="Token" value={syncForm.token} onChange={e => setSyncForm((prev: any) => ({ ...prev, token: e.target.value }))} placeholder="Token dari server developer" />
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Pairing QR</label>
            <textarea
              value={pairingText}
              onChange={e => setPairingText(e.target.value)}
              placeholder="Tempel data pairing dari QR desktop"
              className="w-full min-h-[90px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <Button type="button" variant="secondary" onClick={applyPairingData} icon={<QrCode size={14} />} className="w-full">Terapkan Pairing</Button>
          </div>
          {syncStatus?.client?.lastConnectedAt && (
            <p className="text-xs text-slate-400">Terakhir tersambung: {new Date(syncStatus.client.lastConnectedAt).toLocaleString('id-ID')}</p>
          )}
          {syncStatus?.client?.lastError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">{syncStatus.client.lastError}</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input label="Port" type="number" value={syncForm.port} onChange={e => setSyncForm((prev: any) => ({ ...prev, port: e.target.value }))} />
          <Input label="Token" value={syncForm.token} onChange={e => setSyncForm((prev: any) => ({ ...prev, token: e.target.value }))} />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">URL Server Developer</p>
            {(syncStatus?.urls ?? []).map((url: string) => (
              <div key={url} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{url}</div>
            ))}
          </div>
          {syncQr && (
            <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
              <img src={syncQr} alt="QR pairing" className="w-[180px] h-[180px] rounded-lg bg-white p-2" />
              <div className="flex flex-col justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">QR Pairing Device</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">QR berisi URL desktop dan token sinkronisasi.</p>
                </div>
                <Button type="button" variant="secondary" onClick={copyPairingData} icon={<Copy size={14} />} className="w-full">Salin Data Pairing</Button>
              </div>
            </div>
          )}
          {syncStatus?.lastRequestAt && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              Request terakhir: {syncStatus.lastChannel || '-'} pada {new Date(syncStatus.lastRequestAt).toLocaleString('id-ID')} ({syncStatus.requestCount || 0} request)
            </div>
          )}
          {(syncStatus?.devices ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Device Terhubung</p>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {(syncStatus.devices ?? []).map((device: any) => (
                  <div key={device.deviceId} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{device.deviceName || 'Device POS'}</p>
                        <p className="mt-0.5 truncate text-slate-400">{device.address || '-'} - {device.lastChannel || '-'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{device.requestCount || 0} req</span>
                    </div>
                    <p className="mt-1 text-slate-400">Terakhir: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('id-ID') : '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {syncStatus?.error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">{syncStatus.error}</div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button loading={syncLoading} onClick={saveSync} className="w-full">Simpan Sinkronisasi</Button>
        <Button variant="secondary" loading={syncLoading} onClick={testSync} icon={<RefreshCw size={14} />} className="w-full">Tes Koneksi</Button>
        {!isAndroidSyncClient && !isSyncClient && (
          <Button variant="secondary" loading={syncLoading} onClick={rotateSyncToken} className="w-full">Ganti Token</Button>
        )}
      </div>
    </div>
  )
}

function TokoSettings({ identitas, f, loading, saveIdentitas }: any) {
  const { posMode, setPosMode } = useAppStore()

  return (
    <div className="space-y-4">
      <SectionTitle>Mode Operasional Bisnis</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Mode Toko Retail */}
        <div
          onClick={() => setPosMode('retail')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            posMode === 'retail'
              ? 'border-2 border-red-600 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-600/30 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${posMode === 'retail' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Store size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Mode Toko / Retail</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Minimarket, Fashion, Retail</p>
              </div>
            </div>
            {posMode === 'retail' && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                AKTIF
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Layout kasir cepat, scan barcode langsung, tanpa opsi nomor meja & menyembunyikan menu dapur F&B.
          </p>
        </div>

        {/* Mode Restoran & Kafe */}
        <div
          onClick={() => setPosMode('restaurant')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            posMode === 'restaurant'
              ? 'border-2 border-red-600 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-600/30 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${posMode === 'restaurant' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <UtensilsCrossed size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Mode Restoran & F&B</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Resto, Cafe, Rumah Makan</p>
              </div>
            </div>
            {posMode === 'restaurant' && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                AKTIF
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Mengaktifkan tata letak denah meja, reservasi meja, resep makanan & pesanan Dine-in.
          </p>
        </div>
      </div>

      <SectionTitle>Identitas Toko</SectionTitle>
      <div className="space-y-3">
        <Input label="Nama Toko" value={identitas.namatoko ?? ''} onChange={e => f('namatoko', e.target.value)} />
        <Input label="No. Telepon" value={identitas.nomortelptoko ?? ''} onChange={e => f('nomortelptoko', e.target.value)} />
        <Input label="No. WhatsApp Owner" value={identitas.nomorwaowner ?? ''} onChange={e => f('nomorwaowner', e.target.value)} />
        <Input label="Email Owner" value={identitas.alamatemailowner ?? ''} onChange={e => f('alamatemailowner', e.target.value)} />
        <Input label="Alamat Toko" value={identitas.alamattoko ?? ''} onChange={e => f('alamattoko', e.target.value)} />
      </div>

      <SectionTitle>Pajak (PPN)</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input label="Persentase PPN (%)" type="number" value={identitas.pajak_persen ?? 0} onChange={e => f('pajak_persen', Number(e.target.value))} placeholder="0" />
            <p className="text-xs text-slate-400 mt-1">Isi 0 untuk menonaktifkan pajak.</p>
          </div>
          <div className="shrink-0 text-center px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{identitas.pajak_persen ?? 0}%</p>
          </div>
        </div>
      </div>

      <SectionTitle>Struk</SectionTitle>
      <div className="space-y-3">
        <SettingRow>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto Print Struk</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Cetak struk otomatis setelah transaksi</p>
          </div>
          <Toggle checked={identitas.auto_print === 1} onChange={v => f('auto_print', v ? 1 : 0)} />
        </SettingRow>
        <Input label="Footer Struk" value={identitas.struk_footer ?? 'Terima kasih atas kunjungan Anda'} onChange={e => f('struk_footer', e.target.value)} placeholder="Terima kasih..." />
      </div>

      <SectionTitle>Barcode</SectionTitle>
      <div className="space-y-3">
        <SettingRow>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto-generate Barcode</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generate barcode otomatis untuk produk baru</p>
          </div>
          <Toggle checked={identitas.auto_barcode === 1} onChange={v => f('auto_barcode', v ? 1 : 0)} />
        </SettingRow>
        <Input label="Prefix Barcode" value={identitas.barcode_prefix ?? 'POS'} onChange={e => f('barcode_prefix', e.target.value)} placeholder="POS" />
        <p className="text-xs text-slate-400">Contoh: POS0001, POS0002, dst.</p>
      </div>

      <Button loading={loading} onClick={saveIdentitas} className="w-full">Simpan Pengaturan Toko</Button>
    </div>
  )
}

function PerangkatSettings({ identitas, f, loading, saveIdentitas }: any) {
  return (
    <div className="space-y-3">
      <SectionTitle>Device Info</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Platform</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{navigator.userAgent.includes('Mobile') ? 'Android' : 'Desktop'}</p>
        </div>
        <Monitor size={20} className="text-primary-500" />
      </SettingRow>

      <SectionTitle>Data & Penyimpanan</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Lokal Database</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">SQLite via Drizzle ORM</p>
        </div>
        <Database size={20} className="text-emerald-500" />
      </SettingRow>

      <Button loading={loading} onClick={saveIdentitas} className="w-full">Simpan Pengaturan Perangkat</Button>
    </div>
  )
}

function NotifikasiSettings({ identitas, f, loading, saveIdentitas }: any) {
  return (
    <div className="space-y-3">
      <SectionTitle>Notifikasi Stok</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifikasi Stok Menipis</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tampilkan notifikasi saat stok produk menipis</p>
        </div>
        <Toggle checked={identitas.notif_stok === 1} onChange={v => f('notif_stok', v ? 1 : 0)} />
      </SettingRow>
      <Input label="Batas Stok Minimum" type="number" value={identitas.min_stok ?? 5} onChange={e => f('min_stok', parseInt(e.target.value, 10) || 5)} placeholder="5" />
      <p className="text-xs text-slate-400">Notifikasi muncul jika stok produk kurang dari atau sama dengan nilai ini.</p>

      <Button loading={loading} onClick={saveIdentitas} className="w-full">Simpan Pengaturan Notifikasi</Button>
    </div>
  )
}

function BackupSettings({ industrySettings, changeIndustrySetting, industryLoading, saveIndustrySettings }: any) {
  return (
    <div className="space-y-3">
      <SectionTitle>Auto Backup Database</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto Backup Harian</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Backup database otomatis setiap hari pukul 23:00</p>
        </div>
        <Toggle checked={industrySettings.autoBackupEnabled} onChange={v => changeIndustrySetting('autoBackupEnabled', v)} />
      </SettingRow>
      <Input label="Retensi Backup (hari)" type="number" min={1} max={365} value={industrySettings.backupRetentionDays} onChange={e => changeIndustrySetting('backupRetentionDays', Number(e.target.value))} />

      <SectionTitle>Google Sheets</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Export Google Sheets Otomatis</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gunakan URL Web App Apps Script</p>
        </div>
        <Toggle checked={industrySettings.googleSheetsEnabled} onChange={v => changeIndustrySetting('googleSheetsEnabled', v)} />
      </SettingRow>
      <Input label="Apps Script Web App URL" value={industrySettings.googleSheetsWebAppUrl} onChange={e => changeIndustrySetting('googleSheetsWebAppUrl', e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" icon={<FileSpreadsheet size={16} />} helperText="Buat script dari file Google Sheets target, deploy sebagai Web App, lalu tempel URL /exec di sini." />
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT).then(() => {}) } icon={<Code2 size={14} />} className="w-full">Salin Template Script</Button>
      </div>

      <Button loading={industryLoading} onClick={saveIndustrySettings} className="w-full">Simpan Pengaturan Backup</Button>
    </div>
  )
}

function JaringanSettings({ industrySettings, changeIndustrySetting, changeAiProvider, aiModels, loadingAiModels, testingAi, testingSheets, industryLoading, loadAiModels, testAiConnection, testGoogleSheets, saveIndustrySettings, copyGoogleSheetsScript, openAppsScript }: any) {
  return (
    <div className="space-y-3">
      <SectionTitle>Asisten AI</SectionTitle>
      <SettingRow>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">AI Online Opsional</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Fallback lokal tetap aktif saat API tidak tersedia</p>
        </div>
        <Toggle checked={industrySettings.aiEnabled} onChange={v => changeIndustrySetting('aiEnabled', v)} />
      </SettingRow>

      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Provider AI</label>
          <select
            value={industrySettings.aiProvider}
            onChange={e => changeAiProvider(e.target.value as AiProvider)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <option value="local">Lokal gratis</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom OpenAI-Compatible</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openrouter">OpenRouter</option>
            <option value="bluesminds">BluesMinds</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Model</label>
          <div className="flex gap-2">
            {aiModels.length > 0 ? (
              <select
                value={industrySettings.aiModel}
                onChange={e => changeIndustrySetting('aiModel', e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                {aiModels.map((model: string) => <option key={model} value={model}>{model}</option>)}
              </select>
            ) : (
              <input
                value={industrySettings.aiModel}
                onChange={e => changeIndustrySetting('aiModel', e.target.value)}
                placeholder={defaultModelForProvider(industrySettings.aiProvider) || 'nama-model'}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            )}
            {industrySettings.aiProvider !== 'local' && (
              <Button type="button" variant="secondary" loading={loadingAiModels} onClick={loadAiModels} icon={<RefreshCw size={14} />} className="shrink-0">Model</Button>
            )}
          </div>
        </div>
      </div>

      {industrySettings.aiProvider !== 'local' && (
        <div className="space-y-3">
          <Input label="API Key AI" type="password" value={industrySettings.aiApiKey} onChange={e => changeIndustrySetting('aiApiKey', e.target.value)} placeholder="Masukkan API key provider" icon={<KeyRound size={16} />} />
          <Input label="Base URL" value={industrySettings.aiBaseUrl} onChange={e => changeIndustrySetting('aiBaseUrl', e.target.value)} placeholder={industrySettings.aiProvider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : appConfig.aiProviderUrl || defaultBaseUrlForProvider(industrySettings.aiProvider)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="secondary" loading={testingAi} onClick={testAiConnection} icon={<Bot size={14} />} className="w-full">Tes Koneksi AI</Button>
      </div>

      <SectionTitle>Integrasi</SectionTitle>
      <div className="flex flex-col gap-2">
        <Button variant="secondary" loading={testingSheets} onClick={testGoogleSheets} icon={<CheckCircle2 size={14} />} className="w-full">Tes Google Sheets</Button>
        <Button variant="secondary" onClick={copyGoogleSheetsScript} icon={<Code2 size={14} />} className="w-full">Salin Template Script</Button>
        <Button variant="ghost" onClick={openAppsScript} icon={<ExternalLink size={14} />} className="w-full">Buka Apps Script</Button>
      </div>

      <Button loading={industryLoading} onClick={saveIndustrySettings} className="w-full">Simpan Pengaturan Jaringan</Button>
    </div>
  )
}

function TentangSettings({ openResetDialog }: { openResetDialog?: () => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [seeding, setSeeding] = useState(false)
  const [confirmSeed, setConfirmSeed] = useState(false)
  const [supportWa, setSupportWa] = useState(() => {
    try {
      return localStorage.getItem('zetass_support_wa_number') || SUBSCRIPTION_UPGRADE_WA_NUMBER
    } catch {
      return SUBSCRIPTION_UPGRADE_WA_NUMBER
    }
  })

  const handleSaveSupportWa = () => {
    try {
      localStorage.setItem('zetass_support_wa_number', supportWa.trim())
      toast('Nomor WhatsApp Admin / CS berhasil disimpan!', 'success')
    } catch {
      toast('Gagal menyimpan nomor WhatsApp', 'error')
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const r = await api<any>('system:seedSampleData')
      if (r.success) {
        toast(r.message || 'Data contoh toko berhasil dimuat!', 'success')
        setConfirmSeed(false)
      } else {
        toast(r.message || 'Gagal memuat data demo', 'error')
      }
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* App Info Minimal Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
        <img src={appLogo} alt="WariPOS" className="w-16 h-16 object-contain drop-shadow-sm mx-auto" />
        <div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">WariPOS</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 text-[10px] font-bold">v.1.0.0</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sistem Kasir & Pembukuan Pintar</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
          <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
            Pengembang: WalZetass-Kar
          </span>
          <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
            Offline-First SQLite
          </span>
        </div>
      </div>

      {/* Developer Panel Quick Access for Developer Role */}
      {(user?.hak_akses === 'developer' || user?.hak_akses === 'super_admin') && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-bold text-xs">
            <Shield size={16} className="text-indigo-600" />
            <span>Developer Panel & Lisensi (Mobile/Desktop)</span>
          </div>
          <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
            Kelola pelanggan, aktivasi lisensi, reset password user toko, dan ubah paket langganan langsung dari aplikasi ini.
          </p>
          <Button
            onClick={() => navigate('/license-admin')}
            icon={<ExternalLink size={14} />}
            className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
          >
            Buka Developer Panel
          </Button>
        </div>
      )}

      {/* Support WhatsApp Configuration (Restricted to Developer/SuperAdmin) */}
      {(user?.hak_akses === 'developer' || user?.hak_akses === 'super_admin') && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-emerald-500" />
              <span>Nomor WhatsApp Bantuan / Admin CS (Developer Only)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Nomor tujuan saat pelanggan atau kasir mengklik tombol bantuan / upgrade paket (default: 08988098238).
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={supportWa}
              onChange={e => setSupportWa(e.target.value)}
              placeholder="08988098238"
              className="text-xs"
            />
            <Button
              variant="secondary"
              onClick={handleSaveSupportWa}
              className="shrink-0 text-xs font-bold"
            >
              Simpan Nomor
            </Button>
          </div>
        </div>
      )}

      {/* Demo Seeding */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Muat Data Contoh / Demo Toko</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Otomatis mengisi 20+ produk, meja restoran, customer, dan riwayat transaksi untuk simulasi.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<PackagePlus size={14} />}
          onClick={() => setConfirmSeed(true)}
          className="w-full text-xs font-bold"
        >
          Muat Data Contoh Toko
        </Button>

        <ConfirmDialog
          open={confirmSeed}
          onClose={() => setConfirmSeed(false)}
          onConfirm={handleSeed}
          title="Muat Data Contoh Toko"
          message="Apakah Anda yakin ingin memuat data contoh toko? Tindakan ini akan menambahkan 20+ produk, meja restoran, customer, supplier, dan transaksi simulasi ke sistem."
          confirmText="Ya, Muat Data Contoh"
          variant="warning"
          loading={seeding}
        />
      </div>

      {/* Factory Reset Zone with Sound Warning */}
      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2.5">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
          <AlertTriangle size={16} className="text-red-500" />
          <span>Zona Berbahaya - Reset Data Toko</span>
        </div>
        <p className="text-[11px] text-red-600/80 dark:text-red-400/80 leading-relaxed">
          Menghapus seluruh transaksi penjualan, pembelian, produk, stok, dan kas kembali ke kondisi awal.
        </p>
        <Button
          onClick={openResetDialog}
          icon={<Trash2 size={14} />}
          className="w-full text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/30"
        >
          Reset Semua Data (Factory Reset)
        </Button>
      </div>
    </div>
  )
}
