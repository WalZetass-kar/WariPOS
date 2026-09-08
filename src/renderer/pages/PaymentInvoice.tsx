import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  HelpCircle,
  Laptop,
  Loader2,
  Lock,
  MessageCircle,
  Package,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Star,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { api } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useDemo } from '../contexts/DemoContext'
import { useToast } from '../contexts/ToastContext'
import { SkeletonPage } from '../components/Skeleton'
import { SUBSCRIPTION_UPGRADE_WA_NUMBER, normalizePhoneNumber } from '../utils/whatsapp'

interface PublicPlan {
  id: string | number
  code: string
  name: string
  description?: string | null
  features?: string[] | null
  feature_flags?: Record<string, boolean> | null
  price: number
  currency: string
  duration_days: number
  is_recommended?: boolean
  sort_order?: number
}

interface Invoice {
  id: string
  invoice_number: string
  external_ref: string
  payment_url: string | null
  whatsapp_number?: string | null
  whatsapp_message?: string | null
  amount: number
  currency: string
  status: string
  provider: string
  expires_at: string | null
  created_at: string
}

const ALL_SYSTEM_FEATURES = [
  { key: 'reports', label: 'Laporan & Analitik Keuangan' },
  { key: 'export_excel', label: 'Export Laporan ke Excel' },
  { key: 'export_pdf', label: 'Export Laporan ke PDF' },
  { key: 'multi_user', label: 'Multi-User & Pembatasan Role' },
  { key: 'stock_opname', label: 'Stok Opname & Penyesuaian' },
  { key: 'debt_management', label: 'Manajemen Hutang & Piutang' },
  { key: 'shift_management', label: 'Manajemen Shift Kasir' },
  { key: 'multi_branch', label: 'Multi Cabang & Gudang' },
  { key: 'return_refund', label: 'Retur Penjualan & Refund' },
  { key: 'backup', label: 'Backup & Restore Database' },
  { key: 'api_access', label: 'Akses API E-Commerce' },
]

function formatPlanPrice(plan?: { price?: number; currency?: string } | null): string {
  if (!plan) return 'Rp 0'
  const curr = !plan.currency || String(plan.currency).toUpperCase() === 'IDR' ? 'Rp' : String(plan.currency)
  return `${curr} ${Number(plan.price || 0).toLocaleString('id-ID')}`
}

function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const target = normalizePhoneNumber(phone || SUBSCRIPTION_UPGRADE_WA_NUMBER)
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`
}

function getPlanDurationLabel(durationDays?: number | null): string {
  const days = Number(durationDays ?? 30)
  if (days === 0) return 'Seumur Hidup'
  if (days <= 1) return '1 Hari'
  if (days >= 360) return '1 Tahun'
  if (days >= 28 && days <= 31) return '1 Bulan'
  return `${days} Hari`
}

export default function PaymentInvoice() {
  const { user, isDemo } = useAuth()
  const { state: demoState, remainingUsage } = useDemo()
  const toast = useToast()

  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Midtrans Payment State
  const [paymentMethod, setPaymentMethod] = useState<'midtrans' | 'whatsapp'>('whatsapp')
  const [midtransOrder, setMidtransOrder] = useState<{
    orderId: string
    token: string
    redirectUrl: string
    plan: PublicPlan
    amount: number
  } | null>(null)
  const [midtransModalOpen, setMidtransModalOpen] = useState(false)
  const [checkingMidtrans, setCheckingMidtrans] = useState(false)
  const [midtransStatusText, setMidtransStatusText] = useState('Menunggu pembayaran dari Anda...')
  const [midtransSuccess, setMidtransSuccess] = useState(false)

  // Load plans from server / local database
  const loadPlans = async () => {
    setLoading(true)
    const r = await api<PublicPlan[]>('license:getPublicPlans')
    if (r.success) {
      const rows = (r.data ?? []).sort((a, b) => (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)) || (Number(a.price) - Number(b.price)))
      setPlans(rows)
      setSelectedCode(current => current || rows.find(p => p.is_recommended || p.duration_days === 0)?.code || rows[0]?.code || '')
    } else {
      toast(r.message || 'Gagal memuat daftar paket', 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadPlans()
  }, [])

  // Sync email when user updates
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
  }, [user?.email])

  // Listen to realtime license updates
  useEffect(() => {
    const onLicenseUpdated = () => {
      void loadPlans()
    }
    window.addEventListener('license:updated', onLicenseUpdated)
    return () => window.removeEventListener('license:updated', onLicenseUpdated)
  }, [])

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.code === selectedCode) ?? plans[0] ?? null,
    [plans, selectedCode],
  )

  // Manual instant sync triggered by user
  const handleSyncNow = async () => {
    if (!user?.nama_pengguna) return
    setSyncing(true)
    try {
      const res = await api<any>('license:syncBuyerLicense', user.nama_pengguna)
      window.dispatchEvent(new Event('license:sync-now'))
      if (res.success) {
        toast('Lisensi berhasil disinkronkan secara realtime!', 'success')
      } else {
        toast(res.message || 'Gagal sinkronisasi lisensi', 'info')
      }
    } catch {
      toast('Koneksi ke server lisensi gagal', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Poll invoice status if pending
  useEffect(() => {
    if (!invoice?.external_ref || invoice.status === 'paid') return
    const interval = window.setInterval(async () => {
      const r = await api<Invoice>('license:getPaymentStatus', invoice.external_ref)
      if (!r.success || !r.data) return
      const next = r.data
      setInvoice(prev => prev ? { ...prev, ...next } : next)
      if (next.status === 'paid') {
        toast('Pembayaran telah disetujui developer! Lisensi aktif seketika.', 'success')
        window.dispatchEvent(new Event('license:sync-now'))
      }
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [invoice?.external_ref, invoice?.status, toast])

  // Automatic Polling for Active Midtrans Order
  useEffect(() => {
    if (!midtransModalOpen || !midtransOrder?.orderId || midtransSuccess) return

    const checkStatus = async () => {
      if (checkingMidtrans || midtransSuccess) return
      setCheckingMidtrans(true)
      try {
        const buyerEmail = email.trim() || user?.email || user?.nama_pengguna || ''
        const r = await api<any>('license:checkMidtransPayment', midtransOrder.orderId, buyerEmail, midtransOrder.plan.code)
        if (r.success && r.data?.status === 'ACTIVE') {
          setMidtransSuccess(true)
          setMidtransStatusText('Pembayaran Berhasil! Lisensi Anda telah aktif.')
          toast('Selamat! Paket lisensi telah aktif secara otomatis.', 'success')
          window.dispatchEvent(new Event('license:sync-now'))
          void handleSyncNow()
        } else if (r.data?.status === 'FAILED') {
          setMidtransStatusText('Pembayaran kedaluwarsa atau dibatalkan.')
        }
      } catch {} finally {
        setCheckingMidtrans(false)
      }
    }

    const timer = setInterval(checkStatus, 3000)
    return () => clearInterval(timer)
  }, [midtransModalOpen, midtransOrder, midtransSuccess, email, user, checkingMidtrans])

  const handleMidtransPayment = async () => {
    if (!selectedPlan) return toast('Pilih salah satu paket terlebih dahulu', 'error')
    const buyerEmail = email.trim() || user?.email || user?.nama_pengguna || ''

    if (!buyerEmail) {
      return toast('Masukkan email / username pembeli terlebih dahulu', 'error')
    }

    setCreating(true)
    try {
      const r = await api<any>('license:createMidtransPayment', {
        email: buyerEmail,
        plan_code: selectedPlan.code,
        buyer_name: user?.nama_lengkap || user?.nama_pengguna || 'Pembeli Lisensi',
      })

      if (r.success && r.data) {
        setMidtransOrder({
          orderId: r.data.orderId,
          token: r.data.token,
          redirectUrl: r.data.redirectUrl,
          plan: selectedPlan,
          amount: r.data.amount,
        })
        setMidtransModalOpen(true)
        setMidtransSuccess(false)
        setMidtransStatusText('Menunggu pembayaran diselesaikan...')

        // Open payment window
        if (r.data.redirectUrl) {
          void api('app:openExternal', r.data.redirectUrl)
        }
        toast('Sesi pembayaran Midtrans berhasil dibuat!', 'success')
      } else {
        toast(r.message || 'Gagal membuat sesi pembayaran Midtrans', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Koneksi ke gateway pembayaran gagal', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleRequestPayment = async () => {
    if (paymentMethod === 'midtrans') {
      return handleMidtransPayment()
    }

    if (!selectedPlan) return toast('Pilih salah satu paket terlebih dahulu', 'error')
    const buyerEmail = email.trim() || user?.email || user?.nama_pengguna || ''

    const durationText = selectedPlan.duration_days === 0
      ? 'Seumur Hidup (Sekali Bayar)'
      : `${selectedPlan.duration_days} hari`

    const message = [
      'Halo Admin WariPOS, saya ingin membeli / berlangganan lisensi:',
      '',
      `Paket: ${selectedPlan.name} (${selectedPlan.code})`,
      `Harga: ${formatPlanPrice(selectedPlan)} / ${getPlanDurationLabel(selectedPlan.duration_days)}`,
      `Durasi: ${durationText}`,
      `Akun: ${user?.nama_lengkap ?? user?.nama_pengguna ?? '-'}`,
      `Email: ${buyerEmail || '-'}`,
      '',
      'Mohon nomor rekening pembayaran dan aktivasi lisensinya. Terima kasih.',
    ].join('\n')

    const directWaUrl = buildWhatsAppUrl(null, message)

    setCreating(true)
    try {
      const r = await api<Invoice>('license:createManualPaymentRequest', {
        email: buyerEmail,
        plan_code: selectedPlan.code,
        amount: selectedPlan.price,
        name: user?.nama_lengkap ?? user?.nama_pengguna ?? buyerEmail.split('@')[0],
      })
      if (r.success && r.data) {
        setInvoice(r.data)
        toast('Permintaan lisensi dibuat! Mengarahkan ke WhatsApp developer...', 'success')
        const targetUrl = r.data.payment_url || buildWhatsAppUrl(r.data.whatsapp_number, r.data.whatsapp_message || message)
        void api('app:openExternal', targetUrl)
      } else {
        void api('app:openExternal', directWaUrl)
      }
    } catch {
      void api('app:openExternal', directWaUrl)
    } finally {
      setCreating(false)
    }
  }

  if (loading && plans.length === 0) return <SkeletonPage rows={6} />

  // Calculate current subscription status details
  const planCodeStr = String(user?.subscription_plan_code ?? '').toUpperCase()
  const planNameStr = String(user?.subscription_plan_name ?? '').toLowerCase()
  const isLifetime = Boolean(user?.is_lifetime)
    || planCodeStr === 'LIFETIME'
    || planCodeStr.includes('LIFETIME')
    || planNameStr.includes('seumur')
    || planNameStr.includes('lifetime')
    || (user?.subscription_expires_at === null && !isDemo && Boolean(user?.subscription_plan_name))

  const isExpired = user?.access_days_remaining !== null && user?.access_days_remaining !== undefined && user.access_days_remaining <= 0 && !isLifetime && !isDemo
  const isPaidActive = !isDemo && !isExpired && (isLifetime || Boolean(user?.subscription_plan_name) || Boolean(user?.subscription_plan_id))

  const userPlanName = user?.subscription_plan_name || (isDemo ? 'Akun Demo' : isLifetime ? 'Sekali Beli Seumur Hidup' : 'Akses Penuh POS')

  const expiryDisplay = isLifetime
    ? 'Permanen / Seumur Hidup'
    : user?.subscription_expires_at
    ? new Date(user.subscription_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : isDemo
    ? 'Terbatas (Mode Demo)'
    : 'Aktif'

  const userFlags = (user?.feature_flags as Record<string, boolean>) || {}

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm ring-4 ring-red-600/10">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl tracking-tight">
                Status Langganan & Lisensi
              </h1>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 sm:inline-flex border border-emerald-500/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Realtime Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm font-medium">
              Pantau paket aktif, batas kapasitas toko, dan nikmati aktivasi realtime tanpa perlu relog.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Menyinkronkan...' : 'Sinkronkan Lisensi'}
        </button>
      </div>

      {/* ─── Current Active Subscription Card (Flat Solid Elegance) ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-md sm:p-7 dark:bg-slate-950 dark:border-slate-800">
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          {/* Plan Info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Paket Aktif Saat Ini
              </span>
              {isLifetime ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-black text-amber-300 border border-amber-500/40">
                  <Star className="h-3 w-3 fill-amber-300" /> SEUMUR HIDUP
                </span>
              ) : isPaidActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <Zap className="h-3 w-3 fill-emerald-300" /> AKTIF
                </span>
              ) : isDemo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-3 py-0.5 text-xs font-bold text-orange-300 border border-orange-500/30">
                  <AlertTriangle className="h-3 w-3" /> DEMO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-0.5 text-xs font-bold text-rose-300 border border-rose-500/30">
                  <XCircle className="h-3 w-3" /> EXPIRED
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black text-white sm:text-3xl tracking-tight">
              {userPlanName}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-red-400" />
                <span>Masa Berlaku: <strong className="text-white">{expiryDisplay}</strong></span>
              </div>
              {user?.access_days_remaining !== null && user?.access_days_remaining !== undefined && !isLifetime && (
                <div className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-400" />
                  <span>Sisa: <strong className="text-amber-300">{Math.max(0, user.access_days_remaining)} Hari</strong></span>
                </div>
              )}
              {user?.email && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>Akun: <strong className="text-slate-200">{user.email}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Demo usage bar or quick upgrade button */}
          <div className="flex flex-col items-start gap-3 lg:items-end">
            {isDemo && (
              <div className="w-full rounded-2xl bg-slate-800/80 p-4 border border-slate-700/60 sm:w-72">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Transaksi Demo</span>
                  <span className="text-amber-400 font-bold">{demoState.usage_count} / {demoState.usage_limit}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-red-600"
                    style={{ width: `${Math.min(100, Math.round((demoState.usage_count / Math.max(1, demoState.usage_limit)) * 100))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Sisa {remainingUsage} transaksi sebelum terkunci.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('available-plans-section')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700"
            >
              <Rocket className="h-4 w-4" />
              {isPaidActive ? 'Perpanjang / Ganti Paket' : 'Beli & Upgrade Paket'}
            </button>
          </div>
        </div>

        {/* ─── Plan Limits & Quotas Grid ────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-800/60 p-3.5 border border-slate-750">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Laptop className="h-4 w-4 text-slate-300" />
              Batas Perangkat
            </div>
            <p className="mt-1.5 text-base font-extrabold text-white">
              {!user?.max_devices || user.max_devices === -1 ? 'Unlimited' : `${user.max_devices} Device`}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-800/60 p-3.5 border border-slate-750">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <CreditCard className="h-4 w-4 text-emerald-400" />
              Transaksi / Hari
            </div>
            <p className="mt-1.5 text-base font-extrabold text-white">
              {!user?.max_transactions_per_day || user.max_transactions_per_day === -1
                ? 'Tanpa Batas'
                : isDemo
                ? `${demoState.usage_limit} / hari`
                : `${user.max_transactions_per_day} / hari`}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-800/60 p-3.5 border border-slate-750">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Package className="h-4 w-4 text-blue-400" />
              Batas Produk
            </div>
            <p className="mt-1.5 text-base font-extrabold text-white">
              {!user?.max_products || user.max_products === -1 ? 'Tanpa Batas' : `${user.max_products} Produk`}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-800/60 p-3.5 border border-slate-750">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Users className="h-4 w-4 text-amber-400" />
              Multi-User
            </div>
            <p className="mt-1.5 text-base font-extrabold text-white">
              {!user?.max_users || user.max_users === -1 ? 'Unlimited' : `${user.max_users} Akun`}
            </p>
          </div>
        </div>

        {/* ─── Unlocked Features Grid ───────────────────────────────── */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Daftar Fitur Operasional Paket Anda
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_SYSTEM_FEATURES.map((feat) => {
              const isUnlocked = isPaidActive || isLifetime || (userFlags[feat.key] !== false && !isDemo)
              return (
                <div
                  key={feat.key}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition ${
                    isUnlocked
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                      : 'bg-slate-800/30 text-slate-500 border border-slate-800/40 opacity-60'
                  }`}
                >
                  {isUnlocked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                  <span className="font-medium truncate">{feat.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Realtime Activation Banner ─────────────────────────────── */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200">
        <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-500" />
        <div className="text-xs leading-relaxed sm:text-sm">
          <strong>Aktivasi Instan Tanpa Relog:</strong> Begitu pembayaran diverifikasi dan disetujui developer di Developer Panel, lisensi aplikasi Anda otomatis aktif seketika tanpa harus logout atau restart aplikasi.
        </div>
      </div>

      {/* ─── Available Plans Section ────────────────────────────────── */}
      <div id="available-plans-section" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pilihan Paket Langganan & Lisensi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilih paket yang sesuai untuk mengembangkan bisnis toko Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPlans}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh daftar paket"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Belum ada paket yang aktif di Developer Panel.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, idx) => {
              const code = String(plan?.code ?? `PLAN_${idx}`)
              const name = String(plan?.name ?? 'Paket Lisensi')
              const active = selectedCode === code
              const isRecommended = Boolean(plan?.is_recommended)
              const isPlanLifetime = Number(plan?.duration_days ?? 0) === 0
                || code.toUpperCase().includes('LIFETIME')
                || name.toLowerCase().includes('seumur')
                || name.toLowerCase().includes('lifetime')

              return (
                <div
                  key={code}
                  onClick={() => setSelectedCode(code)}
                  className={`relative flex cursor-pointer flex-col justify-between rounded-3xl border p-5 transition hover:-translate-y-0.5 ${
                    active
                      ? 'border-2 border-red-600 bg-red-50/30 shadow-md ring-1 ring-red-600/20 dark:border-red-600 dark:bg-red-950/20'
                      : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-3 py-0.5 text-[10px] font-black uppercase text-white shadow-sm">
                      REKOMENDASI
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {code}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {name}
                        </h3>
                      </div>
                      {isPlanLifetime && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Sekali Beli
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {formatPlanPrice(plan)}
                      </span>
                      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                        / {getPlanDurationLabel(plan?.duration_days)}
                      </span>
                    </div>

                    {plan?.description && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCode(code)
                      }}
                      className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
                        active
                          ? 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {active ? 'Paket Terpilih' : 'Pilih Paket'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Checkout & Request Status Panel ───────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Buyer Info & Payment Action */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Informasi Checkout & Aktivasi Lisensi
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Pilih metode pembayaran dan masukkan akun Anda untuk aktivasi lisensi otomatis.
          </p>

          <div className="mt-4 space-y-4">
            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* WhatsApp Manual Payment (Active) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('whatsapp')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMethod === 'whatsapp'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-500 flex items-center justify-center shrink-0">
                      <MessageCircle size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Manual (WhatsApp)</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[9px] font-black">
                          AKTIF
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">BCA, Mandiri, BRI, QRIS Manual</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${paymentMethod === 'whatsapp' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                    {paymentMethod === 'whatsapp' && <Check size={10} strokeWidth={3} />}
                  </div>
                </button>

                {/* Midtrans Automated (Under Maintenance) */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('midtrans')
                    toast('Layanan Midtrans sedang dalam pemeliharaan sistem. Gunakan WhatsApp untuk aktivasi langsung.', 'info')
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMethod === 'midtrans'
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/30 shadow-sm'
                      : 'border-slate-200/80 dark:border-slate-800/80 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                      <CreditCard size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Otomatis (Midtrans)</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-black">
                          MAINTENANCE
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Dalam pemeliharaan berkala</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${paymentMethod === 'midtrans' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                    {paymentMethod === 'midtrans' && <Check size={10} strokeWidth={3} />}
                  </div>
                </button>
              </div>
            </div>

            {/* Maintenance Warning Banner if Midtrans Selected */}
            {paymentMethod === 'midtrans' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Gateway Otomatis Sedang Dalam Pemeliharaan
                </p>
                <p className="text-[11px] mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Layanan pembayaran otomatis Midtrans sedang ditingkatkan. Silakan pilih <strong>Manual (WhatsApp)</strong> agar admin developer dapat memproses aktivasi lisensi Anda secara langsung.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email / Username Akun Toko *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@toko.com"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
              />
            </div>

            {selectedPlan && (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Paket Terpilih</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedPlan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-extrabold text-red-600 dark:text-red-400">
                    {formatPlanPrice(selectedPlan)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">{getPlanDurationLabel(selectedPlan.duration_days)}</p>
                </div>
              </div>
            )}

            {paymentMethod === 'midtrans' ? (
              <button
                type="button"
                onClick={() => {
                  toast('Layanan Midtrans sedang dalam pemeliharaan. Silakan beralih ke WhatsApp untuk aktivasi langsung.', 'info')
                  setPaymentMethod('whatsapp')
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-300 dark:bg-slate-800 px-5 py-3.5 text-sm font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed transition"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Midtrans Sedang Maintenance (Klik untuk Beralih ke WhatsApp)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestPayment}
                disabled={creating || !selectedPlan}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98]"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Beli via WhatsApp Admin ({selectedPlan ? selectedPlan.name : 'Pilih Paket'})
              </button>
            )}
          </div>
        </div>

        {/* Invoice / Request Tracker */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Status Permintaan Lisensi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Pantau status transaksi invoice Anda.
            </p>

            {invoice ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <div className="flex-1">
                    <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {invoice.invoice_number || invoice.external_ref}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        {invoice.status}
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold">
                        Rp {Number(invoice.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {invoice.payment_url && (
                  <button
                    type="button"
                    onClick={() => void api('app:openExternal', invoice.payment_url!)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka WhatsApp Admin
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center justify-center py-6 text-center text-slate-400">
                <CreditCard className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs font-medium">Belum ada request pembayaran yang aktif.</p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-3.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50">
            <p className="font-bold text-slate-700 dark:text-slate-200">Aktivasi Instan & Real-time</p>
            <p className="mt-0.5">Setelah admin menyetujui, lisensi toko otomatis aktif seketika di semua perangkat.</p>
          </div>
        </div>
      </div>

      {/* ─── Midtrans Active Payment Modal ───────────────────────── */}
      {midtransModalOpen && midtransOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 overflow-hidden">
            <div className="relative flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm dark:bg-slate-800">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">Checkout Lisensi</h3>
                  <p className="text-xs font-semibold text-slate-400">Midtrans Automated Gateway</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMidtransModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Order Details Solid Card */}
            <div className="relative bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Order ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{midtransOrder.orderId}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Paket Langganan</span>
                <span className="font-extrabold text-red-600 dark:text-red-400">{midtransOrder.plan.name}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Metode Tersedia</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">QRIS / VA / CC / E-Wallet</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-200 dark:border-slate-800 font-bold">
                <span className="text-slate-800 dark:text-white font-extrabold">Total Tagihan</span>
                <span className="text-xl text-slate-900 dark:text-white font-black">
                  {formatPlanPrice(midtransOrder.plan)}
                </span>
              </div>
            </div>

            {/* Status Alert Bar */}
            <div className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center gap-3 shadow-sm ${
              midtransSuccess
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
            }`}>
              {midtransSuccess ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow">
                  <CheckCircle2 size={18} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock size={18} className="animate-spin" />
                </div>
              )}
              <div className="flex-1">
                <p className="leading-snug">{midtransStatusText}</p>
                {!midtransSuccess && (
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">Sistem memantau pembayaran otomatis tiap 3 detik</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {!midtransSuccess && midtransOrder.redirectUrl && (
                <button
                  type="button"
                  onClick={() => void api('app:openExternal', midtransOrder.redirectUrl)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-sm transition transform active:scale-[0.98]"
                >
                  <ExternalLink size={16} />
                  Buka Jendela Pembayaran Midtrans (Snap)
                </button>
              )}

              <button
                type="button"
                onClick={() => setMidtransModalOpen(false)}
                className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {midtransSuccess ? 'Selesai & Lanjutkan' : 'Tutup Dialog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
