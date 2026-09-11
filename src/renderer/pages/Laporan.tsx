import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Search,
  BarChart2,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Percent,
  RotateCcw,
  Boxes,
  Award,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieChartIcon,
  ChevronRight,
  Sparkles,
  Medal,
  Crown,
  X,
  RefreshCw,
  Clock,
  User,
  ShoppingBag,
  Table2,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useDemoGuard } from '../hooks/useDemoGuard'
import type { Penjualan } from '../../shared/types'
import { ensureStoragePermission } from '../utils/nativePermissions'
import { reportToSheetsPayload, reportToTsv } from '../../shared/googleSheetsExport'

interface LabaRugi {
  total_transaksi: number
  total_penjualan: number
  total_modal: number
  laba_kotor: number
  margin_persen: number
}

interface ProdukTerlaris {
  kd_barang: string
  nama_barang: string
  total_qty: number
  total_penjualan: number
}

interface StokItem {
  kd_barang: string
  nama_barang: string | null
  stok: number | null
  stok_minimum: number | null
}

interface CustomerLaporan {
  kd_customer: string
  nama_customer: string
  poin: number | null
  total_belanja: number | null
  status: string | null
}

type TabType = 'penjualan' | 'laba-rugi' | 'produk' | 'stok' | 'customer'

const today = new Date().toISOString().split('T')[0]
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

function shortDate(value: string) {
  if (!value) return '-'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function formatDateTime(val?: string | null) {
  if (!val) return '-'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return val
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function compactNumber(value: number) {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}M`
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`
  if (value >= 1000) return `${Math.round(value / 1000)}rb`
  return String(value)
}

function moneyTooltip(value: unknown, name: unknown) {
  return [formatRupiah(Number(value ?? 0)), String(name)]
}

function numberTooltip(value: unknown, name: unknown) {
  return [Number(value ?? 0).toLocaleString('id-ID'), String(name)]
}

function chartAxisStyle() {
  return { fontSize: 11, fill: '#94a3b8' }
}

export default function Laporan() {
  const toast = useToast()
  const { guardPremiumFeature } = useDemoGuard()
  const [tab, setTab] = useState<TabType>('penjualan')
  const [dateRange, setDateRange] = useState({ start: firstDay, end: today })
  const [filterPreset, setFilterPreset] = useState<'thisMonth' | 'today' | 'yesterday' | 'last7days' | 'lastMonth' | 'thisYear' | 'custom'>('thisMonth')
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState<string | null>(null)

  // In-tab search & filter states
  const [penjualanSearch, setPenjualanSearch] = useState('')
  const [produkSearch, setProdukSearch] = useState('')
  const [stokSearch, setStokSearch] = useState('')
  const [stokFilter, setStokFilter] = useState<'ALL' | 'MENIPIS' | 'AMAN'>('ALL')
  const [customerSearch, setCustomerSearch] = useState('')

  // Data states
  const [penjualanData, setPenjualanData] = useState<{ transaksi: Penjualan[]; summary: any } | null>(null)
  const [labaRugiData, setLabaRugiData] = useState<LabaRugi | null>(null)
  const [produkData, setProdukData] = useState<ProdukTerlaris[]>([])
  const [stokData, setStokData] = useState<{ all: StokItem[]; stok_menipis: StokItem[] } | null>(null)
  const [customerData, setCustomerData] = useState<{ customers: CustomerLaporan[]; summary: any } | null>(null)

  const handlePresetChange = (preset: string) => {
    setFilterPreset(preset as any)
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    if (preset === 'today') {
      setDateRange({ start: todayStr, end: todayStr })
    } else if (preset === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().split('T')[0]
      setDateRange({ start: yStr, end: yStr })
    } else if (preset === 'last7days') {
      const d7 = new Date()
      d7.setDate(d7.getDate() - 6)
      setDateRange({ start: d7.toISOString().split('T')[0], end: todayStr })
    } else if (preset === 'thisMonth') {
      setDateRange({ start: firstDay, end: todayStr })
    } else if (preset === 'lastMonth') {
      const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const prevLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      setDateRange({ start: prevFirst, end: prevLast })
    } else if (preset === 'thisYear') {
      const yrFirst = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      setDateRange({ start: yrFirst, end: todayStr })
    }
  }

  const load = async () => {
    if ((tab !== 'stok' && tab !== 'customer') && (!dateRange.start || !dateRange.end)) {
      return toast('Pilih rentang tanggal terlebih dahulu', 'error')
    }
    setLoading(true)
    try {
      if (tab === 'penjualan') {
        const r = await api<any>('laporan:penjualan', dateRange.start, dateRange.end)
        if (r.success) setPenjualanData(r.data)
        else toast(r.message as string, 'error')
      } else if (tab === 'laba-rugi') {
        const r = await api<LabaRugi>('laporan:labaRugi', dateRange.start, dateRange.end)
        if (r.success) setLabaRugiData(r.data ?? null)
        else toast(r.message as string, 'error')
      } else if (tab === 'produk') {
        const r = await api<ProdukTerlaris[]>('laporan:produkTerlaris', dateRange.start, dateRange.end, 20)
        if (r.success) setProdukData(r.data ?? [])
        else toast(r.message as string, 'error')
      } else if (tab === 'stok') {
        const r = await api<any>('laporan:stok')
        if (r.success) setStokData(r.data)
        else toast(r.message as string, 'error')
      } else if (tab === 'customer') {
        const r = await api<any>('laporan:customer')
        if (r.success) setCustomerData(r.data)
        else toast(r.message as string, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tab, dateRange.start, dateRange.end])

  const handleExport = async (format: 'excel' | 'pdf') => {
    const featureKey = format === 'excel' ? 'export_excel' : 'export_pdf'
    if (guardPremiumFeature(featureKey, `Export ${format.toUpperCase()}`)) return

    const permission = await ensureStoragePermission()
    if (!permission.granted) {
      toast(permission.message ?? 'Izin penyimpanan ditolak', 'error')
      return
    }

    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    const defaultFilename = `laporan_${tab}_${new Date().toISOString().split('T')[0]}.${ext}`

    const dialogResult = await api<any>('dialog:showSaveDialog', {
      title: `Simpan Laporan ${format.toUpperCase()}`,
      defaultPath: defaultFilename,
      filters: [
        { name: format === 'excel' ? 'Excel Files' : 'PDF Files', extensions: [ext] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!dialogResult.success || !dialogResult.data || dialogResult.data.canceled) {
      return
    }

    const savePath = dialogResult.data.filePath
    const key = `${tab}-${format}`
    setExportLoading(key)
    let r: any
    try {
      if (tab === 'penjualan') {
        if (!dateRange.start || !dateRange.end) { toast('Pilih rentang tanggal', 'error'); return }
        r = format === 'excel'
          ? await api('export:penjualanExcel', dateRange.start, dateRange.end, savePath)
          : await api('export:penjualanPDF', dateRange.start, dateRange.end, savePath)
      } else if (tab === 'stok') {
        r = format === 'excel'
          ? await api('export:stokExcel', savePath)
          : await api('export:stokPDF', savePath)
      } else if (tab === 'laba-rugi' || tab === 'produk' || tab === 'customer') {
        if (tab === 'laba-rugi' && labaRugiData) {
          const rows = [
            ['Total Transaksi', labaRugiData.total_transaksi],
            ['Total Penjualan', labaRugiData.total_penjualan],
            ['Total Modal HPP', labaRugiData.total_modal],
            ['Laba Kotor', labaRugiData.laba_kotor],
            ['Margin (%)', labaRugiData.margin_persen],
          ]
          r = format === 'excel'
            ? await api('export:toExcel', rows.map(([k, v]) => ({ Keterangan: k, Nilai: v })), 'laporan_laba_rugi', undefined, savePath)
            : await api('export:toPDF', 'Laporan Laba Rugi', ['Keterangan', 'Nilai'], rows, 'laporan_laba_rugi', undefined, savePath)
        } else if (tab === 'produk' && produkData.length > 0) {
          r = format === 'excel'
            ? await api('export:toExcel', produkData, 'laporan_produk_terlaris', undefined, savePath)
            : await api('export:toPDF', 'Produk Terlaris', ['Produk', 'Total Qty', 'Total Penjualan'], produkData.map(p => [p.nama_barang, p.total_qty, p.total_penjualan]), 'laporan_produk_terlaris', undefined, savePath)
        } else if (tab === 'customer' && customerData) {
          r = format === 'excel'
            ? await api('export:toExcel', customerData.customers, 'laporan_customer', undefined, savePath)
            : await api('export:toPDF', 'Laporan Customer', ['Nama', 'Poin', 'Total Belanja', 'Status'], customerData.customers.map((c: any) => [c.nama_customer, c.poin ?? 0, c.total_belanja ?? 0, c.status ?? '']), 'laporan_customer', undefined, savePath)
        } else {
          toast('Tampilkan data terlebih dahulu', 'error'); setExportLoading(null); return
        }
      }
      if (r?.success) {
        toast(r?.message || (r?.data?.message) || `File berhasil disimpan ke ${savePath}`, 'success')
      } else {
        const errorMsg = r?.message ?? 'Export gagal'
        if (errorMsg.includes('permission') || errorMsg.includes('izin')) {
          toast('Izin penyimpanan ditolak. Periksa pengaturan folder.', 'error')
        } else if (errorMsg.includes('disk') || errorMsg.includes('space')) {
          toast('Penyimpanan penuh. Hapus file lain terlebih dahulu.', 'error')
        } else {
          toast(errorMsg, 'error')
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      toast(`Export gagal: ${errMsg}`, 'error')
    } finally {
      setExportLoading(null)
    }
  }

  const copyTextWithTextarea = (text: string) => {
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

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return } catch { /**/ }
    }
    if (copyTextWithTextarea(text)) return
    throw new Error('Clipboard tidak tersedia')
  }

  const handleExportGoogleSheets = async () => {
    if (guardPremiumFeature('export_excel', 'Export Laporan Google Sheets')) return

    let title = 'Laporan'
    let headers: string[] = []
    let rows: Array<Array<string | number>> = []
    let summaryCards: Array<{ label: string; value: string | number }> = []

    if (tab === 'penjualan') {
      if (!penjualanData || (penjualanData.transaksi ?? []).length === 0) {
        toast('Tidak ada data penjualan untuk diexport', 'error')
        return
      }
      title = 'Penjualan'
      headers = ['No. Transaksi', 'Tanggal', 'Kasir', 'Pelanggan', 'Qty', 'Subtotal', 'Diskon', 'Pajak', 'Total Bayar', 'Metode Pembayaran']
      rows = (penjualanData.transaksi ?? []).map(t => [
        t.kd_tansaksi_jual || '-',
        t.tgl_wkt_transaksi ? t.tgl_wkt_transaksi.replace('T', ' ').slice(0, 19) : '-',
        t.username_transaksi || '-',
        (t as any).nama_customer || 'Pelanggan Umum',
        t.total_qty ?? 0,
        t.sub_total ?? 0,
        (t as any).discount_amount ?? 0,
        (t as any).pajak ?? 0,
        t.yang_dibayar ?? 0,
        t.jenis_pembayaran || 'TUNAI',
      ])
      if (penjualanData.summary) {
        summaryCards = [
          { label: 'Total Transaksi', value: penjualanData.summary.total_transaksi ?? rows.length },
          { label: 'Total Item Terjual', value: penjualanData.summary.total_qty ?? 0 },
          { label: 'Total Omzet Penjualan (Rp)', value: penjualanData.summary.total_penjualan ?? 0 },
          { label: 'Total Pajak (Rp)', value: penjualanData.summary.total_pajak ?? 0 },
          { label: 'Total Return (Rp)', value: penjualanData.summary.total_return ?? 0 },
          { label: 'Total Penjualan Bersih (Rp)', value: penjualanData.summary.total_bersih ?? 0 },
        ]
      }
    } else if (tab === 'laba-rugi') {
      if (!labaRugiData) {
        toast('Tidak ada data laba rugi untuk diexport', 'error')
        return
      }
      title = 'Laba Rugi'
      headers = ['Keterangan', 'Nilai (Rp)']
      rows = [
        ['Total Transaksi', labaRugiData.total_transaksi],
        ['Total Penjualan', labaRugiData.total_penjualan],
        ['Total Modal HPP', labaRugiData.total_modal],
        ['Laba Kotor', labaRugiData.laba_kotor],
        ['Margin Penjualan (%)', `${labaRugiData.margin_persen}%`],
      ]
      summaryCards = [
        { label: 'Total Penjualan (Rp)', value: labaRugiData.total_penjualan },
        { label: 'Total Modal HPP (Rp)', value: labaRugiData.total_modal },
        { label: 'Laba Kotor (Rp)', value: labaRugiData.laba_kotor },
        { label: 'Margin (%)', value: `${labaRugiData.margin_persen}%` },
      ]
    } else if (tab === 'produk') {
      if (produkData.length === 0) {
        toast('Tidak ada data produk terlaris untuk diexport', 'error')
        return
      }
      title = 'Produk Terlaris'
      headers = ['Kode Barang', 'Nama Produk', 'Total Qty Terjual', 'Total Omzet Penjualan (Rp)']
      rows = produkData.map(p => [
        p.kd_barang,
        p.nama_barang || '-',
        p.total_qty ?? 0,
        p.total_penjualan ?? 0,
      ])
    } else if (tab === 'stok') {
      const items = stokData?.all ?? []
      if (items.length === 0) {
        toast('Tidak ada data stok barang untuk diexport', 'error')
        return
      }
      title = 'Stok Barang'
      headers = ['Kode Barang', 'Nama Barang', 'Stok Saat Ini', 'Stok Minimum', 'Status Stok']
      rows = items.map(s => {
        const isLow = (s.stok ?? 0) <= (s.stok_minimum ?? 0)
        return [
          s.kd_barang,
          s.nama_barang || '-',
          s.stok ?? 0,
          s.stok_minimum ?? 0,
          isLow ? 'Stok Menipis' : 'Stok Aman',
        ]
      })
      summaryCards = [
        { label: 'Total Jenis Barang', value: items.length },
        { label: 'Barang Stok Menipis', value: (stokData?.stok_menipis ?? []).length },
      ]
    } else if (tab === 'customer') {
      const customers = customerData?.customers ?? []
      if (customers.length === 0) {
        toast('Tidak ada data pelanggan untuk diexport', 'error')
        return
      }
      title = 'Pelanggan'
      headers = ['Kode Customer', 'Nama Pelanggan', 'Poin', 'Total Belanja (Rp)', 'Status']
      rows = customers.map(c => [
        c.kd_customer || '-',
        c.nama_customer || '-',
        c.poin ?? 0,
        c.total_belanja ?? 0,
        c.status ?? 'Aktif',
      ])
    }

    const payloadInput = {
      title,
      tab,
      dateRange: (tab !== 'stok' && tab !== 'customer') ? dateRange : undefined,
      headers,
      rows,
      summaryCards,
    }

    const payload = reportToSheetsPayload(payloadInput)
    const key = `${tab}-sheets`
    setExportLoading(key)

    try {
      const res = await api<{ mode?: 'apps-script' | 'clipboard' }>('integrations:exportReportToSheets', payload)
      if (res.success && res.data?.mode === 'apps-script') {
        toast('Laporan berhasil dikirim ke Google Sheets', 'success')
        return
      }

      // Fallback: Copy TSV and open Google Sheets
      const tsv = reportToTsv(payloadInput)
      const copiedBeforeOpen = copyTextWithTextarea(tsv)
      const sheetsUrl = 'https://docs.google.com/spreadsheets/u/0/create'
      const sheetsWindow = window.api?.invoke ? null : window.open(sheetsUrl, '_blank', 'noopener,noreferrer')
      if (!copiedBeforeOpen) await copyTextToClipboard(tsv)
      if (window.api?.invoke) {
        await window.api.invoke('app:openExternal', sheetsUrl)
      } else if (!sheetsWindow) {
        window.location.href = sheetsUrl
      }
      toast('Data laporan disalin. Google Sheets dibuka — tempel (Ctrl+V) di sel A1.', 'success')
    } catch (err) {
      toast(`Export Google Sheets gagal: ${err instanceof Error ? err.message : 'Error'}`, 'error')
    } finally {
      setExportLoading(null)
    }
  }

  const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'penjualan', label: 'Penjualan', icon: <TrendingUp size={15} /> },
    { key: 'laba-rugi', label: 'Laba Rugi', icon: <DollarSign size={15} /> },
    { key: 'produk', label: 'Produk Terlaris', icon: <BarChart2 size={15} /> },
    { key: 'stok', label: 'Stok Barang', icon: <Package size={15} /> },
    { key: 'customer', label: 'Pelanggan', icon: <Users size={15} /> },
  ]

  const needsDate = tab !== 'stok' && tab !== 'customer'

  // Chart data calculations
  const penjualanChartData = useMemo(() => {
    return (penjualanData?.transaksi ?? []).reduce((rows, item) => {
      const key = (item.tgl_wkt_transaksi ?? '').slice(0, 10) || '-'
      const existing = rows.find(row => row.key === key)
      if (existing) {
        existing.total += Number(item.yang_dibayar ?? 0)
        existing.transaksi += 1
      } else {
        rows.push({ key, tanggal: shortDate(key), total: Number(item.yang_dibayar ?? 0), transaksi: 1 })
      }
      return rows
    }, [] as Array<{ key: string; tanggal: string; total: number; transaksi: number }>).sort((a, b) => a.key.localeCompare(b.key))
  }, [penjualanData])

  const labaRugiChartData = useMemo(() => {
    if (!labaRugiData) return []
    return [
      { label: 'Penjualan', value: labaRugiData.total_penjualan, color: '#3b82f6' },
      { label: 'Modal HPP', value: labaRugiData.total_modal, color: '#f59e0b' },
      { label: 'Laba Kotor', value: labaRugiData.laba_kotor, color: labaRugiData.laba_kotor >= 0 ? '#10b981' : '#ef4444' },
    ]
  }, [labaRugiData])

  const produkChartData = useMemo(() => {
    return produkData.slice(0, 10).map(p => ({
      label: p.nama_barang || p.kd_barang,
      qty: p.total_qty,
      penjualan: p.total_penjualan,
    }))
  }, [produkData])

  const stokChartData = useMemo(() => {
    if (!stokData) return []
    const aman = Math.max(0, (stokData.all.length ?? 0) - stokData.stok_menipis.length)
    const menipis = stokData.stok_menipis.length
    return [
      { label: 'Stok Aman', value: aman, color: '#10b981' },
      { label: 'Stok Menipis', value: menipis, color: '#ef4444' },
    ]
  }, [stokData])

  // In-tab filtered data
  const filteredPenjualanList = useMemo(() => {
    const list = penjualanData?.transaksi ?? []
    if (!penjualanSearch.trim()) return list
    const q = penjualanSearch.toLowerCase()
    return list.filter(t =>
      (t.kd_tansaksi_jual || '').toLowerCase().includes(q) ||
      (t.username_transaksi || '').toLowerCase().includes(q) ||
      (t.jenis_pembayaran || '').toLowerCase().includes(q)
    )
  }, [penjualanData, penjualanSearch])

  const filteredProdukList = useMemo(() => {
    if (!produkSearch.trim()) return produkData
    const q = produkSearch.toLowerCase()
    return produkData.filter(p =>
      (p.nama_barang || '').toLowerCase().includes(q) ||
      (p.kd_barang || '').toLowerCase().includes(q)
    )
  }, [produkData, produkSearch])

  const filteredStokList = useMemo(() => {
    const all = stokData?.all ?? []
    return all.filter(s => {
      const low = (s.stok ?? 0) <= (s.stok_minimum ?? 0)
      const matchFilter =
        stokFilter === 'ALL' ? true :
        stokFilter === 'MENIPIS' ? low : !low
      const q = stokSearch.toLowerCase()
      const matchSearch =
        !q ||
        (s.nama_barang || '').toLowerCase().includes(q) ||
        (s.kd_barang || '').toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
  }, [stokData, stokFilter, stokSearch])

  const filteredCustomerList = useMemo(() => {
    const list = customerData?.customers ?? []
    if (!customerSearch.trim()) return list
    const q = customerSearch.toLowerCase()
    return list.filter(c => (c.nama_customer || '').toLowerCase().includes(q))
  }, [customerData, customerSearch])

  return (
    <div className="space-y-3.5 sm:space-y-4 touch-pan-y">
      
      {/* ── Mobile Top Header (Android App Style) ── */}
      <div className="flex sm:hidden items-center justify-between gap-2.5 pt-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 to-rose-500 text-white shadow-md shadow-primary-600/20 flex items-center justify-center shrink-0">
            <BarChart2 size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              Laporan Keuangan
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              {needsDate ? `${shortDate(dateRange.start)} - ${shortDate(dateRange.end)}` : 'Data Realtime Toko'}
            </p>
          </div>
        </div>

        {/* Mobile Quick Export Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleExportGoogleSheets}
            disabled={!!exportLoading}
            className="p-2 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition-colors shadow-sm active:scale-95"
            title="Google Sheets"
          >
            <Table2 size={17} />
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={!!exportLoading}
            className="p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shadow-sm active:scale-95"
            title="Export Excel"
          >
            <FileSpreadsheet size={17} />
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={!!exportLoading}
            className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors shadow-sm active:scale-95"
            title="Export PDF"
          >
            <FileText size={17} />
          </button>
        </div>
      </div>

      {/* ── Desktop Top Header ── */}
      <div className="hidden sm:flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-primary-600 to-rose-500 text-white shadow-md shadow-primary-600/20">
              <BarChart2 size={24} />
            </div>
            <span>Laporan & Analitik Keuangan</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau arus pendapatan, rincian laba kotor, produk terlaris, ketersediaan stok, dan ekspor data ke Google Sheets, Excel, atau PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Table2 size={16} />}
            onClick={handleExportGoogleSheets}
            loading={exportLoading === `${tab}-sheets`}
            className="h-10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/60 hover:bg-teal-50 dark:hover:bg-teal-950/30 font-bold text-xs"
          >
            Google Sheets
          </Button>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet size={16} />}
            onClick={() => handleExport('excel')}
            loading={exportLoading === `${tab}-excel`}
            className="h-10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold text-xs"
          >
            Export Excel
          </Button>
          <Button
            variant="secondary"
            icon={<FileText size={16} />}
            onClick={() => handleExport('pdf')}
            loading={exportLoading === `${tab}-pdf`}
            className="h-10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* ── Segmented Tabs Navigation ── */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto scrollbar-none touch-pan-x shadow-inner">
        {TABS.map(t => {
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-primary-600 to-rose-600 text-white shadow-md shadow-primary-600/25 ring-1 ring-white/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}>
                {t.icon}
              </span>
              <span>{t.label}</span>

              {/* Status Indicator Badges on Tabs */}
              {t.key === 'stok' && (stokData?.stok_menipis.length ?? 0) > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white text-rose-600 shadow' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {stokData?.stok_menipis.length}
                </span>
              )}
              {t.key === 'penjualan' && (penjualanData?.summary.total_transaksi ?? 0) > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {penjualanData?.summary.total_transaksi}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Modern Filter & Period Card ── */}
      {needsDate && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Calendar size={14} className="text-primary-600" />
                <span>Pilih Rentang Waktu</span>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] sm:text-xs font-bold border border-slate-200/80 dark:border-slate-700">
                {shortDate(dateRange.start)} — {shortDate(dateRange.end)}
              </div>
            </div>

            {/* Quick Period Presets (Horizontal Touch Scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'last7days', label: '7 Hari' },
                { id: 'thisMonth', label: 'Bulan Ini' },
                { id: 'lastMonth', label: 'Bulan Lalu' },
                { id: 'thisYear', label: 'Tahun Ini' },
                { id: 'custom', label: 'Kustom' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                    filterPreset === p.id
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/25 ring-1 ring-primary-500/30'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {filterPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mulai</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary-500 shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sampai</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary-500 shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Refresh and Export Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-rose-600 hover:from-primary-700 hover:to-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'Memperbarui...' : 'Perbarui Laporan'}</span>
              </button>

              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<Table2 size={16} />}
                  onClick={handleExportGoogleSheets}
                  loading={exportLoading === `${tab}-sheets`}
                  className="h-10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/60 font-bold text-xs"
                >
                  Google Sheets
                </Button>
                <Button
                  variant="secondary"
                  icon={<FileSpreadsheet size={16} />}
                  onClick={() => handleExport('excel')}
                  loading={exportLoading === `${tab}-excel`}
                  className="h-10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 font-bold text-xs"
                >
                  Export Excel
                </Button>
                <Button
                  variant="secondary"
                  icon={<FileText size={16} />}
                  onClick={() => handleExport('pdf')}
                  loading={exportLoading === `${tab}-pdf`}
                  className="h-10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 font-bold text-xs"
                >
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 1: PENJUALAN ======================= */}
      {tab === 'penjualan' && penjualanData && (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* Hero Card: Total Omzet Penjualan */}
          <HeroKpiCard
            title="Total Omzet Penjualan"
            subtitle={`${penjualanData.summary.total_transaksi} Transaksi Berhasil`}
            value={penjualanData.summary.total_penjualan}
            badgeText="Omzet Toko"
            icon={<DollarSign size={22} />}
            gradient="emerald"
            breakdown={[
              { label: 'Bersih', value: formatRupiah(penjualanData.summary.total_bersih ?? penjualanData.summary.total_penjualan), tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Return', value: formatRupiah(penjualanData.summary.total_return ?? 0), tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'PPN', value: formatRupiah(penjualanData.summary.total_pajak), tone: 'text-violet-600 dark:text-violet-400' },
            ]}
          />

          {/* Sub KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            <ReportKpiCard
              label="Transaksi"
              value={penjualanData.summary.total_transaksi}
              icon={<Receipt size={16} className="text-primary-600" />}
              iconBg="bg-primary-50 dark:bg-primary-950/40"
              suffix=" Trx"
            />
            <ReportKpiCard
              label="Qty Terjual"
              value={penjualanData.summary.total_qty}
              icon={<Boxes size={16} className="text-blue-600" />}
              iconBg="bg-blue-50 dark:bg-blue-950/40"
              suffix=" Pcs"
            />
            <ReportKpiCard
              label="Penjualan Bersih"
              value={penjualanData.summary.total_bersih ?? penjualanData.summary.total_penjualan}
              icon={<TrendingUp size={16} className="text-emerald-600" />}
              iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              currency={true}
              tone="green"
            />
            <ReportKpiCard
              label="Total Return"
              value={penjualanData.summary.total_return ?? 0}
              icon={<RotateCcw size={16} className="text-amber-600" />}
              iconBg="bg-amber-50 dark:bg-amber-950/40"
              currency={true}
              tone="amber"
            />
            <ReportKpiCard
              label="Total PPN"
              value={penjualanData.summary.total_pajak}
              icon={<Percent size={16} className="text-violet-600" />}
              iconBg="bg-violet-50 dark:bg-violet-950/40"
              currency={true}
              tone="purple"
            />
          </div>

          {/* Area Chart Penjualan */}
          <Card
            title="Tren Penjualan Harian"
            subtitle="Grafik omzet per tanggal transaksi sesuai periode terpilih"
            className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
          >
            {penjualanChartData.length > 0 ? (
              <div className="w-full h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={penjualanChartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="laporanPenjualanGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                    <XAxis dataKey="tanggal" tick={chartAxisStyle()} axisLine={false} tickLine={false} />
                    <YAxis tick={chartAxisStyle()} axisLine={false} tickLine={false} tickFormatter={v => compactNumber(Number(v))} />
                    <Tooltip
                      formatter={moneyTooltip}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Omzet"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="url(#laporanPenjualanGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs font-bold text-slate-400">
                Belum ada transaksi pada periode ini
              </div>
            )}
          </Card>

          {/* Rincian Transaksi */}
          <Card
            title={`Rincian Transaksi (${filteredPenjualanList.length})`}
            className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            action={
              <div className="w-full sm:w-64">
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari no. struk / kasir..."
                    value={penjualanSearch}
                    onChange={e => setPenjualanSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-8 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-primary-500"
                  />
                  {penjualanSearch && (
                    <button
                      type="button"
                      onClick={() => setPenjualanSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {/* Mobile Card List (Bank-Grade Receipt View) */}
            <div className="sm:hidden space-y-2.5">
              {filteredPenjualanList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-medium text-xs">
                  {penjualanSearch ? 'Tidak ada transaksi yang cocok dengan pencarian.' : 'Belum ada transaksi tercatat.'}
                </div>
              ) : (
                filteredPenjualanList.slice(0, 50).map(t => (
                  <div
                    key={t.kd_tansaksi_jual}
                    className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm space-y-2.5 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <Receipt size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate">
                            {t.kd_tansaksi_jual}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatDateTime(t.tgl_wkt_transaksi)}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        t.jenis_pembayaran === 'TUNAI' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900' :
                        t.jenis_pembayaran === 'QRIS' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-900' :
                        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900'
                      }`}>
                        {t.jenis_pembayaran ?? 'TUNAI'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <span>Kasir: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{t.username_transaksi}</strong></span>
                        <span>•</span>
                        <span>{t.total_qty} item</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {formatRupiah(t.yang_dibayar)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs min-w-[650px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">No. Transaksi</th>
                    <th className="px-4 py-3 text-left">Tanggal & Waktu</th>
                    <th className="px-4 py-3 text-left">Kasir</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Total Tagihan</th>
                    <th className="px-4 py-3 text-center pr-4">Metode Bayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPenjualanList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        {penjualanSearch ? 'Tidak ada transaksi yang cocok dengan pencarian.' : 'Belum ada transaksi tercatat.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPenjualanList.slice(0, 50).map(t => (
                      <tr key={t.kd_tansaksi_jual} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          {t.kd_tansaksi_jual}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium">
                          {formatDateTime(t.tgl_wkt_transaksi)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {t.username_transaksi}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                          {t.total_qty}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white font-mono">
                          {formatRupiah(t.yang_dibayar)}
                        </td>
                        <td className="px-4 py-3 text-center pr-4">
                          <Badge
                            label={t.jenis_pembayaran ?? '-'}
                            variant={
                              t.jenis_pembayaran === 'TUNAI' ? 'green' :
                              t.jenis_pembayaran === 'QRIS' ? 'purple' : 'blue'
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 2: LABA RUGI ======================= */}
      {tab === 'laba-rugi' && labaRugiData && (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* Hero Card: Laba Kotor */}
          <HeroKpiCard
            title="Laba Kotor Usaha"
            subtitle={`${labaRugiData.total_transaksi} Total Transaksi Operasional`}
            value={labaRugiData.laba_kotor}
            badgeText={`Margin ${labaRugiData.margin_persen}%`}
            icon={<TrendingUp size={22} />}
            gradient={labaRugiData.laba_kotor >= 0 ? 'emerald' : 'rose'}
            breakdown={[
              { label: 'Penjualan', value: formatRupiah(labaRugiData.total_penjualan), tone: 'text-blue-600 dark:text-blue-400' },
              { label: 'Modal HPP', value: `- ${formatRupiah(labaRugiData.total_modal)}`, tone: 'text-amber-600 dark:text-amber-400' },
            ]}
          />

          {/* Sub KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <ReportKpiCard
              label="Total Transaksi"
              value={labaRugiData.total_transaksi}
              icon={<Receipt size={16} className="text-primary-600" />}
              iconBg="bg-primary-50 dark:bg-primary-950/40"
              suffix=" Trx"
            />
            <ReportKpiCard
              label="Penjualan (Omzet)"
              value={labaRugiData.total_penjualan}
              icon={<DollarSign size={16} className="text-blue-600" />}
              iconBg="bg-blue-50 dark:bg-blue-950/40"
              currency={true}
              tone="blue"
            />
            <ReportKpiCard
              label="Total Modal (HPP)"
              value={labaRugiData.total_modal}
              icon={<Boxes size={16} className="text-amber-600" />}
              iconBg="bg-amber-50 dark:bg-amber-950/40"
              currency={true}
              tone="amber"
            />
            <ReportKpiCard
              label="Margin Laba"
              value={labaRugiData.margin_persen}
              icon={<Percent size={16} className="text-violet-600" />}
              iconBg="bg-violet-50 dark:bg-violet-950/40"
              suffix="%"
              tone="purple"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Bar Chart Laba Rugi */}
            <Card
              title="Perbandingan Laba Rugi"
              subtitle="Komparasi nominal Penjualan, Modal Pokok, dan Laba Kotor"
              className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            >
              <div className="w-full h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={labaRugiChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                    <XAxis dataKey="label" tick={chartAxisStyle()} axisLine={false} tickLine={false} />
                    <YAxis tick={chartAxisStyle()} axisLine={false} tickLine={false} tickFormatter={v => compactNumber(Number(v))} />
                    <Tooltip
                      formatter={moneyTooltip}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    />
                    <Bar dataKey="value" name="Nominal" radius={[8, 8, 0, 0]}>
                      {labaRugiChartData.map(item => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Income Statement Summary Card */}
            <Card
              title="Ringkasan Finansial"
              subtitle="Kalkulasi laba kotor periode aktif"
              className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            >
              <div className="space-y-3 mt-1">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Total Penjualan Kotor</span>
                  <span className="font-black text-slate-900 dark:text-white font-mono">{formatRupiah(labaRugiData.total_penjualan)}</span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Beban Pokok Penjualan (HPP)</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 font-mono">- {formatRupiah(labaRugiData.total_modal)}</span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Laba Kotor Operasional</span>
                  <span className={`font-black text-sm font-mono ${labaRugiData.laba_kotor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {formatRupiah(labaRugiData.laba_kotor)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Margin Usaha:</span>
                  <span className="text-base font-black text-violet-600 dark:text-violet-400 font-mono">
                    {labaRugiData.margin_persen}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: PRODUK TERLARIS ======================= */}
      {tab === 'produk' && produkData.length > 0 && (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* Desktop Horizontal Bar Chart */}
          <div className="hidden sm:block">
            <Card
              title="Grafik Produk Terlaris"
              subtitle="Top 10 produk dengan volume penjualan tertinggi dalam periode terpilih"
              className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            >
              <ResponsiveContainer width="100%" height={Math.max(280, produkChartData.length * 36)}>
                <BarChart data={produkChartData} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                  <XAxis type="number" tick={chartAxisStyle()} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={chartAxisStyle()} axisLine={false} tickLine={false} width={130} />
                  <Tooltip
                    formatter={numberTooltip}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="qty" name="Qty Terjual" radius={[0, 8, 8, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Ranking & Leaderboard Section */}
          <Card
            title={`Peringkat Produk Terlaris (${filteredProdukList.length})`}
            className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            action={
              <div className="w-full sm:w-64">
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama / kode produk..."
                    value={produkSearch}
                    onChange={e => setProdukSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-8 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-primary-500"
                  />
                  {produkSearch && (
                    <button
                      type="button"
                      onClick={() => setProdukSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {/* Mobile Visual Leaderboard (Native Android Style) */}
            <div className="sm:hidden space-y-2.5">
              {filteredProdukList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-medium text-xs">
                  Tidak ada produk yang cocok dengan pencarian.
                </div>
              ) : (
                filteredProdukList.slice(0, 20).map((p, i) => {
                  const maxQty = Math.max(...filteredProdukList.map(x => x.total_qty), 1)
                  const percentage = Math.round((p.total_qty / maxQty) * 100)
                  return (
                    <div
                      key={p.kd_barang}
                      className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Rank Badge */}
                          <div className="shrink-0">
                            {i === 0 ? (
                              <span className="w-7 h-7 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-400/30">
                                1
                              </span>
                            ) : i === 1 ? (
                              <span className="w-7 h-7 rounded-xl bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center">
                                2
                              </span>
                            ) : i === 2 ? (
                              <span className="w-7 h-7 rounded-xl bg-amber-700/30 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                                3
                              </span>
                            ) : (
                              <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs flex items-center justify-center">
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {p.nama_barang}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              {p.kd_barang}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white font-mono whitespace-nowrap">
                            {formatRupiah(p.total_penjualan)}
                          </p>
                          <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                            {p.total_qty.toLocaleString('id-ID')} unit terjual
                          </p>
                        </div>
                      </div>

                      {/* Popularity meter bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            i === 0 ? 'bg-amber-400' :
                            i === 1 ? 'bg-slate-400' :
                            i === 2 ? 'bg-amber-600' :
                            'bg-primary-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-center w-14">Rank</th>
                    <th className="px-4 py-3 text-left">Kode & Nama Produk</th>
                    <th className="px-4 py-3 text-right">Total Terjual</th>
                    <th className="px-4 py-3 text-right pr-4">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProdukList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                        Tidak ada produk yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredProdukList.map((p, i) => (
                      <tr key={p.kd_barang} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-center">
                          {i === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-black text-xs">1</span>
                          ) : i === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs">2</span>
                          ) : i === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 font-bold text-xs">3</span>
                          ) : (
                            <span className="text-slate-400 font-bold">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-500 dark:text-slate-400 mr-2">{p.kd_barang}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{p.nama_barang}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-200 font-mono">
                          {p.total_qty.toLocaleString('id-ID')} unit
                        </td>
                        <td className="px-4 py-3 text-right pr-4 font-black text-slate-900 dark:text-white font-mono">
                          {formatRupiah(p.total_penjualan)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 4: STOK ======================= */}
      {tab === 'stok' && stokData && (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* Stock Health Banner */}
          {stokData.stok_menipis.length === 0 ? (
            <div className="p-4 rounded-2xl sm:rounded-3xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-emerald-900 dark:text-emerald-200">Kondisi Stok Prima</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Seluruh {stokData.all.length} produk berada di atas batas minimum.</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 font-bold text-xs">
                Aman 100%
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl sm:rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/30 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-rose-900 dark:text-rose-200">{stokData.stok_menipis.length} Produk Menipis</h3>
                  <p className="text-xs text-rose-700 dark:text-rose-400">Stok berada di bawah batas minimum dan perlu segera di-restock.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStokFilter('MENIPIS')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-transform shrink-0"
              >
                Filter Menipis
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Donut Chart Status Stok */}
            <Card
              title="Ketersediaan Stok"
              subtitle="Perbandingan produk aman vs di bawah minimum"
              className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            >
              <div className="w-full h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={numberTooltip}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Pie
                      data={stokChartData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {stokChartData.map(item => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2.5 sm:gap-6 text-xs font-bold text-slate-600 dark:text-slate-300">
                {stokChartData.map(item => (
                  <div key={item.label} className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}: <strong>{item.value.toLocaleString('id-ID')} Produk</strong></span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top 8 Produk Paling Menipis */}
            <Card
              title="Produk Paling Menipis"
              subtitle="Prioritas barang yang harus di-order ulang"
              className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            >
              {stokData.stok_menipis.length > 0 ? (
                <div className="space-y-2 mt-1 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                  {stokData.stok_menipis.slice(0, 8).map(s => (
                    <div
                      key={s.kd_barang}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{s.nama_barang || s.kd_barang}</p>
                          <p className="text-[11px] font-mono text-slate-500 truncate">{s.kd_barang} • Min: {s.stok_minimum} unit</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-black text-xs whitespace-nowrap shrink-0">
                        Sisa: {s.stok ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-14 text-center text-xs font-bold text-emerald-600 flex flex-col items-center gap-2">
                  <CheckCircle2 size={28} />
                  <span>Semua stok barang dalam kondisi aman terkendali</span>
                </div>
              )}
            </Card>
          </div>

          {/* Master Table Keseluruhan Stok */}
          <Card
            title={`Daftar Keseluruhan Stok (${filteredStokList.length})`}
            className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            action={
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  {(['ALL', 'MENIPIS', 'AMAN'] as const).map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStokFilter(filter)}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-center active:scale-95 ${
                        stokFilter === filter
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {filter === 'ALL' ? 'Semua' : filter === 'MENIPIS' ? 'Menipis' : 'Aman'}
                    </button>
                  ))}
                </div>
                <div className="w-full sm:w-56">
                  <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari produk..."
                      value={stokSearch}
                      onChange={e => setStokSearch(e.target.value)}
                      className="w-full h-9 pl-8 pr-8 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-primary-500"
                    />
                    {stokSearch && (
                      <button
                        type="button"
                        onClick={() => setStokSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            }
          >
            {/* Mobile Card List (Stok) */}
            <div className="sm:hidden space-y-2.5">
              {filteredStokList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-medium text-xs">
                  Tidak ada produk yang cocok dengan pencarian.
                </div>
              ) : (
                filteredStokList.map(s => {
                  const low = (s.stok ?? 0) <= (s.stok_minimum ?? 0)
                  return (
                    <div
                      key={s.kd_barang}
                      className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {s.nama_barang || s.kd_barang}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {s.kd_barang}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          low
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900'
                        }`}>
                          {low ? 'Menipis' : 'Aman'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[11px] text-slate-500">
                          Batas Min: <strong className="text-slate-700 dark:text-slate-300">{s.stok_minimum ?? 0} unit</strong>
                        </span>
                        <span className={`font-black font-mono ${low ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          Stok: {s.stok ?? 0} unit
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode Produk</th>
                    <th className="px-4 py-3 text-left">Nama Produk</th>
                    <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                    <th className="px-4 py-3 text-right">Batas Minimum</th>
                    <th className="px-4 py-3 text-center pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStokList.map(s => {
                    const low = (s.stok ?? 0) <= (s.stok_minimum ?? 0)
                    return (
                      <tr key={s.kd_barang} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">{s.kd_barang}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{s.nama_barang}</td>
                        <td className={`px-4 py-3 text-right font-black font-mono ${low ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {s.stok} unit
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 font-medium font-mono">{s.stok_minimum} unit</td>
                        <td className="px-4 py-3 text-center pr-4">
                          <Badge label={low ? 'Menipis' : 'Aman'} variant={low ? 'red' : 'green'} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 5: PELANGGAN ======================= */}
      {tab === 'customer' && customerData && (
        <div className="space-y-3.5 sm:space-y-4">
          
          {/* Hero Card: Omzet Member Loyalty */}
          <HeroKpiCard
            title="Total Belanja Pelanggan"
            subtitle={`${customerData.summary.customer_aktif} dari ${customerData.summary.total_customer} Pelanggan Aktif`}
            value={customerData.summary.total_belanja ?? 0}
            badgeText="Member Omzet"
            icon={<Award size={22} />}
            gradient="blue"
            breakdown={[
              { label: 'Total Member', value: `${customerData.summary.total_customer} Orang`, tone: 'text-slate-900 dark:text-white' },
              { label: 'Poin Beredar', value: `${(customerData.summary.total_poin ?? 0).toLocaleString('id-ID')} Poin`, tone: 'text-amber-600 dark:text-amber-400' },
            ]}
          />

          {/* Sub KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <ReportKpiCard
              label="Total Pelanggan"
              value={customerData.summary.total_customer}
              icon={<Users size={16} className="text-primary-600" />}
              iconBg="bg-primary-50 dark:bg-primary-950/40"
              suffix=" Orang"
            />
            <ReportKpiCard
              label="Pelanggan Aktif"
              value={customerData.summary.customer_aktif}
              icon={<CheckCircle2 size={16} className="text-emerald-600" />}
              iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              suffix=" Orang"
              tone="green"
            />
            <ReportKpiCard
              label="Total Poin Loyalty"
              value={customerData.summary.total_poin ?? 0}
              icon={<Award size={16} className="text-amber-600" />}
              iconBg="bg-amber-50 dark:bg-amber-950/40"
              suffix=" Poin"
              tone="amber"
            />
          </div>

          {/* Table Pelanggan */}
          <Card
            title={`Daftar Pelanggan Toko (${filteredCustomerList.length})`}
            className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm"
            action={
              <div className="w-full sm:w-64">
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama pelanggan..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-8 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-primary-500"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {/* Mobile Card List (Customer) */}
            <div className="sm:hidden space-y-2.5">
              {filteredCustomerList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-medium text-xs">
                  Tidak ada data pelanggan yang sesuai.
                </div>
              ) : (
                filteredCustomerList.map(c => {
                  const initial = (c.nama_customer || 'C').charAt(0).toUpperCase()
                  return (
                    <div
                      key={c.kd_customer}
                      className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-rose-500 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {c.nama_customer}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              {c.kd_customer}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {c.status ?? 'Aktif'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <Award size={13} />
                          <span>{(c.poin ?? 0).toLocaleString('id-ID')} Poin</span>
                        </div>
                        <span className="font-black text-xs text-slate-900 dark:text-white font-mono">
                          {formatRupiah(c.total_belanja ?? 0)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode Customer</th>
                    <th className="px-4 py-3 text-left">Nama Pelanggan</th>
                    <th className="px-4 py-3 text-right">Poin Loyalty</th>
                    <th className="px-4 py-3 text-right">Total Akumulasi Belanja</th>
                    <th className="px-4 py-3 text-center pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomerList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                        Tidak ada data pelanggan yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerList.map(c => (
                      <tr key={c.kd_customer} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">{c.kd_customer}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.nama_customer}</td>
                        <td className="px-4 py-3 text-right font-black text-amber-600 font-mono">
                          {(c.poin ?? 0).toLocaleString('id-ID')} Poin
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white font-mono">
                          {formatRupiah(c.total_belanja ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-center pr-4">
                          <Badge
                            label={c.status ?? 'Aktif'}
                            variant={c.status === 'Aktif' ? 'green' : 'red'}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && <SkeletonSpinner label="Memuat data laporan analitik..." />}

      {/* Empty States */}
      {!loading && tab === 'penjualan' && !penjualanData && (
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 text-center py-12">
          <div className="text-xs font-bold text-slate-400">
            Pilih rentang tanggal dan klik Perbarui Laporan untuk melihat data penjualan.
          </div>
        </Card>
      )}
      {!loading && tab === 'laba-rugi' && !labaRugiData && (
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 text-center py-12">
          <div className="text-xs font-bold text-slate-400">
            Pilih rentang tanggal dan klik Perbarui Laporan untuk melihat data laba rugi.
          </div>
        </Card>
      )}
      {!loading && tab === 'produk' && produkData.length === 0 && (
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 text-center py-12">
          <div className="text-xs font-bold text-slate-400">
            Belum ada produk terjual pada rentang tanggal yang dipilih.
          </div>
        </Card>
      )}
    </div>
  )
}

function HeroKpiCard({
  title,
  subtitle,
  value,
  badgeText,
  icon,
  gradient = 'emerald',
  breakdown,
}: {
  title: string
  subtitle?: string
  value: number
  badgeText?: string
  icon: React.ReactNode
  gradient?: 'emerald' | 'rose' | 'blue' | 'primary'
  breakdown?: Array<{ label: string; value: string; tone?: string }>
}) {
  const gradientStyles = {
    emerald: 'from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    rose: 'from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/30 text-rose-600 dark:text-rose-400',
    blue: 'from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/30 text-blue-600 dark:text-blue-400',
    primary: 'from-primary-500/15 via-primary-500/5 to-transparent border-primary-500/30 text-primary-600 dark:text-primary-400',
  }[gradient]

  const iconBg = {
    emerald: 'bg-emerald-600 text-white shadow-emerald-600/30',
    rose: 'bg-rose-600 text-white shadow-rose-600/30',
    blue: 'bg-blue-600 text-white shadow-blue-600/30',
    primary: 'bg-primary-600 text-white shadow-primary-600/30',
  }[gradient]

  return (
    <div className={`rounded-2xl sm:rounded-3xl border bg-gradient-to-br ${gradientStyles} p-4 sm:p-5 shadow-sm relative overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl sm:rounded-2xl shadow-md ${iconBg} shrink-0`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badgeText && (
          <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-current bg-white/60 dark:bg-slate-900/60 shrink-0">
            {badgeText}
          </span>
        )}
      </div>

      <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1.5">
        {formatRupiah(value)}
      </p>

      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-2.5 mt-2 border-t border-slate-200/60 dark:border-slate-800/80">
          {breakdown.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <span>{b.label}:</span>
              <strong className={`font-bold ${b.tone || 'text-slate-800 dark:text-slate-200'}`}>{b.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportKpiCard({
  label,
  value,
  icon,
  iconBg = 'bg-slate-100 dark:bg-slate-800',
  currency = false,
  suffix = '',
  tone = 'slate',
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  iconBg?: string
  currency?: boolean
  suffix?: string
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'purple'
}) {
  const valueColor = {
    slate: 'text-slate-900 dark:text-white',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-rose-600 dark:text-rose-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-violet-600 dark:text-violet-400',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm p-3 sm:p-4 transition-all">
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        <div className={`p-1.5 rounded-lg ${iconBg} shrink-0`}>
          {icon}
        </div>
        <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </p>
      </div>
      <p className={`text-sm sm:text-base font-black truncate font-mono ${valueColor}`}>
        {currency ? formatRupiah(Number(value ?? 0)) : `${(Number(value) || 0).toLocaleString('id-ID')}${suffix}`}
      </p>
    </div>
  )
}
