import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Key,
  Zap,
  Package,
  BarChart3,
  CheckCircle2,
  Fingerprint,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import appLogo from '../assets/app-logo.png'
import { api } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { openWhatsApp, openWhatsAppUpgrade, SUBSCRIPTION_UPGRADE_WA_NUMBER } from '../utils/whatsapp'
import type { UserSession, Identitas } from '../../shared/types'
import { validatePasswordStrength } from '../../shared/passwordPolicy'
import { secureStorage } from '../utils/secureStorage'
import { collectAuthDeviceInfo } from '../utils/authDevice'
import { tryCloudSignIn } from '../../shared/supabase/auth'
import { SkeletonSpinner } from '../components/Skeleton'
import { biometric } from '../utils/biometric'

interface PublicPlan {
  name: string
  price: number
  duration_days: number
  is_recommended?: boolean
}

function formatPrice(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function getPlanPeriod(days: number): string {
  if (days === 0) return '/seumur hidup'
  if (days === 1) return '/hari'
  if (days === 7) return '/minggu'
  if (days >= 28 && days <= 31) return '/bulan'
  if (days >= 360 && days <= 366) return '/tahun'
  return `/${days} hari`
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [hasUsers, setHasUsers] = useState(true)
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [authLoading, setAuthLoading] = useState(true)
  const [activePlans, setActivePlans] = useState<PublicPlan[]>([])
  const [setupForm, setSetupForm] = useState({
    username: '',
    nama_lengkap: '',
    email: '',
    no_telp: '',
    password: '',
    confirmPassword: '',
  })
  const [forcePasswordUser, setForcePasswordUser] = useState<UserSession | null>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  // Identitas dialog state
  const [showIdentitas, setShowIdentitas] = useState(false)
  const [pendingUser, setPendingUser] = useState<UserSession | null>(null)
  const [identitas, setIdentitas] = useState<Partial<Identitas>>({})
  const [savingIdentitas, setSavingIdentitas] = useState(false)

  useEffect(() => {
    biometric.isAvailable().then(res => {
      setBiometricAvailable(res.isAvailable || Capacitor.isNativePlatform())
    })
  }, [])

  // Block navigation while identitas modal is open
  useEffect(() => {
    if (!showIdentitas) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [showIdentitas])

  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        await secureStorage.ready(['rememberMe', 'pos_session', 'auth_device_id'])
      } catch {
        // Storage mirror fallback
      }

      try {
        const remembered = secureStorage.getItem('rememberMe')
        if (remembered) {
          const { username: savedUser } = JSON.parse(remembered)
          if (savedUser) {
            setUsername(savedUser)
            secureStorage.setJSON('rememberMe', { username: savedUser })
          }
          setRememberMe(true)
        }
      } catch {
        secureStorage.removeItem('rememberMe')
      }

      try {
        const dbRes = await api<{ connected: boolean }>('system:checkDb')
        setDbStatus(dbRes.success ? 'connected' : 'error')
      } catch {
        setDbStatus('error')
      }

      try {
        const userRes = await api<boolean>('auth:hasUsers')
        if (userRes.success && userRes.data === false) {
          setHasUsers(false)
          setAuthView('register')
        }
      } catch {}

      try {
        const plansRes = await api<PublicPlan[]>('license:getPublicPlans')
        if (plansRes.success && plansRes.data) {
          setActivePlans(plansRes.data)
        }
      } catch {}

      setAuthLoading(false)
    }

    void checkStatus()
  }, [])

  useEffect(() => {
    if (!authLoading && !username) {
      usernameRef.current?.focus()
    }
  }, [authLoading, authView])

  const completeLogin = async (user: UserSession) => {
    if (rememberMe) {
      secureStorage.setJSON('rememberMe', { username: user.nama_pengguna })
    } else {
      secureStorage.removeItem('rememberMe')
    }

    const credSecret = password || pin
    if (credSecret) {
      void biometric.saveCredentials(user.nama_pengguna, credSecret)
    }

    const identitasCheck = await api<{ hasIdentitas: boolean }>('auth:checkIdentitas')
    if (!identitasCheck.data?.hasIdentitas) {
      setPendingUser(user)
      setShowIdentitas(true)
      return
    }

    login(user)
    toast('Login berhasil! Selamat datang ' + user.nama_lengkap, 'success')
    navigate('/', { replace: true })
  }

  const handleTrialRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!setupForm.username.trim() || !setupForm.nama_lengkap.trim()) {
      setError('Username dan nama lengkap wajib diisi')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setupForm.email.trim())) {
      setError('Email valid wajib diisi')
      return
    }

    const strength = validatePasswordStrength(setupForm.password)
    if (!strength.valid) {
      setError(strength.message || 'Password belum memenuhi syarat')
      return
    }
    if (setupForm.password !== setupForm.confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const deviceInfo = collectAuthDeviceInfo()
      const r = await api<UserSession | { user?: UserSession; customer?: any; sessionToken?: string; nama_pengguna?: string }>(
        'auth:registerTrial',
        {
          name: setupForm.nama_lengkap.trim(),
          nama_lengkap: setupForm.nama_lengkap.trim(),
          username: setupForm.username.trim(),
          email: setupForm.email.trim(),
          phone: setupForm.no_telp.trim() || undefined,
          no_telp: setupForm.no_telp.trim() || undefined,
          password: setupForm.password,
          deviceInfo,
        },
        deviceInfo
      )

      const userSession = (r.data as any)?.user ?? ((r.data as any)?.nama_pengguna ? (r.data as unknown as UserSession) : undefined)
      if (r.success && userSession) {
        toast('Pendaftaran akun trial berhasil!', 'success')
        await completeLogin(userSession)
      } else {
        setError(r.message || 'Pendaftaran trial gagal')
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem saat mendaftar')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Username / email wajib diisi')
      return
    }

    if (loginMode === 'pin') {
      if (!pin || pin.length < 4) {
        setError('PIN kasir minimal 4 digit angka')
        return
      }
      setLoading(true)
      try {
        const deviceInfo = collectAuthDeviceInfo()
        const r = await api<UserSession>('auth:verifyPinKasir', username.trim(), pin, deviceInfo)
        if (r.success && r.data) {
          if (r.data.must_change_password) {
            setForcePasswordUser(r.data)
            return
          }
          await completeLogin(r.data)
        } else {
          setError(r.message || 'PIN kasir salah')
        }
      } catch (err: any) {
        setError(err.message || 'Gagal verifikasi PIN kasir')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) {
      setError('Password wajib diisi')
      return
    }

    setLoading(true)
    try {
      const deviceInfo = collectAuthDeviceInfo()
      let r = await api<UserSession>('auth:login', username.trim(), password, deviceInfo)

      if (!r.success && r.message?.toLowerCase().includes('user tidak ditemukan')) {
        const cloudUser = await tryCloudSignIn(username.trim(), password)
        if (cloudUser) {
          r = await api<UserSession>('auth:login', username.trim(), password, deviceInfo)
        }
      }

      if (r.success && r.data) {
        if (r.data.must_change_password) {
          setForcePasswordUser(r.data)
          return
        }
        await completeLogin(r.data)
      } else {
        setError(r.message || 'Username atau password salah')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke backend')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    setBiometricLoading(true)
    setError('')
    try {
      const authRes = await biometric.authenticate()
      if (!authRes.success) {
        if (authRes.message) setError(authRes.message)
        return
      }

      if (authRes.username && authRes.password) {
        let r = await api<UserSession>('auth:login', authRes.username, authRes.password, collectAuthDeviceInfo())
        if (!r.success) {
          r = await api<UserSession>('auth:verifyPinKasir', authRes.username, authRes.password, collectAuthDeviceInfo())
        }
        if (r.success && r.data) {
          await completeLogin(r.data)
          return
        }
      }

      const remembered = secureStorage.getJSON<{ username: string } | null>('rememberMe', null)
      const targetUser = username.trim() || remembered?.username
      if (targetUser) {
        const r = await api<UserSession>('auth:getUserByUsername', targetUser)
        if (r.success && r.data) {
          await completeLogin(r.data)
          return
        }
      }

      toast('Biometrik terverifikasi! Masukkan password/PIN untuk menghubungkan sesi.', 'info')
    } catch (err: any) {
      setError(err.message || 'Gagal login biometrik')
    } finally {
      setBiometricLoading(false)
    }
  }

  const handleForcedPasswordChange = async () => {
    if (!forcePasswordUser) return
    if (!oldPassword.trim()) {
      toast('Password lama wajib diisi', 'error')
      return
    }
    const strength = validatePasswordStrength(newPassword)
    if (!strength.valid) {
      toast(strength.message || 'Password baru tidak memenuhi syarat', 'error')
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast('Konfirmasi password tidak cocok', 'error')
      return
    }

    setChangingPassword(true)
    try {
      const res = await api('auth:changePassword', {
        username: forcePasswordUser.nama_pengguna,
        oldPassword,
        newPassword,
      })
      if (res.success) {
        toast('Password berhasil diganti! Silakan login kembali.', 'success')
        setForcePasswordUser(null)
        setPassword('')
        setOldPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        toast(res.message || 'Gagal mengubah password', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSaveIdentitas = async () => {
    if (!identitas.namatoko?.trim()) {
      toast('Nama toko wajib diisi', 'error')
      return
    }

    setSavingIdentitas(true)
    try {
      await api('identitas:save', identitas)
      setShowIdentitas(false)
      if (pendingUser) {
        login(pendingUser)
        toast('Identitas toko berhasil disimpan!', 'success')
        navigate('/', { replace: true })
      }
    } catch (err) {
      toast('Gagal menyimpan identitas: ' + String(err), 'error')
      setSavingIdentitas(false)
    }
  }

  const fi = (k: string, v: string) => setIdentitas(prev => ({ ...prev, [k]: v }))
  const renewalPlan = activePlans.find(plan => plan.is_recommended) ?? activePlans[0]
  const isExpiredAccessError = /masa akses|berakhir|kadaluarsa|kedaluwarsa|batas device|limit produk|batas produk|upgrade paket/i.test(error)
  const showRegisterForm = authView === 'register'

  const handleForgotPassword = () => {
    openWhatsApp(
      SUBSCRIPTION_UPGRADE_WA_NUMBER,
      [
        'Halo Developer, saya lupa sandi akun WariPOS.',
        `Username: ${username.trim() || '-'}`,
        '',
        'Mohon bantu reset sandi akun saya.',
      ].join('\n')
    )
  }

  const handleRenewAccess = () => {
    openWhatsAppUpgrade({
      phone: SUBSCRIPTION_UPGRADE_WA_NUMBER,
      planName: renewalPlan?.name ?? 'Perpanjangan Akses',
      planPrice: renewalPlan ? formatPrice(renewalPlan.price) : 'Harga menyesuaikan',
      planPeriod: renewalPlan ? getPlanPeriod(renewalPlan.duration_days) : '',
      userName: username.trim() || 'User kadaluarsa',
      storeName: null,
      email: null,
    })
  }

  if (authLoading) return <SkeletonSpinner />

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between select-none font-sans transition-colors duration-200">
      
      {/* 2-Column Split: Clean Left Brand + Focused Center Right Card */}
      <div className="flex-1 lg:grid lg:grid-cols-[1.1fr_0.9fr] w-full min-h-screen">
        
        {/* ─── LEFT BRAND PANEL ─── */}
        <div className="hidden lg:flex flex-col justify-between bg-slate-50/80 dark:bg-slate-900/60 p-12 lg:p-16 border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
          
          {/* Top Bar Logo */}
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 flex items-center justify-center">
              <img
                src={appLogo}
                alt="WariPOS"
                className="h-11 w-11 object-contain drop-shadow-sm"
              />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight block">WariPOS</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sistem Kasir & Manajemen Toko</span>
            </div>
          </div>

          {/* Core Value Statement */}
          <div className="my-auto py-10 space-y-8 max-w-lg">
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.2]">
                Kelola Toko Lebih Rapi, Cepat & Akurat.
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Dirancang untuk memudahkan operasional kasir, pelacakan stok produk, hingga laporan keuangan harian secara real-time.
              </p>
            </div>

            {/* 3 Core Highlights */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 shrink-0 mt-0.5">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Transaksi Kasir Cepat & Praktis</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mendukung scan barcode, cetak struk thermal, dan pembayaran QRIS.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 shrink-0 mt-0.5">
                  <Package size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Manajemen Stok Real-Time</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pengurangan stok otomatis dengan notifikasi stok menipis & kadaluarsa.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 shrink-0 mt-0.5">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Laporan Keuangan & Laba Rugi</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Analitik penjualan harian, bulanan, serta export data ke Excel & PDF.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <span>© 2026 WariPOS</span>
          </div>
        </div>

        {/* ─── RIGHT LOGIN CARD PANEL ─── */}
        <div className="flex flex-col justify-between items-center px-4 py-4 sm:px-8 sm:py-8 lg:p-12 bg-slate-100 dark:bg-slate-950 min-h-screen transition-colors duration-200">

          {/* Main Card Container */}
          <div className={`w-full transition-all duration-300 my-auto ${showRegisterForm ? 'max-w-lg' : 'max-w-md'}`}>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm transition-colors duration-200">
              
              {/* Card Header with Centered Logo */}
              <div className="mb-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-2.5 border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-center mb-3">
                  <img src={appLogo} alt="WariPOS" className="w-11 h-11 object-contain drop-shadow-sm" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {showRegisterForm ? 'Daftar Akun Baru' : 'Masuk ke WariPOS'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed max-w-xs">
                  {showRegisterForm
                    ? 'Lengkapi formulir untuk memulai masa trial 3 hari gratis.'
                    : 'Gunakan akun Anda untuk membuka sesi kasir & manajemen toko.'}
                </p>
              </div>

              {showRegisterForm ? (
                /* ─── REGISTER FORM ─── */
                <form onSubmit={handleTrialRegister} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nama Lengkap *</label>
                    <input
                      value={setupForm.nama_lengkap}
                      onChange={e => setSetupForm(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                      placeholder="Nama pemilik / toko"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Username *</label>
                      <input
                        value={setupForm.username}
                        onChange={e => setSetupForm(prev => ({ ...prev, username: e.target.value }))}
                        autoComplete="username"
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                        placeholder="Contoh: owner"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email *</label>
                      <input
                        type="email"
                        value={setupForm.email}
                        onChange={e => setSetupForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                        placeholder="email@toko.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">No. WhatsApp (Opsional)</label>
                    <input
                      type="tel"
                      value={setupForm.no_telp}
                      onChange={e => setSetupForm(prev => ({ ...prev, no_telp: e.target.value }))}
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                      placeholder="08123456789"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password *</label>
                      <input
                        type="password"
                        value={setupForm.password}
                        onChange={e => setSetupForm(prev => ({ ...prev, password: e.target.value }))}
                        autoComplete="new-password"
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                        placeholder="Min 8 karakter"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Konfirmasi Password *</label>
                      <input
                        type="password"
                        value={setupForm.confirmPassword}
                        onChange={e => setSetupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        autoComplete="new-password"
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                        placeholder="Ulangi password"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Trial'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthView('login'); setError('') }}
                    className="w-full text-center text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white pt-1"
                  >
                    Sudah punya akun? <span className="text-red-600 dark:text-red-400 font-bold">Masuk di sini</span>
                  </button>
                </form>
              ) : (
                /* ─── LOGIN FORM ─── */
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  
                  {/* Clean Mode Switcher (Password vs PIN) */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => { setLoginMode('password'); setError('') }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        loginMode === 'password'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Lock size={14} />
                      Password
                    </button>

                    <button
                      type="button"
                      onClick={() => { setLoginMode('pin'); setError('') }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        loginMode === 'pin'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Key size={14} />
                      PIN Kasir
                    </button>
                  </div>

                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      Username / Email
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <User size={17} />
                      </span>
                      <input
                        ref={usernameRef}
                        placeholder="Masukkan username atau email"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        autoComplete="username"
                        className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Password / PIN Field */}
                  {loginMode === 'password' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Lock size={17} />
                        </span>
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="Masukkan kata sandi"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="current-password"
                          className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-10 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                        PIN Kasir (4-8 Digit)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Key size={17} />
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          placeholder="Masukkan PIN angka"
                          value={pin}
                          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          autoComplete="off"
                          className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 text-base sm:text-lg font-mono font-bold text-center text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm tracking-widest"
                        />
                      </div>
                    </div>
                  )}

                  {/* Remember & Forgot Bar */}
                  <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                    <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-red-600 focus:ring-0"
                      />
                      Ingat Saya
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-red-600 dark:text-red-400 hover:underline font-bold"
                    >
                      Lupa Sandi?
                    </button>
                  </div>

                  {/* Error Box */}
                  {error && (
                    <div className="space-y-2">
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
                        {error}
                      </div>

                      {isExpiredAccessError && (
                        <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40">
                          <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300">Perpanjangan Lisensi</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {renewalPlan
                              ? `${renewalPlan.name} ${formatPrice(renewalPlan.price)}${getPlanPeriod(renewalPlan.duration_days)}`
                              : 'Hubungi developer untuk perpanjangan akses.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleRenewAccess}
                            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2.5 transition-colors shadow-sm"
                          >
                            <MessageCircle size={15} />
                            Hubungi WhatsApp Developer
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Memverifikasi...' : loginMode === 'pin' ? 'Masuk dengan PIN' : 'Masuk ke Kasir'}
                  </button>

                  {/* Biometric Button (Native Mobile Only) */}
                  {biometricAvailable && (
                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={biometricLoading || loading}
                      className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors shadow-sm"
                    >
                      <Fingerprint size={18} className={biometricLoading ? 'animate-pulse' : ''} />
                      {biometricLoading ? 'Memverifikasi Sidik Jari...' : 'Masuk dengan Sidik Jari'}
                    </button>
                  )}

                  {/* Register Trial Link */}
                  <div className="pt-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => { setAuthView('register'); setError('') }}
                      className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Belum punya akun? <span className="text-red-600 dark:text-red-400 font-bold">Daftar Akun Trial (3 Hari)</span>
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>

          {/* Bottom DB Indicator */}
          <div className="w-full max-w-md mt-3 pt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-200/60 dark:border-slate-800">
            <span>v1.0.0</span>
            <a
              href="https://github.com/WalZetass-kar"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (Capacitor.isNativePlatform()) {
                  e.preventDefault()
                  window.open('https://github.com/WalZetass-kar', '_blank')
                }
              }}
              className="font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              Developer By <span className="text-red-600 dark:text-red-400 underline">WalZetass-Kar</span>
            </a>
          </div>

        </div>

      </div>

      {/* Force Password Change Modal */}
      <Modal
        open={!!forcePasswordUser}
        onClose={() => {}}
        title="Ganti Password Akun"
        size="sm"
        footer={
          <Button loading={changingPassword} onClick={handleForcedPasswordChange} size="md" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold border-0">
            Simpan Password Baru
          </Button>
        }
      >
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Password akun Anda wajib diganti sebelum aplikasi dapat digunakan.
        </p>
        <div className="space-y-3">
          <Input
            label="Password Lama"
            type="password"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            helperText="Masukkan password lama Anda"
          />
          <Input
            label="Password Baru"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            helperText="Minimal 8 karakter"
          />
          <Input
            label="Konfirmasi Password Baru"
            type="password"
            value={confirmNewPassword}
            onChange={e => setConfirmNewPassword(e.target.value)}
          />
        </div>
      </Modal>

      {/* Setup Identitas Toko Modal */}
      <Modal
        open={showIdentitas}
        onClose={() => {}}
        title="Lengkapi Identitas Toko"
        size="md"
        footer={
          <Button loading={savingIdentitas} onClick={handleSaveIdentitas} size="md" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold border-0">
            Simpan & Buka Kasir
          </Button>
        }
      >
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 mb-4">
          <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-0.5">Informasi Toko</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Nama dan alamat toko akan dicetak pada struk transaksi.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            label="Nama Toko *"
            value={identitas.namatoko ?? ''}
            onChange={e => fi('namatoko', e.target.value)}
            placeholder="Contoh: Toko Berkah"
          />
          <Input
            label="Alamat Toko"
            value={identitas.alamattoko ?? ''}
            onChange={e => fi('alamattoko', e.target.value)}
            placeholder="Jl. Sudirman No. 10"
          />
          <Input
            label="No. Telepon"
            value={identitas.nomortelptoko ?? ''}
            onChange={e => fi('nomortelptoko', e.target.value)}
            placeholder="08123456789"
          />
          <Input
            label="No. WhatsApp Owner"
            value={identitas.nomorwaowner ?? ''}
            onChange={e => fi('nomorwaowner', e.target.value)}
            placeholder="08123456789"
          />
        </div>
      </Modal>

    </div>
  )
}
