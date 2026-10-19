import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  TrendingUp,
  Package,
  PackageX,
  AlertTriangle,
  BarChart2,
  RefreshCw,
  Table2,
  Clock,
  Users2,
  PackagePlus,
  Calculator,
  Store,
  Layers,
  Eye,
  EyeOff,
  Wallet,
  Receipt,
  LayoutGrid,
  Truck,
  FileText,
  Lock,
  Unlock,
  Plus,
  Minus,
  Utensils,
  ClipboardList,
  ClipboardCheck,
  Database,
  Shield,
  Settings as SettingsIcon,
  Building2,
  DollarSign,
  History,
  X,
  Search,
  ChevronRight,
  MessagesSquare,
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
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import ConfirmDialog from '../components/ConfirmDialog'
import { Skeleton, SkeletonChart } from '../components/Skeleton'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { formatDateTime, formatRupiah } from '../utils/format'
import { dashboardSummaryToTsv as buildDashboardTsv } from '../../shared/googleSheetsExport'
import type { DashboardSummary } from '../../shared/types'
import { hasRole } from '../../shared/config/rbac'

// Chart colors come from the active theme tokens (themes.css) so charts follow every pastel theme
// and a custom hex color without a hardcoded table.
function readThemeTokens() {
  const css = getComputedStyle(document.documentElement)
  const read = (shade: number, fallback: string) => css.getPropertyValue(`--color-primary-${shade}`).trim() || fallback
  return { soft: read(300, '#ffc1bb'), fill: read(400, '#f7a59d'), line: read(600, '#ae5e58') }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveKasDrawer {
  kd_kas: string
  username: string
  nama_kasir?: string
  modal_awal: number
  total_penjualan: number
  total_pengeluaran: number
  total_pemasukan: number
  saldo_akhir: number
  selisih: number
  status: 'OPEN' | 'CLOSED'
  tgl_buka: string
}

interface ActiveShift {
  id: number
  shift_number: string
  user_id: string
  start_time: string
  opening_balance: number
  total_sales: number
  total_transactions: number
  status: string
  total_tunai?: number
  total_nontunai?: number
  total_pemasukan?: number
  total_pengeluaran?: number
  expected_cash?: number
}

interface BankAccountInfo {
  kd_rekening: number
  nama_bank: string
  nomor_rekening: string
  saldo_saat_ini: number
  status: 'AKTIF' | 'NONAKTIF'
}

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
  chartData30: [],
  predictedTomorrow: 0,
  todayQtySold: 0,
  yesterdayTotal: 0,
  yesterdayCount: 0,
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs shadow-xl rounded-xl">
      <p className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{label}</p>
      <p className="text-primary-600 dark:text-primary-400 font-black">{formatRupiah(payload[0].value)}</p>
    </div>
  )
}

function HourlyChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs shadow-xl rounded-xl">
      <p className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">{label}</p>
      <p className="text-slate-600 dark:text-slate-300 font-medium">{row.count ?? 0} Transaksi</p>
      <p className="text-primary-600 dark:text-primary-400 font-black">{formatRupiah(row.total)}</p>
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
    chartData30: Array.isArray(value?.chartData30)
      ? value.chartData30.map(item => ({ label: String(item?.label ?? '-'), total: asNumber(item?.total) }))
      : [],
    predictedTomorrow: asNumber(value?.predictedTomorrow),
    todayQtySold: asNumber(value?.todayQtySold, 0),
    yesterdayTotal: asNumber(value?.yesterdayTotal, 0),
    yesterdayCount: asNumber(value?.yesterdayCount, 0),
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
        foto_barang: item?.foto_barang ?? null,
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

// ─── In-Memory Cache for Instant Tab Switching (Stale-While-Revalidate) ────────
let cachedDashboardSummary: DashboardSummary | null = null
let cachedInsights: InsightData | null = null
let cachedActiveDrawer: ActiveKasDrawer | null = null
let cachedActiveShift: ActiveShift | null = null
let cachedBankAccounts: BankAccountInfo[] = []
let cachedRecentLogs: any[] = []

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(() => cachedDashboardSummary)
  const [loading, setLoading] = useState(() => !cachedDashboardSummary)
  const [error, setError] = useState(false)
  const [exportingSheets, setExportingSheets] = useState(false)
  const [insights, setInsights] = useState<InsightData>(() => cachedInsights ?? EMPTY_INSIGHTS)
  const [insightsLoading, setInsightsLoading] = useState(() => !cachedInsights)
  const [insightsError, setInsightsError] = useState('')
  const [seedingDemo, setSeedingDemo] = useState(false)
  const [confirmSeedModal, setConfirmSeedModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'operasional' | 'analisis'>('operasional')
  const [activeDrawer, setActiveDrawer] = useState<ActiveKasDrawer | null>(() => cachedActiveDrawer)
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(() => cachedActiveShift)
  const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>(() => cachedBankAccounts)
  const [chartFilter, setChartFilter] = useState<'7d' | '30d' | 'custom'>('7d')
  const [recentLogs, setRecentLogs] = useState<any[]>(() => cachedRecentLogs)
  // undefined = not checked yet, null = no backup has ever been made
  const [lastBackupHours, setLastBackupHours] = useState<number | null | undefined>(undefined)
  const [showBalance, setShowBalance] = useState(() => {
    try {
      return localStorage.getItem('waripos_show_balance') !== 'false'
    } catch {
      return true
    }
  })
  const [quickCashModal, setQuickCashModal] = useState<'income' | 'expense' | 'openCash' | 'closeShift' | null>(null)
  const [allServicesModal, setAllServicesModal] = useState(false)
  const [allServicesSearch, setAllServicesSearch] = useState('')
  const [quickCashForm, setQuickCashForm] = useState({ amount: '', note: '' })
  const [closeShiftForm, setCloseShiftForm] = useState({ closingBalance: '', notes: '' })
  const [quickCashLoading, setQuickCashLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { color: themeColor, isDark } = useTheme()

  const summaryRef = useRef(summary)
  summaryRef.current = summary
  const insightsRef = useRef(insights)
  insightsRef.current = insights

  const [chartColors, setChartColors] = useState(readThemeTokens)
  useEffect(() => {
    // ThemeProvider applies data-theme in its own effect, which runs after this one; read on the next frame
    const raf = requestAnimationFrame(() => setChartColors(readThemeTokens()))
    return () => cancelAnimationFrame(raf)
  }, [themeColor])

  const isAdmin = hasRole(user?.hak_akses, ['developer', 'super_admin', 'admin'])

  const toggleShowBalance = useCallback(() => {
    setShowBalance(prev => {
      const next = !prev
      try {
        localStorage.setItem('waripos_show_balance', String(next))
      } catch {}
      return next
    })
  }, [])

  const fetchCashData = useCallback(async () => {
    try {
      const [rKas, rBank, rShift] = await Promise.all([
        api<ActiveKasDrawer>('kas:getActiveKas', user?.nama_pengguna),
        api<BankAccountInfo[]>('bank:getAccounts'),
        api<ActiveShift>('shift:getCurrent', user?.nama_pengguna),
      ])
      if (rKas.success && rKas.data) {
        cachedActiveDrawer = rKas.data
        setActiveDrawer(rKas.data)
      } else {
        cachedActiveDrawer = null
        setActiveDrawer(null)
      }
      if (rShift.success && rShift.data) {
        cachedActiveShift = rShift.data
        setActiveShift(rShift.data)
      } else {
        cachedActiveShift = null
        setActiveShift(null)
      }
      if (rBank.success && Array.isArray(rBank.data)) {
        const active = rBank.data.filter(b => b.status === 'AKTIF')
        cachedBankAccounts = active
        setBankAccounts(active)
      } else {
        cachedBankAccounts = []
        setBankAccounts([])
      }
    } catch {
      // Ignore
    }
  }, [user?.nama_pengguna])

  // Calculation of Cash breakdown
  const modalAwal = useMemo(() => {
    return Number(activeDrawer?.modal_awal || activeShift?.opening_balance || 0)
  }, [activeDrawer, activeShift])

  const cashSales = useMemo(() => {
    return Number(activeShift?.total_tunai ?? activeDrawer?.total_penjualan ?? 0)
  }, [activeShift, activeDrawer])

  const additionalIncome = useMemo(() => {
    return Number(activeDrawer?.total_pemasukan || activeShift?.total_pemasukan || 0)
  }, [activeDrawer, activeShift])

  const totalPemasukanKas = useMemo(() => {
    return cashSales + additionalIncome
  }, [cashSales, additionalIncome])

  const totalPengeluaranKas = useMemo(() => {
    return Number(activeDrawer?.total_pengeluaran || activeShift?.total_pengeluaran || 0)
  }, [activeDrawer, activeShift])

  const expectedCashLaci = useMemo(() => {
    if (activeShift && typeof activeShift.expected_cash === 'number') {
      return Number(activeShift.expected_cash)
    }
    return modalAwal + totalPemasukanKas - totalPengeluaranKas
  }, [activeShift, modalAwal, totalPemasukanKas, totalPengeluaranKas])

  const fetchData = useCallback(async (showToast = false) => {
    // Only flash skeleton loading if there is NO data in memory yet!
    if (!summaryRef.current) {
      setLoading(true)
    }
    setError(false)
    try {
      const [r, , rLogs, rBackups] = await Promise.all([
        api<DashboardSummary>('dashboard:getSummary'),
        fetchCashData(),
        api<any[]>('activityLog:getAll').catch(() => ({ success: false, data: [] })),
        api<any[]>('backup:getAll').catch(() => ({ success: false, data: [] })),
      ])

      if (r.success && r.data) {
        const norm = normalizeDashboardSummary(r.data)
        cachedDashboardSummary = norm
        setSummary(norm)
        if (showToast) toast('Data dashboard diperbarui', 'success')
      } else if (!summaryRef.current) {
        setError(true)
      }

      if (rLogs && rLogs.success && Array.isArray(rLogs.data)) {
        const sliced = rLogs.data.slice(0, 8)
        cachedRecentLogs = sliced
        setRecentLogs(sliced)
      }

      if (rBackups && rBackups.success && Array.isArray(rBackups.data)) {
        const latest = rBackups.data[0]
        const takenAt = latest?.tgl_backup ? new Date(latest.tgl_backup).getTime() : NaN
        setLastBackupHours(Number.isFinite(takenAt) ? Math.max(0, Math.round((Date.now() - takenAt) / 3600000)) : null)
      }
    } catch {
      if (!summaryRef.current) setError(true)
    } finally {
      setLoading(false)
    }
  }, [toast, fetchCashData])

  const fetchInsights = useCallback(async () => {
    // Only flash skeleton loading if insights are not yet cached
    if (!insightsRef.current || insightsRef.current === EMPTY_INSIGHTS) {
      setInsightsLoading(true)
    }
    setInsightsError('')
    try {
      const r = await api<InsightData>('ownerDashboard:getInsights')
      if (r.success && r.data) {
        cachedInsights = r.data
        setInsights(r.data)
      } else if (!insightsRef.current || insightsRef.current === EMPTY_INSIGHTS) {
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
      toast('Data disalin. Google Sheets dibuka, tempel di sel A1.', 'success')
    } catch (err) {
      toast(`Gagal export: ${err instanceof Error ? err.message : 'Error'}`, 'error')
    } finally {
      setExportingSheets(false)
    }
  }, [summary, toast])

  const handleQuickCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = quickCashForm.amount.replace(/\D/g, '')
    const amountNum = parseFloat(cleaned)
    if (!amountNum || amountNum <= 0) {
      toast('Nominal harus lebih dari 0', 'error')
      return
    }

    setQuickCashLoading(true)
    try {
      if (quickCashModal === 'openCash') {
        const [rKas, rShift] = await Promise.all([
          api('kas:bukaKas', user?.nama_pengguna, amountNum, quickCashForm.note || 'Modal Awal'),
          api('shift:open', { user_id: user?.nama_pengguna, opening_balance: amountNum }),
        ])
        if (rKas.success || rShift.success) {
          window.dispatchEvent(new CustomEvent('app:refresh'))
          toast('Kasir dan Shift berhasil dibuka!', 'success')
          setQuickCashModal(null)
          setQuickCashForm({ amount: '', note: '' })
          fetchCashData()
          fetchData()
        } else {
          toast((rKas.message as string) || (rShift.message as string) || 'Gagal membuka kas/shift', 'error')
        }
      } else if (quickCashModal === 'income') {
        if (!activeDrawer) {
          toast('Buka kas kasir terlebih dahulu untuk mencatat pemasukan laci', 'info')
          setQuickCashModal('openCash')
          setQuickCashForm({ amount: quickCashForm.amount, note: 'Modal Awal' })
          return
        }
        const r = await api('kas:addPemasukan', activeDrawer.kd_kas, amountNum, quickCashForm.note || 'Kas Masuk', user?.nama_pengguna)
        if (r.success) {
          window.dispatchEvent(new CustomEvent('app:refresh'))
          toast('Pemasukan kas berhasil dicatat!', 'success')
          setQuickCashModal(null)
          setQuickCashForm({ amount: '', note: '' })
          fetchCashData()
          fetchData()
        } else {
          toast((r.message as string) || 'Gagal menambah pemasukan kas', 'error')
        }
      } else if (quickCashModal === 'expense') {
        if (!activeDrawer) {
          toast('Buka kas kasir terlebih dahulu untuk mencatat pengeluaran laci', 'info')
          setQuickCashModal('openCash')
          setQuickCashForm({ amount: '', note: 'Modal Awal' })
          return
        }
        const r = await api('kas:addPengeluaran', activeDrawer.kd_kas, amountNum, quickCashForm.note || 'Pengeluaran Kas', user?.nama_pengguna)
        if (r.success) {
          window.dispatchEvent(new CustomEvent('app:refresh'))
          toast('Pengeluaran kas berhasil dicatat!', 'success')
          setQuickCashModal(null)
          setQuickCashForm({ amount: '', note: '' })
          fetchCashData()
          fetchData()
        } else {
          toast((r.message as string) || 'Gagal mencatat pengeluaran kas', 'error')
        }
      }
    } finally {
      setQuickCashLoading(false)
    }
  }

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickCashLoading(true)
    try {
      const actualCash = Number(closeShiftForm.closingBalance.replace(/\D/g, '')) || 0
      const diff = actualCash - expectedCashLaci

      const promises: Promise<any>[] = []
      if (activeShift?.id) {
        promises.push(
          api('shift:close', activeShift.id, {
            closing_balance: actualCash,
            notes: closeShiftForm.notes,
          })
        )
      }
      if (activeDrawer?.kd_kas) {
        promises.push(
          api('kas:tutupKas', activeDrawer.kd_kas, actualCash, diff, closeShiftForm.notes || 'Tutup Shift dari Dashboard')
        )
      }

      await Promise.all(promises)
      window.dispatchEvent(new CustomEvent('app:refresh'))
      toast('Shift kasir dan kas laci berhasil ditutup.', 'success')
      setQuickCashModal(null)
      setCloseShiftForm({ closingBalance: '', notes: '' })
      await fetchCashData()
      await fetchData(true)
    } catch (err: any) {
      toast(err.message || 'Gagal menutup shift kasir', 'error')
    } finally {
      setQuickCashLoading(false)
    }
  }

  const ALL_SERVICES = useMemo(() => [
    {
      category: 'Penjualan & Kasir',
      items: [
        { label: 'Kasir POS', to: '/transaksi', icon: ShoppingCart },
        { label: 'Riwayat Transaksi', to: '/riwayat', icon: Receipt },
        { label: 'Shift Kasir', to: '/shifts', icon: Clock },
        { label: 'Manajemen Meja', to: '/table-management', icon: Store },
        { label: 'Kitchen Display', to: '/kitchen-display', icon: Utensils },
        { label: 'Customer Display', to: '/customer-display-window', icon: Layers },
      ]
    },
    {
      category: 'Barang & Inventaris',
      items: [
        { label: 'Katalog Produk', to: '/produk', icon: Package },
        { label: 'Daftar Harga', to: '/price-list', icon: Calculator },
        { label: 'Stok Opname', to: '/stock-opname', icon: ClipboardList },
        { label: 'Riwayat Stok', to: '/stock-history', icon: History },
        { label: 'Cetak Label Barcode', to: '/label-print', icon: BarChart2 },
        { label: 'Kategori Produk', to: '/kategori', icon: Layers },
      ]
    },
    {
      category: 'Keuangan & Kas',
      items: [
        { label: 'Kelola Kas Toko', to: '/kas', icon: Wallet },
        { label: 'Rekening Bank', to: '/bank-account', icon: Building2 },
        { label: 'Kas Kecil (Petty Cash)', to: '/petty-cash', icon: DollarSign },
        { label: 'Arus Kas (Cash Flow)', to: '/cash-flow', icon: TrendingUp },
        { label: 'Hutang & Piutang', to: '/debts', icon: AlertTriangle },
        { label: 'Buku Akuntansi', to: '/accounting', icon: Table2 },
      ]
    },
    {
      category: 'Mitra & Pelanggan',
      items: [
        { label: 'Pembelian Supplier', to: '/pembelian', icon: Truck },
        { label: 'Master Supplier', to: '/supplier', icon: Users2 },
        { label: 'Data Pelanggan', to: '/customer', icon: Users2 },
        { label: 'Catatan Harian', to: '/catatan-harian', icon: FileText },
      ]
    },
    {
      category: 'Laporan & Sistem',
      items: [
        { label: 'Laporan Penjualan', to: '/laporan', icon: BarChart2 },
        { label: 'Laba Rugi & HPP', to: '/hpp', icon: TrendingUp },
        { label: 'Asisten WariAI', to: '/assistant', icon: MessagesSquare },
        { label: 'Pengaturan Sistem', to: '/settings', icon: SettingsIcon },
        { label: 'Pengguna & PIN', to: '/users', icon: Shield },
        { label: 'Backup Database', to: '/backup', icon: Database },
      ]
    },
  ], [])

  const filteredServices = useMemo(() => {
    if (!allServicesSearch.trim()) return ALL_SERVICES
    const q = allServicesSearch.toLowerCase()
    return ALL_SERVICES.map(cat => ({
      ...cat,
      items: cat.items.filter(it => it.label.toLowerCase().includes(q))
    })).filter(cat => cat.items.length > 0)
  }, [allServicesSearch, ALL_SERVICES])

  const dashboard = summary ?? EMPTY_SUMMARY
  const recentTransactions = dashboard.recentTransactions ?? []
  const topProducts = (dashboard.topProducts ?? []).slice(0, 5)
  const topProductMaxQty = topProducts.reduce((max, p) => Math.max(max, p.total_qty), 0)
  const ownerPeakHours = insights.peakHours ?? []
  const activeOwnerPeakHours = ownerPeakHours.filter(item => item.count > 0)
  const ownerPeakHour = activeOwnerPeakHours.reduce<typeof ownerPeakHours[number] | null>(
    (best, item) => (!best || item.count > best.count ? item : best),
    null,
  )

  const todayAvgTicket = useMemo(() => {
    if (dashboard.today.count <= 0) return 0
    return Math.round(dashboard.today.total / dashboard.today.count)
  }, [dashboard.today.count, dashboard.today.total])

  // null when there is no sale yesterday to compare against
  const percentSalesChange = useMemo<number | null>(() => {
    const yTotal = dashboard.yesterdayTotal ?? 0
    if (yTotal <= 0) return null
    return Math.round(((dashboard.today.total - yTotal) / yTotal) * 100)
  }, [dashboard.today.total, dashboard.yesterdayTotal])

  const activeChartData = useMemo(() => {
    if (chartFilter === '30d') {
      return (dashboard.chartData30 && dashboard.chartData30.length > 0)
        ? dashboard.chartData30
        : dashboard.chartData
    }
    return dashboard.chartData
  }, [chartFilter, dashboard.chartData, dashboard.chartData30])

  const chartPeriodTotal = useMemo(
    () => activeChartData.reduce((sum, row) => sum + row.total, 0),
    [activeChartData],
  )

  const hasCashSession = Boolean(activeShift || activeDrawer)
  const sessionStartTime = clockTime(activeShift?.start_time || activeDrawer?.tgl_buka)
  const sessionCashier = activeDrawer?.nama_kasir || activeDrawer?.username || activeShift?.user_id || ''

  const stockOutCount = dashboard.alertSummary?.stockOutCount ?? 0
  const lowStockCount = dashboard.lowStockCount
  const backupStale = lastBackupHours === null || (typeof lastBackupHours === 'number' && lastBackupHours >= 24 * 7)

  const attentionItems: Array<{
    key: string
    label: string
    value: string
    hint: string
    tone: Tone
    icon: typeof Package
    to: string
  }> = [
    {
      key: 'stock-out',
      label: 'Stok habis',
      value: stockOutCount > 0 ? `${stockOutCount} produk` : 'Tidak ada',
      hint: stockOutCount > 0 ? 'Tidak bisa dijual sampai diisi ulang' : 'Semua produk masih punya stok',
      tone: stockOutCount > 0 ? 'danger' : 'ok',
      icon: PackageX,
      to: '/produk',
    },
    {
      key: 'stock-low',
      label: 'Stok menipis',
      value: lowStockCount > 0 ? `${lowStockCount} produk` : 'Tidak ada',
      hint: lowStockCount > 0 ? 'Sudah di bawah stok minimum' : 'Semua di atas stok minimum',
      tone: lowStockCount > 0 ? 'warn' : 'ok',
      icon: AlertTriangle,
      to: '/produk',
    },
    {
      key: 'shift',
      label: 'Shift kasir',
      value: hasCashSession ? (sessionStartTime ? `Buka ${sessionStartTime}` : 'Aktif') : 'Belum dibuka',
      hint: hasCashSession ? (sessionCashier ? `Kasir: ${sessionCashier}` : 'Kasir sedang berjalan') : 'Buka kasir sebelum mulai jualan',
      tone: hasCashSession ? 'ok' : 'warn',
      icon: Clock,
      to: '/shifts',
    },
    {
      key: 'backup',
      label: 'Backup data',
      value: backupAgeText(lastBackupHours),
      hint: backupStale ? 'Buat backup agar data toko aman' : 'Backup terakhir tersimpan',
      tone: backupStale ? 'warn' : 'ok',
      icon: Database,
      to: '/backup',
    },
  ]
  const attentionCount = attentionItems.filter(item => item.tone !== 'ok').length

  const userName = user?.nama_lengkap || user?.nama_pengguna || ''
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'
    return 'Selamat malam'
  }, [])
  const roleLabel = user?.hak_akses ? user.hak_akses.charAt(0).toUpperCase() + user.hak_akses.slice(1).replace(/_/g, ' ') : ''

  const currentDateText = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
    } catch {
      return 'Hari ini'
    }
  }, [])

  const axisTickColor = isDark ? '#94a3b8' : '#64748b'

  const openQuickCash = (kind: 'income' | 'expense' | 'openCash') => {
    setQuickCashForm({ amount: '', note: kind === 'openCash' ? 'Modal Awal' : '' })
    setQuickCashModal(kind)
  }

  const refreshAll = () => { fetchData(true); if (isAdmin) fetchInsights() }
  const refreshing = loading || (isAdmin && insightsLoading)

  return (
    <div className="min-h-full -m-4 sm:-m-5 p-4 sm:p-6 pb-28 sm:pb-32 lg:pb-8 bg-primary-50 dark:bg-slate-950 space-y-5 text-slate-800 dark:text-slate-100 select-none">
      {/* ── Greeting ── */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-600 dark:text-slate-400">{currentDateText}</p>
          <h1 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {userName ? `${greeting}, ${userName}` : greeting}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {roleLabel && (
            <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {roleLabel}
            </span>
          )}
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center active:scale-95"
            title="Segarkan data dashboard"
            aria-label="Segarkan data dashboard"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-primary-600' : ''} />
          </button>
        </div>
      </header>

      {/* ── Mode switcher (admin only) ── */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:inline-grid sm:w-auto w-full p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {([
            { id: 'operasional', label: 'Operasional', icon: Store },
            { id: 'analisis', label: 'Analisis owner', icon: BarChart2 },
          ] as const).map(tab => {
            const active = activeTab === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] sm:min-h-[38px] flex items-center justify-center gap-2 px-4 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <TabIcon size={15} className={active ? 'text-primary-600 dark:text-primary-400' : ''} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle size={20} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">Data dashboard gagal dimuat</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Database lokal tidak merespons. Periksa koneksi lalu coba lagi.</p>
          </div>
          <Button onClick={() => fetchData(true)} icon={<RefreshCw size={14} />} className="min-h-[44px]">
            Coba lagi
          </Button>
        </div>
      )}

      {/* ── Empty store: offer sample data ── */}
      {!error && !loading && dashboard.totalBarang === 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <PackagePlus size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Belum ada produk di toko ini</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Tambahkan produk dulu, atau muat data contoh supaya grafik dan ringkasan langsung terisi.
              </p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-2 shrink-0">
            <Button variant="secondary" onClick={() => navigate('/produk')} className="flex-1 sm:flex-none min-h-[44px] text-xs">
              Tambah produk
            </Button>
            <Button
              variant="secondary"
              icon={<PackagePlus size={14} />}
              loading={seedingDemo}
              onClick={() => setConfirmSeedModal(true)}
              className="flex-1 sm:flex-none min-h-[44px] text-xs"
            >
              Muat data contoh
            </Button>
          </div>

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
            message="Apakah Anda yakin ingin memuat data contoh toko?"
            confirmText="Ya, Muat Data Contoh"
            variant="warning"
            loading={seedingDemo}
          />
        </div>
      )}

      {/* ── TAB 1: OPERASIONAL TOKO ── */}
      {!error && activeTab === 'operasional' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">

            {/* Today's receipt, the focal point: shop awning on top, pastel sales half, torn paper bottom (receipt motif). */}
            <section
              aria-labelledby="struk-heading"
              className="order-1 lg:col-span-7 xl:col-span-8 [filter:drop-shadow(0_10px_18px_rgba(var(--glass-shadow-rgb),0.16))] dark:[filter:none]"
            >
              <div className="receipt-edge rounded-t-3xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="bg-primary-100 dark:bg-slate-800 px-5 pb-5 sm:px-7">
                  <div className="awning -mx-5 sm:-mx-7 mb-3" aria-hidden="true" />

                  <div className="flex items-start justify-between gap-3">
                    <h2 id="struk-heading" className="text-sm font-semibold text-primary-900 dark:text-primary-100">Omzet hari ini</h2>
                    {!loading && percentSalesChange !== null && (
                      <span className="rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary-800 dark:text-primary-200">
                        {percentSalesChange >= 0 ? '+' : '−'}{Math.abs(percentSalesChange)}% dari kemarin
                      </span>
                    )}
                  </div>

                  <div className="mt-1 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-end">
                    {loading ? (
                      <div className="h-10 sm:h-12 w-52 max-w-full rounded-lg bg-white/70 dark:bg-slate-700 animate-pulse" aria-label="Memuat omzet" />
                    ) : (
                      <p className="text-[2rem] sm:text-5xl font-black tracking-tight leading-tight tabular-nums break-words text-slate-900 dark:text-white">
                        {formatRupiah(dashboard.today.total)}
                      </p>
                    )}
                    <HourlyBars data={dashboard.hourlySales ?? []} loading={loading} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Transaksi', value: String(dashboard.today.count) },
                      { label: 'Item terjual', value: String(dashboard.todayQtySold ?? 0) },
                      { label: 'Rata-rata struk', value: formatRupiah(todayAvgTicket) },
                    ].map(fact => (
                      <div key={fact.label} className="rounded-2xl bg-white/80 dark:bg-slate-900/70 px-3 py-2.5 min-w-0">
                        <dt className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate">{fact.label}</dt>
                        <dd className="mt-0.5 text-sm sm:text-base font-bold tabular-nums break-words text-slate-900 dark:text-white">{loading ? '…' : fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Perforation with punched notches, between the sales half and the cash-drawer half */}
                <div className="relative h-0" aria-hidden="true">
                  <div className="absolute inset-x-5 sm:inset-x-7 top-0 border-t-2 border-dashed border-primary-300 dark:border-slate-700" />
                  <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-primary-50 dark:bg-slate-950" />
                  <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-primary-50 dark:bg-slate-950" />
                </div>

                <div className="px-5 pt-5 sm:px-7 text-slate-900 dark:text-slate-100">
                  {/* Wallet illustration sits beside the drawer balance it represents; hidden below 360px where the amount needs the full width */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <Wallet size={16} className="text-primary-700 dark:text-primary-300 shrink-0 min-[360px]:hidden" />
                        <h3 className="text-sm font-semibold">Uang di laci</h3>
                        <button
                          type="button"
                          onClick={toggleShowBalance}
                          className="-my-2 w-11 h-11 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                          title={showBalance ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
                          aria-label={showBalance ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
                        >
                          {showBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {loading ? 'Memeriksa kasir' : hasCashSession
                          ? (sessionStartTime ? `Shift buka sejak ${sessionStartTime}` : 'Shift aktif')
                          : 'Kasir belum dibuka'}
                      </p>

                      {loading ? (
                        <div className="mt-2 h-8 w-40 max-w-full rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" aria-label="Memuat saldo laci" />
                      ) : (
                        <p className="mt-1.5 text-2xl sm:text-3xl font-bold tabular-nums break-words">
                          {showBalance ? formatRupiah(expectedCashLaci) : 'Rp ••••••'}
                        </p>
                      )}
                    </div>
                    <WalletArt className="hidden min-[360px]:block w-28 sm:w-36 lg:w-40 shrink-0 -mt-2" />
                  </div>

                  {showBalance && hasCashSession && (
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      <span>Modal {formatRupiah(modalAwal)}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">Masuk +{formatRupiah(totalPemasukanKas)}</span>
                      <span className="text-red-700 dark:text-red-400">Keluar −{formatRupiah(totalPengeluaranKas)}</span>
                    </p>
                  )}

                  {loading ? (
                    <div className="mt-4 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" aria-hidden="true" />
                  ) : hasCashSession ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openQuickCash('income')}
                        className="min-h-[44px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                      >
                        <Plus size={15} /> Kas masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => openQuickCash('expense')}
                        className="min-h-[44px] rounded-xl bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-primary-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                      >
                        <Minus size={15} /> Kas keluar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCloseShiftForm({ closingBalance: '', notes: '' })
                          setQuickCashModal('closeShift')
                        }}
                        className="min-h-[44px] rounded-xl bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-primary-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                      >
                        <Lock size={14} /> Tutup shift
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openQuickCash('openCash')}
                      className="mt-4 w-full min-h-[44px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition"
                    >
                      <Unlock size={15} /> Buka kasir dan isi modal awal
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Quick actions: "Mulai jualan" is the most used action, so it takes double width */}
            <nav aria-label="Aksi cepat" className="order-2 lg:order-3 lg:col-span-12 grid grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate('/transaksi')}
                className="col-span-2 h-[5.5rem] flex items-center gap-3 px-3 sm:px-4 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-left active:scale-[0.98] transition"
              >
                <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShoppingCart size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold truncate">Mulai jualan</span>
                  <span className="block text-[11px] text-white truncate">Buka halaman kasir</span>
                </span>
              </button>
              {[
                { label: 'Produk', icon: Package, onClick: () => navigate('/produk') },
                { label: 'Pembelian', icon: Truck, onClick: () => navigate('/pembelian') },
                { label: 'Stok opname', icon: ClipboardCheck, onClick: () => navigate('/stock-opname') },
                { label: 'Laporan', icon: BarChart2, onClick: () => navigate('/laporan') },
                { label: 'WariAI', icon: MessagesSquare, onClick: () => navigate('/assistant') },
                { label: 'Semua menu', icon: LayoutGrid, onClick: () => setAllServicesModal(true) },
              ].map(action => {
                const ActionIcon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="h-[5.5rem] flex flex-col items-center justify-center gap-1.5 px-1 rounded-2xl border border-primary-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-slate-800 active:scale-95 transition group"
                  >
                    <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 dark:bg-slate-800 dark:text-primary-300 group-hover:bg-white dark:group-hover:bg-slate-700 flex items-center justify-center transition-colors">
                      <ActionIcon size={19} />
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium leading-tight text-center line-clamp-2">{action.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Things that need the owner's action, derived from real counts */}
            <section
              aria-labelledby="attention-heading"
              className="order-3 lg:order-2 lg:col-span-5 xl:col-span-4 rounded-2xl border border-primary-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <IconChip><ClipboardCheck size={17} /></IconChip>
                <div className="min-w-0">
                  <h2 id="attention-heading" className="text-sm font-semibold text-slate-900 dark:text-white">Perlu dicek</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {loading ? 'Memeriksa kondisi toko' : attentionCount > 0 ? `${attentionCount} hal butuh tindakan` : 'Tidak ada yang perlu ditindaklanjuti'}
                  </p>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-dashed divide-primary-200 dark:divide-slate-800">
                {attentionItems.map(item => {
                  const ItemIcon = item.icon
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => navigate(item.to)}
                        className="w-full min-h-[56px] py-2.5 flex items-center gap-3 text-left group"
                      >
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TONE_ICON[item.tone]}`}>
                          <ItemIcon size={17} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{loading ? 'Memeriksa' : item.hint}</span>
                        </span>
                        {loading ? (
                          <Skeleton className="h-4 w-16" />
                        ) : (
                          <span className={`text-sm font-semibold whitespace-nowrap tabular-nums ${TONE_TEXT[item.tone]}`}>{item.value}</span>
                        )}
                        <ChevronRight size={16} className="text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-5">
            {/* Daily revenue trend */}
            <Panel
              className="md:col-span-2 xl:col-span-8"
              title="Omzet harian"
              icon={<TrendingUp size={17} />}
              subtitle={
                loading
                  ? 'Memuat data penjualan'
                  : `${activeChartData.length} hari terakhir, total ${formatRupiah(chartPeriodTotal)}`
              }
              action={
                <div className="flex items-center gap-2">
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
                    {(['7d', '30d'] as const).map(range => (
                      <button
                        key={range}
                        type="button"
                        aria-pressed={chartFilter === range}
                        onClick={() => setChartFilter(range)}
                        className={`h-10 sm:h-8 px-3 rounded-md transition-colors ${
                          chartFilter === range
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {range === '7d' ? '7 hari' : '30 hari'}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportGoogleSheets}
                    icon={<Table2 size={13} />}
                    loading={exportingSheets}
                    disabled={!summary}
                    className="h-10 sm:h-8 text-xs"
                    title="Kirim ringkasan dashboard ke Google Sheets"
                  >
                    Sheets
                  </Button>
                </div>
              }
            >
              {loading ? (
                <SkeletonChart className="border-0 p-0" />
              ) : chartPeriodTotal <= 0 ? (
                <EmptyBlock
                  icon={<TrendingUp size={20} />}
                  title="Belum ada penjualan di periode ini"
                  text="Setiap transaksi dari halaman kasir akan tercatat di grafik ini."
                  action={{ label: 'Buka kasir', onClick: () => navigate('/transaksi') }}
                />
              ) : (
                <ChartSurface height={230}>
                  {width => (
                    <AreaChart width={width} height={230} data={activeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.fill} stopOpacity={0.45} />
                          <stop offset="95%" stopColor={chartColors.fill} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} dy={6} minTickGap={12} />
                      <YAxis
                        tick={{ fontSize: 11, fill: axisTickColor }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="total" stroke={chartColors.line} strokeWidth={2.5} fill="url(#colorTrend)" animationDuration={500} />
                    </AreaChart>
                  )}
                </ChartSurface>
              )}
            </Panel>

            {/* Best sellers: the bar shows each product's quantity relative to the #1 product */}
            <Panel
              className="xl:col-span-4"
              title="Produk terlaris"
              icon={<Package size={17} />}
              subtitle="Minggu ini, menurut jumlah terjual"
              action={<TextLink onClick={() => navigate('/laporan')}>Laporan</TextLink>}
            >
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
                </div>
              ) : topProducts.length === 0 ? (
                <EmptyBlock
                  icon={<Package size={20} />}
                  title="Belum ada produk terjual minggu ini"
                  text="Produk paling laku akan muncul di sini setelah ada transaksi."
                />
              ) : (
                <ol className="space-y-3.5">
                  {topProducts.map((p, idx) => (
                    <li key={p.kd_barang || idx} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black tabular-nums shrink-0 ${idx === 0 ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-800 dark:bg-slate-800 dark:text-primary-200'}`}>
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {p.foto_barang ? (
                          <img src={p.foto_barang} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={16} className="text-primary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.nama_barang || 'Tanpa nama'}</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">{formatRupiah(p.total_revenue || 0)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-primary-50 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${idx === 0 ? 'bg-primary-500' : 'bg-primary-300 dark:bg-primary-700'}`}
                              style={{ width: `${topProductMaxQty > 0 ? Math.max(4, (p.total_qty / topProductMaxQty) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{p.total_qty} terjual</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            {/* Latest receipts, straight from the sales table */}
            <Panel
              className="xl:col-span-12"
              title="Transaksi terakhir"
              icon={<Receipt size={17} />}
              subtitle="5 struk terbaru"
              action={<TextLink onClick={() => navigate('/riwayat')}>Riwayat</TextLink>}
            >
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : recentTransactions.length === 0 ? (
                <EmptyBlock
                  icon={<Receipt size={20} />}
                  title="Belum ada transaksi"
                  text="Struk yang dibuat di halaman kasir akan tampil di sini."
                  action={{ label: 'Buat transaksi', onClick: () => navigate('/transaksi') }}
                />
              ) : (
                <ul className="divide-y divide-dashed divide-primary-200 dark:divide-slate-800 -my-2">
                  {recentTransactions.map(t => {
                    const when = formatTransactionTime(t.tgl_wkt_transaksi)
                    const customer = t.nama_customer || 'Pelanggan umum'
                    const method = t.jenis_pembayaran || '-'
                    return (
                      <li
                        key={t.kd_tansaksi_jual}
                        className="py-3 grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto] gap-x-4 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate tabular-nums">#{t.kd_tansaksi_jual}</p>
                          <p className="xl:hidden text-xs text-slate-500 dark:text-slate-400 truncate">
                            {when} · {customer} · {method}
                          </p>
                        </div>
                        <p className="hidden xl:block text-sm text-slate-600 dark:text-slate-300 tabular-nums">{when}</p>
                        <p className="hidden xl:block text-sm text-slate-600 dark:text-slate-300 truncate">{customer}</p>
                        <p className="hidden xl:block"><span className="inline-block max-w-full truncate rounded-full bg-primary-50 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-200">{method}</span></p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums text-right whitespace-nowrap">{formatRupiah(t.total_penjualan)}</p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ── TAB 2: ANALISIS OWNER ── */}
      {!error && activeTab === 'analisis' && isAdmin && (
        <div className="space-y-5">
          {insightsError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <span>{insightsError}</span>
              <button type="button" onClick={fetchInsights} className="min-h-[44px] px-2 font-semibold underline underline-offset-2">
                Muat ulang
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Month-to-date vs projection is the owner's main question, so it leads */}
            <section className="lg:col-span-5 rounded-2xl bg-primary-100 dark:bg-slate-800 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Penjualan bulan ini</h2>
              {insightsLoading ? (
                <Skeleton className="mt-3 h-10 w-48" />
              ) : (
                <p className="mt-2 text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white break-words">
                  {formatRupiah(insights.kpis.salesMonth)}
                </p>
              )}
              {!insightsLoading && insights.kpis.projectedMonth > 0 && (() => {
                const pct = Math.min(100, Math.round((insights.kpis.salesMonth / insights.kpis.projectedMonth) * 100))
                return (
                  <div className="mt-5">
                    <div className="flex items-baseline justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>Proyeksi akhir bulan</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatRupiah(insights.kpis.projectedMonth)}</span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-white dark:bg-slate-900 overflow-hidden">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">{pct}% dari proyeksi sudah tercapai</p>
                  </div>
                )
              })()}
            </section>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
              {[
                { label: 'Penjualan hari ini', value: insights.kpis.salesToday },
                { label: 'Laba kotor bulan ini', value: insights.kpis.grossProfitMonth },
                { label: 'Rata-rata per hari', value: insights.kpis.avgDailySales },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-2xl border border-primary-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                  <p className="text-xs text-slate-600 dark:text-slate-400">{kpi.label}</p>
                  {insightsLoading ? (
                    <Skeleton className="mt-3 h-6 w-28" />
                  ) : (
                    <p className="mt-2 text-lg sm:text-xl font-bold tabular-nums text-slate-900 dark:text-white break-words">{formatRupiah(kpi.value)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            <Panel
              className="md:col-span-2 xl:col-span-1"
              title="Jam paling ramai"
              icon={<Clock size={17} />}
              subtitle="Jumlah transaksi per jam, 30 hari terakhir"
            >
              {insightsLoading ? (
                <InsightSkeleton rows={4} />
              ) : activeOwnerPeakHours.length === 0 ? (
                <EmptyBlock icon={<Clock size={20} />} title="Belum ada transaksi 30 hari terakhir" text="Jam ramai akan terlihat setelah ada penjualan." />
              ) : (
                <div className="space-y-3">
                  <ChartSurface height={150}>
                    {width => (
                      <BarChart width={width} height={150} data={ownerPeakHours} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.18)" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: axisTickColor }} axisLine={false} tickLine={false} minTickGap={4} />
                        <YAxis tick={{ fontSize: 10, fill: axisTickColor }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                        <Tooltip content={<HourlyChartTooltip />} />
                        <Bar dataKey="count" fill={chartColors.fill} radius={[3, 3, 0, 0]} maxBarSize={14} />
                      </BarChart>
                    )}
                  </ChartSurface>
                  {ownerPeakHour && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Paling ramai jam <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{ownerPeakHour.hour}</span>,
                      {' '}<span className="tabular-nums">{ownerPeakHour.count}</span> transaksi.
                    </p>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="Kinerja kasir" icon={<Users2 size={17} />} subtitle="Transaksi dan penjualan per kasir">
              {insightsLoading ? (
                <InsightSkeleton />
              ) : insights.cashierPerformance.length === 0 ? (
                <EmptyBlock icon={<Users2 size={20} />} title="Belum ada data kasir" text="Penjualan per kasir muncul setelah kasir membuat transaksi." />
              ) : (() => {
                const maxTotal = insights.cashierPerformance.reduce((m, r) => Math.max(m, r.total), 0)
                return (
                  <ul className="space-y-3.5">
                    {insights.cashierPerformance.map(row => (
                      <li key={row.username} className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold uppercase shrink-0">
                          {(row.username || '?').charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{row.username || '-'}</p>
                            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">{formatRupiah(row.total)}</p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-primary-500" style={{ width: `${maxTotal > 0 ? Math.max(4, (row.total / maxTotal) * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{row.count} transaksi</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </Panel>

            <Panel title="Segmen pelanggan" icon={<Users2 size={17} />} subtitle="Status belanja pelanggan terdaftar">
              {insightsLoading ? (
                <InsightSkeleton />
              ) : (() => {
                const segments = [
                  { label: 'Member VIP', value: insights.customerSegments.vip },
                  { label: 'Aktif belanja', value: insights.customerSegments.active },
                  { label: 'Belum belanja', value: insights.customerSegments.inactive },
                ]
                const total = segments.reduce((s, x) => s + x.value, 0)
                if (total === 0) {
                  return <EmptyBlock icon={<Users2 size={20} />} title="Belum ada pelanggan terdaftar" text="Tambahkan pelanggan di menu Data Pelanggan." action={{ label: 'Data pelanggan', onClick: () => navigate('/customer') }} />
                }
                return (
                  <ul className="space-y-3.5">
                    {segments.map(seg => (
                      <li key={seg.label}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{seg.label}</span>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{seg.value}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${(seg.value / total) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </Panel>
          </div>
        </div>
      )}

      {/* ── MODAL QUICK CASH (KAS MASUK / KAS KELUAR / BUKA KAS) ── */}
      <Modal
        open={quickCashModal !== null && quickCashModal !== 'closeShift'}
        onClose={() => {
          setQuickCashModal(null)
          setQuickCashForm({ amount: '', note: '' })
        }}
        title={
          quickCashModal === 'openCash'
            ? 'Buka kasir'
            : quickCashModal === 'income'
            ? 'Catat kas masuk'
            : 'Catat kas keluar'
        }
        size="sm"
      >
        <form onSubmit={handleQuickCashSubmit} className="space-y-4 pt-1">
          <div>
            <label htmlFor="quick-cash-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {quickCashModal === 'openCash' ? 'Modal awal di laci (Rp)' : 'Nominal (Rp)'}
            </label>
            <Input
              id="quick-cash-amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={quickCashForm.amount ? Number(quickCashForm.amount.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '')
                setQuickCashForm(f => ({ ...f, amount: raw }))
              }}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="quick-cash-note" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Keterangan (opsional)
            </label>
            <Input
              id="quick-cash-note"
              type="text"
              placeholder={
                quickCashModal === 'openCash'
                  ? 'Contoh: Modal kembalian awal'
                  : quickCashModal === 'income'
                  ? 'Contoh: Tambahan modal laci'
                  : 'Contoh: Beli es batu dan plastik'
              }
              value={quickCashForm.note}
              onChange={e => setQuickCashForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuickCashModal(null)
                setQuickCashForm({ amount: '', note: '' })
              }}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={quickCashLoading}>
              {quickCashModal === 'openCash' ? 'Buka kasir' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL TUTUP SHIFT & REKONSILIASI KAS ── */}
      <Modal
        open={quickCashModal === 'closeShift'}
        onClose={() => {
          setQuickCashModal(null)
          setCloseShiftForm({ closingBalance: '', notes: '' })
        }}
        title="Tutup shift dan hitung laci"
        size="md"
      >
        <form onSubmit={handleCloseShiftSubmit} className="space-y-4 pt-1">
          <dl className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-2 text-sm tabular-nums">
            <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
              <dt>Kasir</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeDrawer?.nama_kasir || activeDrawer?.username || activeShift?.shift_number || user?.nama_pengguna}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
              <dt>Modal awal</dt>
              <dd className="text-slate-800 dark:text-slate-200">{formatRupiah(modalAwal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
              <dt>Penjualan tunai</dt>
              <dd className="text-emerald-700 dark:text-emerald-400">+{formatRupiah(cashSales)}</dd>
            </div>
            {(activeShift?.total_nontunai || 0) > 0 && (
              <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                <dt>Non-tunai (masuk rekening)</dt>
                <dd className="text-slate-800 dark:text-slate-200">{formatRupiah(activeShift?.total_nontunai || 0)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
              <dt>Kas masuk tambahan</dt>
              <dd className="text-emerald-700 dark:text-emerald-400">+{formatRupiah(additionalIncome)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
              <dt>Kas keluar</dt>
              <dd className="text-red-700 dark:text-red-400">−{formatRupiah(totalPengeluaranKas)}</dd>
            </div>
            <div className="pt-2 mt-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3 font-bold text-slate-900 dark:text-white">
              <dt>Seharusnya di laci</dt>
              <dd>{formatRupiah(expectedCashLaci)}</dd>
            </div>
          </dl>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="close-shift-cash" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Uang fisik di laci (Rp)
              </label>
              <button
                type="button"
                onClick={() => setCloseShiftForm(f => ({ ...f, closingBalance: String(expectedCashLaci) }))}
                className="min-h-[36px] px-1 text-xs font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-400"
              >
                Isi sesuai hitungan
              </button>
            </div>
            <Input
              id="close-shift-cash"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={closeShiftForm.closingBalance ? Number(closeShiftForm.closingBalance.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '')
                setCloseShiftForm(f => ({ ...f, closingBalance: raw }))
              }}
              required
              autoFocus
            />
          </div>

          {(() => {
            const actual = Number(closeShiftForm.closingBalance.replace(/\D/g, '')) || 0
            const diff = actual - expectedCashLaci
            return (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-sm font-semibold tabular-nums ${
                  diff === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : diff < 0
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                    : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
                }`}
                aria-live="polite"
              >
                <span>Selisih</span>
                <span>
                  {diff === 0
                    ? 'Pas'
                    : diff < 0
                    ? `Kurang ${formatRupiah(Math.abs(diff))}`
                    : `Lebih ${formatRupiah(diff)}`}
                </span>
              </div>
            )
          })()}

          <div>
            <label htmlFor="close-shift-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan (opsional)
            </label>
            <Input
              id="close-shift-notes"
              type="text"
              placeholder="Contoh: Uang disetor ke brankas"
              value={closeShiftForm.notes}
              onChange={e => setCloseShiftForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuickCashModal(null)
                setCloseShiftForm({ closingBalance: '', notes: '' })
              }}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={quickCashLoading}>
              Tutup shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL SEMUA MENU ── */}
      <Modal
        open={allServicesModal}
        onClose={() => {
          setAllServicesModal(false)
          setAllServicesSearch('')
        }}
        title="Semua menu WariPOS"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              aria-label="Cari menu"
              placeholder="Cari menu, misal: kas, stok, supplier"
              value={allServicesSearch}
              onChange={e => setAllServicesSearch(e.target.value)}
              className="w-full min-h-[44px] pl-10 pr-11 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {allServicesSearch && (
              <button
                type="button"
                onClick={() => setAllServicesSearch('')}
                aria-label="Hapus pencarian"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredServices.length === 0 ? (
              <EmptyBlock
                icon={<Search size={20} />}
                title={`Tidak ada menu "${allServicesSearch}"`}
                text="Coba kata lain, misalnya nama halaman atau fiturnya."
              />
            ) : (
              filteredServices.map(cat => (
                <div key={cat.category}>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-0.5">{cat.category}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {cat.items.map(it => {
                      const IconComp = it.icon
                      return (
                        <button
                          key={it.label}
                          type="button"
                          onClick={() => {
                            setAllServicesModal(false)
                            navigate(it.to)
                          }}
                          className="min-h-[84px] flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 active:scale-95 transition text-center"
                        >
                          <IconComp size={20} />
                          <span className="text-[11px] sm:text-xs font-medium leading-tight line-clamp-2">{it.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type Tone = 'danger' | 'warn' | 'ok'

const TONE_ICON: Record<Tone, string> = {
  danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  ok: 'bg-primary-50 text-primary-700 dark:bg-slate-800 dark:text-primary-300',
}

const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-red-700 dark:text-red-400',
  warn: 'text-amber-700 dark:text-amber-400',
  ok: 'text-slate-600 dark:text-slate-300',
}

function clockTime(value: string | null | undefined) {
  if (!value) return ''
  return /\d{2}:\d{2}/.exec(String(value))?.[0] ?? ''
}

function formatTransactionTime(value: string | null | undefined) {
  if (!value) return '-'
  const time = clockTime(value)
  const datePart = String(value).slice(0, 10)
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (datePart === todayKey && time) return time
  return formatDateTime(value)
}

function backupAgeText(hours: number | null | undefined) {
  if (hours === undefined) return 'Memeriksa'
  if (hours === null) return 'Belum pernah'
  if (hours === 0) return 'Baru saja'
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

// Drawn for the "Uang di laci" block: a wallet holding today's receipt (same torn edge as the card) and coins.
// Every fill reads a theme token, so the wallet follows whichever pastel theme is active.
function WalletArt({ className = '' }: { className?: string }) {
  const t = (shade: number) => `var(--color-primary-${shade})`
  return (
    <svg viewBox="0 0 220 170" className={className} aria-hidden="true" focusable="false">
      <g transform="rotate(-14 85 63)">
        <rect x="30" y="34" width="110" height="58" rx="8" fill={t(100)} stroke={t(300)} strokeWidth="2" />
        <circle cx="85" cy="63" r="13" fill="none" stroke={t(300)} strokeWidth="3" />
      </g>
      <rect x="40" y="70" width="150" height="84" rx="16" fill={t(200)} />
      <path d="M96 22 L102 14 L108 22 L114 14 L120 22 L126 14 L132 22 L138 14 L144 22 L150 14 L156 22 L156 100 L96 100 Z" fill="#fff" stroke={t(200)} strokeWidth="2" strokeLinejoin="round" />
      <rect x="106" y="34" width="40" height="4" rx="2" fill={t(300)} />
      <rect x="106" y="45" width="28" height="4" rx="2" fill={t(300)} />
      <rect x="106" y="56" width="36" height="4" rx="2" fill={t(300)} />
      <rect x="106" y="68" width="40" height="5" rx="2.5" fill={t(500)} />
      <rect x="34" y="84" width="160" height="76" rx="16" fill={t(300)} />
      <rect x="44" y="94" width="140" height="56" rx="10" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2" strokeDasharray="4 5" />
      <rect x="150" y="104" width="56" height="36" rx="12" fill={t(500)} />
      <circle cx="170" cy="122" r="6" fill="#fff" />
      <circle cx="24" cy="152" r="14" fill="#F8D27A" />
      <circle cx="24" cy="152" r="9" fill="none" stroke="#FDF1C7" strokeWidth="2" />
      <circle cx="48" cy="140" r="18" fill="#FBE09B" stroke="#F2C55C" strokeWidth="3" />
      <text x="48" y="145" textAnchor="middle" fontSize="13" fontWeight="800" fill="#8A5A12" fontFamily="inherit">Rp</text>
    </svg>
  )
}

// Today's sales per hour as tiny bars; the current hour is drawn in the deeper tone so "now" is easy to find.
function HourlyBars({ data, loading }: { data: Array<{ hour: string; count: number; total: number }>; loading: boolean }) {
  const nowHour = new Date().getHours()
  const max = data.reduce((m, h) => Math.max(m, h.total), 0)
  const peak = max > 0 ? data.find(h => h.total === max) : undefined
  if (loading) return <div className="h-16 rounded-xl bg-white/60 dark:bg-slate-700/60 animate-pulse" aria-hidden="true" />
  // Older backends do not send hourly data; show nothing rather than an empty chart
  if (data.length === 0) return null
  return (
    <figure className="min-w-0">
      <div
        className="flex items-end gap-[3px] h-14"
        role="img"
        aria-label={peak ? `Penjualan per jam hari ini, paling ramai jam ${peak.hour}` : 'Belum ada penjualan hari ini'}
      >
        {data.map((h, i) => (
          <div
            key={h.hour}
            title={`${h.hour}: ${h.count} transaksi`}
            className={`flex-1 rounded-t-[3px] ${i === nowHour ? 'bg-primary-600 dark:bg-primary-300' : h.total > 0 ? 'bg-primary-300 dark:bg-primary-600' : 'bg-white/70 dark:bg-slate-700'}`}
            style={{ height: max > 0 && h.total > 0 ? `${Math.max(10, (h.total / max) * 100)}%` : '8%' }}
          />
        ))}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
        <span>00</span>
        <span className="truncate px-1">{peak ? `Ramai jam ${peak.hour}` : 'Per jam, hari ini'}</span>
        <span>23</span>
      </figcaption>
    </figure>
  )
}

function Panel({
  title,
  subtitle,
  icon,
  action,
  className = '',
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`rounded-2xl border border-primary-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <IconChip>{icon}</IconChip>}
          <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function IconChip({ children }: { children: ReactNode }) {
  return (
    <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 dark:bg-slate-800 dark:text-primary-300 flex items-center justify-center shrink-0">
      {children}
    </span>
  )
}

function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-my-2.5 -mr-2 min-h-[44px] px-2 inline-flex items-center gap-0.5 text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline underline-offset-2"
    >
      {children}
      <ChevronRight size={14} />
    </button>
  )
}

function EmptyBlock({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="py-6 px-2 flex flex-col items-center text-center">
      <span className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-slate-800 text-primary-600 dark:text-primary-300 flex items-center justify-center">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function InsightSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  )
}
