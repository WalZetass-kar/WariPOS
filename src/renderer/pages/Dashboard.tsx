import { useEffect, useLayoutEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
  BarChart2,
  RefreshCw,
  Table2,
  Crown,
  Clock,
  Users2,
  CheckCircle,
  PackagePlus,
  Calculator,
  Store,
  Layers,
  ArrowRight,
} from 'lucide-react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  Bar,
  BarChart,
} from 'recharts'
import Card from '../components/Card'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonCard, SkeletonChart } from '../components/Skeleton'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime, formatRupiah } from '../utils/format'
import { dashboardSummaryToTsv as buildDashboardTsv } from '../../shared/googleSheetsExport'
import type { DashboardSummary } from '../../shared/types'
import { hasRole } from '../../shared/config/rbac'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsightData {
  kpis: {
    salesToday: number
    salesMonth: number
    grossProfitMonth: number
    avgDailySales: number
    projectedMonth: number
  }
  peakHours: Array<{ hour: string; count: number; total: number }>
  cashierPerformance: Array<{ username: string; count: number; total: number }>
  slowMoving: Array<{ kd_barang: string; nama_barang: string; stok: number; last_sold_at: string }>
  reorder: Array<{ kd_barang: string; nama_barang: string; stok: number; stok_minimum: number }>
  marginByCategory: Array<{ category: string; margin: number; revenue: number }>
  customerSegments: { vip: number; active: number; inactive: number }
}

const EMPTY_INSIGHTS: InsightData = {
  kpis: { salesToday: 0, salesMonth: 0, grossProfitMonth: 0, avgDailySales: 0, projectedMonth: 0 },
  peakHours: [],
  cashierPerformance: [],
  slowMoving: [],
  reorder: [],
  marginByCategory: [],
  customerSegments: { vip: 0, active: 0, inactive: 0 },
}

const EMPTY_SUMMARY: DashboardSummary = {
  today: { count: 0, total: 0 },
  week: { count: 0, total: 0 },
  month: { count: 0, total: 0 },
  totalBarang: 0,
  lowStockCount: 0,
  chartData: [],
  predictedTomorrow: 0,
  hourlySales: [],
  topProducts: [],
  lowStockProducts: [],
  recentTransactions: [],
  alertSummary: {
    stockOutCount: 0,
    lowStockCount: 0,
    todayTransactionCount: 0,
    todayRevenue: 0,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    const start = performance.now()
    const tick = (now: number) => {
      if (!isMountedRef.current) return
      const p = Math.min((now - start) / duration, 1)
      setValue(Math.floor(p * target))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { isMountedRef.current = false; cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return value
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs shadow-xl rounded-2xl">
      <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-red-600 dark:text-red-400 font-extrabold">{formatRupiah(payload[0].value)}</p>
    </div>
  )
}

function HourlyChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs shadow-xl rounded-2xl">
      <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-slate-600 dark:text-slate-300 font-medium">{row.count ?? 0} Transaksi</p>
      <p className="text-red-600 dark:text-red-400 font-extrabold">{formatRupiah(row.total)}</p>
    </div>
  )
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setWidth(prev => (prev === nextWidth ? prev : nextWidth))
    }

    update()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update())
      observer.observe(element)
      return () => observer.disconnect()
    }

    const raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { ref, width }
}

function ChartSurface({
  height,
  children,
  fallback,
}: {
  children: (width: number) => ReactNode
  fallback?: ReactNode
  height: number
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  return (
    <div ref={ref} className="w-full" style={{ minHeight: height }}>
      {width > 0 ? children(width) : fallback ?? (
        <div className="flex h-full min-h-[inherit] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 text-center" />
      )}
    </div>
  )
}

const GOOGLE_SHEETS_CREATE_URL = 'https://docs.google.com/spreadsheets/u/0/create'

function copyTextWithTextarea(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return } catch { /**/ }
  }
  if (copyTextWithTextarea(text)) return
  throw new Error('Clipboard tidak tersedia')
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeDashboardSummary(value: Partial<DashboardSummary> | null | undefined): DashboardSummary {
  return {
    today: {
      count: asNumber(value?.today?.count),
      total: asNumber(value?.today?.total),
    },
    week: {
      count: asNumber(value?.week?.count),
      total: asNumber(value?.week?.total),
    },
    month: {
      count: asNumber(value?.month?.count),
      total: asNumber(value?.month?.total),
    },
    totalBarang: asNumber(value?.totalBarang),
    lowStockCount: asNumber(value?.lowStockCount),
    chartData: Array.isArray(value?.chartData)
      ? value.chartData.map(item => ({ label: String(item?.label ?? '-'), total: asNumber(item?.total) }))
      : [],
    predictedTomorrow: asNumber(value?.predictedTomorrow),
    hourlySales: Array.isArray(value?.hourlySales)
      ? value.hourlySales.map(item => ({
        hour: String(item?.hour ?? '-'),
        count: asNumber(item?.count),
        total: asNumber(item?.total),
      }))
      : [],
    recentTransactions: Array.isArray(value?.recentTransactions)
      ? value.recentTransactions.map(item => ({
        kd_tansaksi_jual: String(item?.kd_tansaksi_jual ?? ''),
        tgl_wkt_transaksi: item?.tgl_wkt_transaksi ?? null,
        username_transaksi: item?.username_transaksi ?? null,
        nama_customer: item?.nama_customer ?? null,
        total_qty: asNumber(item?.total_qty),
        total_penjualan: asNumber(item?.total_penjualan),
        jenis_pembayaran: item?.jenis_pembayaran ?? null,
      }))
      : [],
    alertSummary: {
      stockOutCount: asNumber(value?.alertSummary?.stockOutCount),
      lowStockCount: asNumber(value?.alertSummary?.lowStockCount, asNumber(value?.lowStockCount)),
      todayTransactionCount: asNumber(value?.alertSummary?.todayTransactionCount, asNumber(value?.today?.count)),
      todayRevenue: asNumber(value?.alertSummary?.todayRevenue, asNumber(value?.today?.total)),
    },
    topProducts: Array.isArray(value?.topProducts)
      ? value.topProducts.map(item => ({
        kd_barang: item?.kd_barang ?? null,
        nama_barang: item?.nama_barang ?? null,
        total_qty: asNumber(item?.total_qty),
        total_revenue: asNumber(item?.total_revenue),
      }))
      : [],
    lowStockProducts: Array.isArray(value?.lowStockProducts)
      ? value.lowStockProducts.map(item => ({
        kd_barang: String(item?.kd_barang ?? ''),
        nama_barang: item?.nama_barang ?? null,
        stok: asNumber(item?.stok),
        stok_minimum: asNumber(item?.stok_minimum, 5),
      }))
      : [],
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [exportingSheets, setExportingSheets] = useState(false)
  const [insights, setInsights] = useState<InsightData>(EMPTY_INSIGHTS)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState('')
  const [seedingDemo, setSeedingDemo] = useState(false)
  const [confirmSeedModal, setConfirmSeedModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'operasional' | 'analisis'>('operasional')
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()

  const isAdmin = hasRole(user?.hak_akses, ['developer', 'super_admin', 'admin'])

  const fetchData = useCallback(async (showToast = false) => {
    setLoading(true)
    setError(false)
    try {
      const r = await api<DashboardSummary>('dashboard:getSummary')
      if (r.success && r.data) {
        setSummary(normalizeDashboardSummary(r.data))
        if (showToast) toast('Data dashboard diperbarui', 'success')
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true)
    setInsightsError('')
    try {
      const r = await api<InsightData>('ownerDashboard:getInsights')
      if (r.success && r.data) {
        setInsights(r.data)
      } else {
        setInsights(EMPTY_INSIGHTS)
        setInsightsError(r.message || 'Gagal memuat data insight owner')
      }
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    api('notifikasi:checkStokMinimum').catch(() => {})

    const interval = setInterval(() => {
      fetchData()
    }, 5 * 60 * 1000)

    const onRefresh = () => { fetchData(); if (isAdmin) fetchInsights() }
    window.addEventListener('app:refresh', onRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('app:refresh', onRefresh)
    }
  }, [fetchData, isAdmin, fetchInsights])

  useEffect(() => {
    if (isAdmin) {
      fetchInsights()
    } else {
      setInsights(EMPTY_INSIGHTS)
      setInsightsError('')
      setInsightsLoading(false)
    }
  }, [isAdmin, fetchInsights])

  const handleExportGoogleSheets = useCallback(async () => {
    if (!summary) { toast('Data dashboard belum siap', 'error'); return }
    setExportingSheets(true)
    try {
      const automatic = await api<{ mode: 'apps-script' | 'clipboard' }>('integrations:exportDashboardToSheets', summary)
      if (automatic.success && automatic.data?.mode === 'apps-script') {
        toast('Dashboard berhasil dikirim ke Google Sheets', 'success')
        return
      }
      const tsv = buildDashboardTsv(summary)
      const copiedBeforeOpen = copyTextWithTextarea(tsv)
      const sheetsWindow = window.api?.invoke ? null : window.open(GOOGLE_SHEETS_CREATE_URL, '_blank', 'noopener,noreferrer')
      if (!copiedBeforeOpen) await copyTextToClipboard(tsv)
      if (window.api?.invoke) {
        await window.api.invoke('app:openExternal', GOOGLE_SHEETS_CREATE_URL)
      } else if (!sheetsWindow) {
        window.location.href = GOOGLE_SHEETS_CREATE_URL
      }
      toast('Data disalin. Google Sheets dibuka — tempel di sel A1.', 'success')
    } catch (err) {
      toast(`Gagal export: ${err instanceof Error ? err.message : 'Error'}`, 'error')
    } finally {
      setExportingSheets(false)
    }
  }, [summary, toast])

  const dashboard = summary ?? EMPTY_SUMMARY
  const recentTransactions = dashboard.recentTransactions ?? []
  const ownerPeakHours = insights.peakHours ?? []
  const activeOwnerPeakHours = ownerPeakHours.filter(item => item.count > 0)
  const ownerPeakHour = activeOwnerPeakHours.reduce<typeof ownerPeakHours[number] | null>(
    (best, item) => (!best || item.count > best.count ? item : best),
    null,
  )

  return (
    <div className="space-y-5 select-none">

      {/* ── Top Header & Tab Navigation ── */}
      <div className="space-y-3.5 border-b border-slate-200 dark:border-slate-800 pb-4">
        {/* Row 1: Greeting + Action Buttons */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                <Calculator size={18} />
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                Hai, {user?.nama_lengkap ?? user?.nama_pengguna ?? 'Kasir'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => { fetchData(true); if (isAdmin) fetchInsights() }}
              disabled={loading || (isAdmin && insightsLoading)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
              title="Refresh data dashboard"
            >
              <RefreshCw size={14} className={loading || (isAdmin && insightsLoading) ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            
            {/* Transaksi POS Button */}
            <button
              type="button"
              onClick={() => navigate('/transaksi')}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <ShoppingCart size={14} />
              <span>Kasir POS</span>
            </button>
          </div>
        </div>

        {/* Row 2: Clean Full-width Segmented Tab Switcher (Mobile 50-50 Grid, Desktop inline-flex) */}
        {isAdmin && (
          <div className="w-full sm:w-auto sm:inline-flex grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('operasional')}
              className={`flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all text-center ${
                activeTab === 'operasional'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Store size={14} />
              <span>Operasional Toko</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analisis')}
              className={`flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all text-center ${
                activeTab === 'analisis'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Crown size={14} className="text-amber-500" />
              <span>Analisis Owner</span>
            </button>
          </div>
        )}
      </div>

      {/* ── ERROR STATE ── */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 border border-red-200 dark:border-red-900/60">
            <AlertTriangle size={28} />
          </div>
          <div className="text-center">
            <p className="font-extrabold text-slate-900 dark:text-white text-base">Gagal Memuat Data Dashboard</p>
            <p className="text-xs text-slate-400 mt-1">Periksa koneksi database lokal Anda lalu coba lagi.</p>
          </div>
          <Button onClick={() => fetchData(true)} icon={<RefreshCw size={14} />} className="bg-red-600 hover:bg-red-700 text-white font-bold border-0 text-xs">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* ── ONBOARDING DEMO BANNER ── */}
      {!error && !loading && dashboard.totalBarang === 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Database Toko Masih Kosong</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Muat data contoh toko (20+ produk, meja, customer, dan riwayat transaksi) agar grafik langsung terisi.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            icon={<PackagePlus size={14} className="text-amber-600 dark:text-amber-400" />}
            loading={seedingDemo}
            onClick={() => setConfirmSeedModal(true)}
            className="shrink-0 w-full sm:w-auto font-bold text-xs"
          >
            Muat Data Contoh
          </Button>

          <ConfirmDialog
            open={confirmSeedModal}
            onClose={() => setConfirmSeedModal(false)}
            onConfirm={async () => {
              setSeedingDemo(true)
              try {
                const r = await api<any>('system:seedSampleData')
                if (r.success) {
                  toast(r.message || 'Data demo berhasil dimuat!', 'success')
                  fetchData(true)
                  if (isAdmin) fetchInsights()
                  setConfirmSeedModal(false)
                } else {
                  toast(r.message || 'Gagal memuat data demo', 'error')
                }
              } finally {
                setSeedingDemo(false)
              }
            }}
            title="Muat Data Contoh Toko"
            message="Apakah Anda yakin ingin memuat data contoh toko? Tindakan ini akan menambahkan 20+ produk, meja restoran, customer, supplier, dan riwayat transaksi simulasi ke sistem."
            confirmText="Ya, Muat Data Contoh"
            variant="warning"
            loading={seedingDemo}
          />
        </div>
      )}

      {/* ── TAB 1: OPERASIONAL TOKO ── */}
      {!error && activeTab === 'operasional' && (
        <div className="space-y-5">
          
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : (
                <>
                  <StatCard
                    icon={<ShoppingCart size={20} />}
                    label="Transaksi Hari Ini"
                    value={dashboard.today.count}
                    sub={formatRupiah(dashboard.today.total)}
                    color="bg-red-600"
                  />
                  <StatCard
                    icon={<TrendingUp size={20} />}
                    label="Pendapatan Bulan Ini"
                    value={dashboard.month.total}
                    sub={`${dashboard.month.count} transaksi terjual`}
                    color="bg-emerald-600"
                    isCurrency
                  />
                  <StatCard
                    icon={<Package size={20} />}
                    label="Total Katalog Produk"
                    value={dashboard.totalBarang}
                    sub="produk siap jual"
                    color="bg-sky-600"
                  />
                  <StatCard
                    icon={<AlertTriangle size={20} />}
                    label="Stok Menipis"
                    value={dashboard.lowStockCount}
                    sub="produk ≤ batas min"
                    color="bg-amber-600"
                  />
                </>
              )}
          </div>

          {/* Chart + Weekly Summary Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {loading ? <SkeletonChart className="xl:col-span-2" /> : (
              <Card
                title="Tren Penjualan 7 Hari"
                subtitle="Grafik pendapatan harian toko"
                className="xl:col-span-2"
                action={
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end mr-2">
                      <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Prediksi Besok</p>
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(dashboard.predictedTomorrow || 0)}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExportGoogleSheets}
                      icon={<Table2 size={13} />}
                      loading={exportingSheets}
                      disabled={!summary}
                      className="font-bold text-xs"
                    >
                      Google Sheets
                    </Button>
                  </div>
                }
              >
                <ChartSurface
                  height={220}
                  fallback={
                    <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 text-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Grafik Penjualan Belum Siap</p>
                        <p className="mt-1 text-[11px] text-slate-400">Menunggu data transaksi dihitung</p>
                      </div>
                    </div>
                  }
                >
                  {width => (
                    <AreaChart width={width} height={220} data={dashboard.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotalRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        dx={-8}
                        tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="total" stroke="#DC2626" strokeWidth={2.5} fill="url(#colorTotalRed)" animationDuration={800} />
                    </AreaChart>
                  )}
                </ChartSurface>
              </Card>
            )}

            {loading ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <Card title="Ringkasan 7 Hari" subtitle="Statistik performa minggu ini">
                <div className="space-y-3 mt-1">
                  <SummaryRow icon={<Calendar size={15} />} label="Total Transaksi" value={String(dashboard.week.count)} />
                  <SummaryRow icon={<TrendingUp size={15} />} label="Total Pendapatan" value={formatRupiah(dashboard.week.total)} />
                  <SummaryRow icon={<BarChart2 size={15} />} label="Rata-rata / Hari" value={formatRupiah(Math.round(dashboard.week.total / 7))} />
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="secondary" className="w-full font-bold text-xs" onClick={() => navigate('/riwayat')}>
                    Lihat Riwayat Transaksi
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Row 2: Recent Transactions & Low Stock Alert */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Recent Transactions */}
            <Card
              title="Transaksi Terbaru"
              subtitle="5 transaksi terakhir yang diproses"
              action={
                <button
                  type="button"
                  onClick={() => navigate('/riwayat')}
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  Semua <ArrowRight size={12} />
                </button>
              }
            >
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-2">
                  {recentTransactions.map(transaction => (
                    <button
                      key={transaction.kd_tansaksi_jual}
                      type="button"
                      onClick={() => navigate('/riwayat')}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-3 text-left transition-all hover:border-red-600/40 hover:bg-white dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white font-mono">{transaction.kd_tansaksi_jual}</p>
                          <p className="truncate text-[11px] text-slate-500 font-medium mt-0.5">
                            {transaction.nama_customer || 'Pelanggan Umum'} • {formatDateTime(transaction.tgl_wkt_transaksi)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-xs text-red-600 dark:text-red-400">{formatRupiah(transaction.total_penjualan)}</p>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">{transaction.jenis_pembayaran || 'TUNAI'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 text-center">
                  <ShoppingCart size={28} className="mx-auto mb-2 text-slate-400 opacity-40" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Belum Ada Transaksi</p>
                  <p className="mt-1 text-[11px] text-slate-400">Mulai transaksi pertama dari menu Kasir POS.</p>
                </div>
              )}
            </Card>

            {/* Low Stock Restock */}
            <Card
              title="Stok Menipis (Perlu Restock)"
              subtitle="Daftar barang di bawah batas minimum"
              action={
                <button
                  type="button"
                  onClick={() => navigate('/produk')}
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  Kelola Stok <ArrowRight size={12} />
                </button>
              }
            >
              <div className="space-y-2">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))
                  : (dashboard.lowStockProducts || []).length > 0
                    ? (dashboard.lowStockProducts || []).map(product => (
                      <div key={product.kd_barang} className="flex items-center gap-3 p-2.5 rounded-2xl border border-red-200 bg-red-50/50 dark:bg-red-950/30 dark:border-red-900/40">
                        <div className="w-8 h-8 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                          <AlertTriangle size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{product.nama_barang || 'Produk'}</p>
                          <p className="text-[11px] font-bold text-red-600 dark:text-red-400">Sisa: {product.stok ?? 0} unit</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate('/produk')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs border-0 shrink-0"
                        >
                          Restock
                        </Button>
                      </div>
                    ))
                    : (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 text-center">
                        <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Semua Stok Barang Aman</p>
                        <p className="mt-1 text-[11px] text-slate-400">Tidak ada barang yang berada di bawah batas minimum.</p>
                      </div>
                    )}
              </div>
            </Card>

          </div>

          {/* Row 3: Top 5 Best Selling Products */}
          <Card
            title="Produk Terlaris Minggu Ini"
            subtitle="Peringkat 5 produk paling laku berdasarkan volume penjualan"
            action={
              <button
                type="button"
                onClick={() => navigate('/laporan')}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                Lihat Laporan Penjualan <ArrowRight size={12} />
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))
                : (dashboard.topProducts || []).length > 0
                  ? (dashboard.topProducts || []).map((product, idx) => (
                    <div key={product.kd_barang || idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-col justify-between gap-2 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                          idx === 0 ? 'bg-red-600 text-white' :
                          idx === 1 ? 'bg-amber-500 text-white' :
                          idx === 2 ? 'bg-slate-800 text-white' :
                          'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                          {formatRupiah(product.total_revenue)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={product.nama_barang || ''}>
                          {product.nama_barang || 'Produk'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {product.total_qty} unit terjual
                        </p>
                      </div>
                    </div>
                  ))
                  : (
                    <div className="col-span-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 text-center">
                      <Package size={24} className="mx-auto mb-1 text-slate-400 opacity-40" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Penjualan</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Peringkat produk terlaris akan otomatis terisi setelah kasir bertransaksi.</p>
                    </div>
                  )}
            </div>
          </Card>

        </div>
      )}

      {/* ── TAB 2: ANALISIS OWNER & STRATEGI BISNIS ── */}
      {!error && activeTab === 'analisis' && isAdmin && (
        <div className="space-y-5">

          {insightsError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-200">
              {insightsError}
            </div>
          )}

          {/* 5 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
            {insightsLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
              : (
                <>
                  <KpiCard label="Penjualan Hari Ini" value={formatRupiah(insights.kpis.salesToday)} icon={<TrendingUp size={16} />} color="bg-red-600" />
                  <KpiCard label="Penjualan Bulan Ini" value={formatRupiah(insights.kpis.salesMonth)} icon={<TrendingUp size={16} />} color="bg-emerald-600" />
                  <KpiCard label="Laba Kotor" value={formatRupiah(insights.kpis.grossProfitMonth)} icon={<BarChart2 size={16} />} color="bg-violet-600" />
                  <KpiCard label="Rata-rata Harian" value={formatRupiah(insights.kpis.avgDailySales)} icon={<Clock size={16} />} color="bg-amber-600" />
                  <KpiCard label="Proyeksi Akhir Bulan" value={formatRupiah(insights.kpis.projectedMonth)} icon={<Crown size={16} />} color="bg-pink-600" />
                </>
              )}
          </div>

          {/* Deep Business Analysis Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            
            {/* Peak Hours Chart */}
            <Card title="Jam Tersibuk Toko" subtitle="Berdasarkan riwayat transaksi 30 hari terakhir">
              {insightsLoading ? (
                <InsightSkeleton rows={4} />
              ) : ownerPeakHours.length === 0 ? (
                <EmptyInsight text="Belum ada data transaksi 30 hari terakhir" />
              ) : (
                <div className="space-y-3">
                  <ChartSurface height={144}>
                    {width => (
                      <BarChart width={width} height={144} data={ownerPeakHours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ownerPeakBarRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#DC2626" stopOpacity={0.95} />
                            <stop offset="95%" stopColor="#DC2626" stopOpacity={0.35} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                        <Tooltip content={<HourlyChartTooltip />} />
                        <Bar dataKey="count" fill="url(#ownerPeakBarRed)" radius={[6, 6, 0, 0]} barSize={14} />
                      </BarChart>
                    )}
                  </ChartSurface>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <CompactStat label="Jam Puncak" value={ownerPeakHour ? ownerPeakHour.hour : '-'} />
                    <CompactStat label="Total Transaksi" value={`${ownerPeakHour?.count ?? 0} Transaksi`} />
                  </div>
                </div>
              )}
            </Card>

            {/* Cashier Performance */}
            <Card title="Performa Tim Kasir" subtitle="Total transaksi & penjualan per kasir">
              {insightsLoading ? (
                <InsightSkeleton />
              ) : insights.cashierPerformance.length === 0 ? (
                <EmptyInsight text="Belum ada data kasir" />
              ) : (
                <div className="space-y-2">
                  {insights.cashierPerformance.map(row => (
                    <div key={row.username} className="flex justify-between items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <Users2 size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">{row.username || '-'}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{row.count} transaksi</p>
                        </div>
                      </div>
                      <p className="font-extrabold text-red-600 dark:text-red-400 text-xs whitespace-nowrap">{formatRupiah(row.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Customer Segmentation */}
            <Card title="Segmen Pelanggan" subtitle="Status keaktifan customer toko">
              {insightsLoading ? (
                <InsightSkeleton />
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center mt-1">
                  {[
                    { label: 'Member VIP', value: insights.customerSegments.vip, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200' },
                    { label: 'Aktif Belanja', value: insights.customerSegments.active, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200' },
                    { label: 'Belum Belanja', value: insights.customerSegments.inactive, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800' },
                  ].map(seg => (
                    <div key={seg.label} className={`rounded-2xl ${seg.bg} p-3.5`}>
                      <p className={`text-2xl font-black ${seg.color}`}>{seg.value}</p>
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">{seg.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, isCurrency = false }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string; isCurrency?: boolean
}) {
  const animated = useCountUp(value)
  return (
    <Card className="flex items-center gap-3.5 hover:border-red-600/30 transition-all shadow-sm">
      <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase tracking-wider">{label}</p>
        <p className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight truncate mt-0.5">
          {isCurrency ? formatRupiah(animated) : animated.toLocaleString('id-ID')}
        </p>
        <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">{sub}</p>
      </div>
    </Card>
  )
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium">
        {icon} <span className="truncate">{label}</span>
      </div>
      <span className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">{value}</span>
    </div>
  )
}

function CompactStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</p>
      <p className="mt-0.5 text-xs font-black text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  )
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{label}</p>
          <p className="mt-1 text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">{value}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center text-white shrink-0 shadow-sm`}>{icon}</div>
      </div>
    </Card>
  )
}

function InsightSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-950 p-3">
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded self-center" />
        </div>
      ))}
    </div>
  )
}

function EmptyInsight({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500 opacity-60" />
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-2">{text}</p>
    </div>
  )
}
