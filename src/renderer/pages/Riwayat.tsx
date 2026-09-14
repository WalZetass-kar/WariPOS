import { useEffect, useState, useRef, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Printer, Bluetooth, FileImage, FileText, LayoutGrid, List, Table, Search, Receipt } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Struk from '../components/Struk'
import BluetoothPrinterModal from '../components/BluetoothPrinterModal'
import { SkeletonPage } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDateTime } from '../utils/format'
import { useReactToPrint } from 'react-to-print'
import { bluetoothPrinter } from '../utils/bluetoothPrinter'
import { useToast } from '../contexts/ToastContext'
import { exportReceiptSoftFile } from '../utils/receiptExporter'
import type { Penjualan, PenjualanDetailItem } from '../../shared/types'

export default function Riwayat() {
  const [data, setData] = useState<Penjualan[]>([])
  const [detail, setDetail] = useState<{ header: Penjualan; details: PenjualanDetailItem[] } | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'table'>('list')
  const [search, setSearch] = useState('')
  const strukRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await api<Penjualan[]>('penjualan:getAll')
        if (r.success) setData(r.data ?? [])
      } finally {
        setLoadingData(false)
      }
    })()
  }, [])

  const openDetail = async (kd: string) => {
    try {
      const r = await api<{ header: Penjualan; details: PenjualanDetailItem[] }>('penjualan:getDetail', kd)
      if (r.success && r.data) setDetail(r.data)
    } finally {
    }
  }

  const toast = useToast()
  const [showBtModal, setShowBtModal] = useState(false)
  const [btPrinting, setBtPrinting] = useState(false)
  const [softLoading, setSoftLoading] = useState<'png' | 'pdf' | null>(null)

  const handlePrint = useReactToPrint({
    content: () => strukRef.current,
    pageStyle: `
      @page {
        size: auto;
        margin: 0mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          overflow: visible !important;
        }
      }
    `,
  })

  const handleExportSoftFile = async (format: 'png' | 'pdf') => {
    if (!strukRef.current || !detail) return toast('Preview struk belum siap', 'error')
    setSoftLoading(format)
    const res = await exportReceiptSoftFile(strukRef.current, detail.header.kd_tansaksi_jual, format)
    setSoftLoading(null)
    if (res.success) {
      toast(`Struk soft file (${format.toUpperCase()}) berhasil disimpan: ${res.fileName}`)
    } else {
      toast(res.error || 'Gagal menyimpan soft file struk', 'error')
    }
  }

  const handleBluetoothPrint = async () => {
    if (!detail) return
    if (!bluetoothPrinter.isConnected()) {
      setShowBtModal(true)
      return
    }

    setBtPrinting(true)
    try {
      const identitasRes = await api<any>('identitas:get')
      const strukSettingsRes = await api<any>('strukSettings:get')
      const paperSize = (localStorage.getItem('zetass_bt_paper_size') as '58mm' | '80mm') || strukSettingsRes?.data?.paper_size || '58mm'

      const result = await bluetoothPrinter.printStruk({
        namaToko: identitasRes?.data?.namatoko || 'WariPOS',
        alamat: identitasRes?.data?.alamattoko,
        telepon: identitasRes?.data?.nomortelptoko,
        kdTransaksi: detail.header.kd_tansaksi_jual,
        waktu: formatDateTime(detail.header.tgl_wkt_transaksi),
        kasir: detail.header.username_transaksi || 'Kasir',
        items: detail.details.map(d => ({
          nama: String(d.nama_barang || d.kd_barang || 'Produk'),
          qty: d.qty ?? 1,
          harga: d.harga_jual ?? 0,
          subtotal: d.total_harga_jual ?? 0,
        })),
        totalItem: detail.details.reduce((s, i) => s + (i.qty ?? 1), 0),
        subtotal: detail.header.sub_total ?? 0,
        diskon: Number((detail.header as any).diskon_promo ?? (detail.header as any).diskon ?? 0),
        pajak: Number((detail.header as any).pajak ?? 0),
        totalBayar: detail.header.sub_total ?? 0,
        nominalBayar: detail.header.yang_dibayar ?? detail.header.sub_total ?? 0,
        kembalian: detail.header.kembalian ?? 0,
        metodeBayar: detail.header.jenis_pembayaran ?? 'TUNAI',
        pesanFooter: strukSettingsRes?.data?.footer_text || 'Terima kasih atas kunjungan Anda!',
        tipeKertas: paperSize,
        openCashDrawer: true,
      })

      if (result.success) {
        toast(result.message, 'success')
      } else {
        toast(result.message, 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Gagal mencetak ke printer Bluetooth.', 'error')
    } finally {
      setBtPrinting(false)
    }
  }

  // Convert detail items to CartItem format for Struk
  const cartItems = detail?.details.map(d => ({
    kd_barang: d.kd_barang ?? '',
    nama_barang: d.nama_barang ?? '',
    harga_jual: d.harga_jual ?? 0,
    harga_modal: 0,
    qty: d.qty ?? 0,
    disc: d.disc ?? 0,
  })) ?? []

  const columns: ColumnDef<Penjualan>[] = [
    { accessorKey: 'kd_tansaksi_jual', header: 'No. Transaksi' },
    {
      accessorKey: 'tgl_wkt_transaksi', header: 'Tanggal',
      cell: ({ getValue }) => formatDateTime(getValue() as string),
    },
    { accessorKey: 'username_transaksi', header: 'Kasir' },
    { accessorKey: 'total_qty', header: 'Qty', size: 60 },
    {
      accessorKey: 'sub_total', header: 'Total',
      cell: ({ getValue }) => <span className="font-semibold text-primary-600 dark:text-primary-400">{formatRupiah(getValue() as number)}</span>,
    },
    {
      accessorKey: 'jenis_pembayaran', header: 'Pembayaran',
      cell: ({ getValue }) => <Badge label={String(getValue())} variant={getValue() === 'TUNAI' ? 'green' : 'blue'} />,
    },
    {
      id: 'actions', header: 'Detail',
      cell: ({ row }) => (
        <button onClick={() => openDetail(row.original.kd_tansaksi_jual)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 text-primary-500 transition-colors">
          <Eye size={14} />
        </button>
      ),
    },
  ]

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const query = search.toLowerCase()
    return data.filter(item =>
      String(item.kd_tansaksi_jual || '').toLowerCase().includes(query) ||
      String(item.username_transaksi || '').toLowerCase().includes(query) ||
      String(item.jenis_pembayaran || '').toLowerCase().includes(query)
    )
  }, [data, search])

  return (
    <div className="space-y-4">
      {loadingData ? (
        <SkeletonPage rows={6} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Riwayat Transaksi</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{data.length} transaksi tercatat di sistem</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 sm:w-64">
                <Input
                  placeholder="Cari nota, kasir, atau metode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>

              {/* View Switcher: List, Grid, Table */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan List"
                >
                  <List size={16} />
                  <span className="hidden md:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan Grid"
                >
                  <LayoutGrid size={16} />
                  <span className="hidden md:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan Tabel"
                >
                  <Table size={16} />
                  <span className="hidden md:inline">Tabel</span>
                </button>
              </div>
            </div>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {filteredData.length === 0 ? (
                <div className="py-14 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Receipt size={36} className="mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada transaksi ditemukan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Coba sesuaikan kata kunci pencarian Anda</p>
                </div>
              ) : (
                filteredData.map(item => (
                  <div
                    key={item.kd_tansaksi_jual}
                    onClick={() => openDetail(item.kd_tansaksi_jual)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-200/50 dark:border-primary-800/40">
                        <Receipt size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {item.kd_tansaksi_jual}
                          </p>
                          <Badge
                            label={item.jenis_pembayaran || 'TUNAI'}
                            variant={item.jenis_pembayaran === 'TUNAI' ? 'green' : item.jenis_pembayaran === 'QRIS' ? 'blue' : 'yellow'}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                          <span>{formatDateTime(item.tgl_wkt_transaksi)}</span>
                          <span>·</span>
                          <span>Kasir: <strong className="text-slate-700 dark:text-slate-300">{item.username_transaksi || 'Kasir'}</strong></span>
                          <span>·</span>
                          <span>{item.total_qty || 1} Item</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right flex items-center gap-3">
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Total</p>
                        <p className="font-extrabold text-sm sm:text-base text-primary-600 dark:text-primary-400">
                          {formatRupiah(item.sub_total)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          openDetail(item.kd_tansaksi_jual)
                        }}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Lihat Detail Transaksi"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredData.length === 0 ? (
                <div className="col-span-full py-14 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Receipt size={36} className="mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada transaksi ditemukan</p>
                </div>
              ) : (
                filteredData.map(item => (
                  <div
                    key={item.kd_tansaksi_jual}
                    onClick={() => openDetail(item.kd_tansaksi_jual)}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {item.kd_tansaksi_jual}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(item.tgl_wkt_transaksi)}</p>
                      </div>
                      <Badge
                        label={item.jenis_pembayaran || 'TUNAI'}
                        variant={item.jenis_pembayaran === 'TUNAI' ? 'green' : item.jenis_pembayaran === 'QRIS' ? 'blue' : 'yellow'}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Kasir</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{item.username_transaksi || 'Kasir'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px]">Total ({item.total_qty || 1} Item)</span>
                        <span className="font-extrabold text-base text-primary-600 dark:text-primary-400">{formatRupiah(item.sub_total)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <Card>
              <DataTable data={filteredData} columns={columns} searchPlaceholder="Cari transaksi..." />
            </Card>
          )}
        </>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={`Detail: ${detail?.header.kd_tansaksi_jual}`}
        size="lg"
        footer={
          <div className="flex flex-wrap gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => setDetail(null)} className="w-full sm:w-auto">Tutup</Button>
            <Button
              variant="secondary"
              icon={<Bluetooth size={14} className={bluetoothPrinter.isConnected() ? 'text-emerald-500' : 'text-slate-400'} />}
              onClick={handleBluetoothPrint}
              disabled={btPrinting}
              className="w-full sm:w-auto font-bold border-slate-300 dark:border-slate-700"
            >
              {btPrinting ? 'Mencetak...' : bluetoothPrinter.isConnected() ? 'Cetak Thermal BT' : 'Printer BT'}
            </Button>
            <Button
              variant="secondary"
              icon={<FileImage size={14} className="text-blue-500" />}
              onClick={() => handleExportSoftFile('png')}
              loading={softLoading === 'png'}
              disabled={!!softLoading}
              className="w-full sm:w-auto font-bold border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              Soft PNG
            </Button>
            <Button
              variant="secondary"
              icon={<FileText size={14} className="text-amber-500" />}
              onClick={() => handleExportSoftFile('pdf')}
              loading={softLoading === 'pdf'}
              disabled={!!softLoading}
              className="w-full sm:w-auto font-bold border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              Soft PDF
            </Button>
            <Button icon={<Printer size={14} />} onClick={handlePrint} className="w-full sm:w-auto">Cetak Ulang Struk</Button>
          </div>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400">Tanggal:</span> <span className="font-medium">{formatDateTime(detail.header.tgl_wkt_transaksi)}</span></div>
              <div><span className="text-slate-400">Kasir:</span> <span className="font-medium">{detail.header.username_transaksi}</span></div>
              <div><span className="text-slate-400">Pembayaran:</span> <Badge label={detail.header.jenis_pembayaran ?? '-'} variant="blue" /></div>
              <div><span className="text-slate-400">Kembalian:</span> <span className="font-medium">{formatRupiah(detail.header.kembalian)}</span></div>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm border-t border-slate-100 dark:border-slate-700 pt-3">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase">
                    <th className="text-left py-2 px-2 sm:px-0">Produk</th>
                    <th className="text-right py-2 px-2 sm:px-0">Harga</th>
                    <th className="text-right py-2 px-2 sm:px-0">Qty</th>
                    <th className="text-right py-2 px-2 sm:px-0">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {detail.details.map((d, i) => (
                    <tr key={d.kd_trans_jual_detail} className={i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}>
                      <td className="py-2 px-2 sm:px-0">{d.nama_barang ?? d.kd_barang}</td>
                      <td className="py-2 text-right px-2 sm:px-0">{formatRupiah(d.harga_jual)}</td>
                      <td className="py-2 text-right px-2 sm:px-0">{d.qty}</td>
                      <td className="py-2 text-right font-semibold px-2 sm:px-0">{formatRupiah(d.total_harga_jual)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-primary-600 dark:text-primary-400">
                    <td colSpan={3} className="pt-3 text-right px-2 sm:px-0">Total</td>
                    <td className="pt-3 text-right px-2 sm:px-0">{formatRupiah(detail.header.sub_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Offscreen print & soft file target */}
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">
              <div ref={strukRef}>
                <Struk
                  cart={cartItems}
                  subTotal={detail.header.sub_total ?? 0}
                  bayar={detail.header.yang_dibayar ?? 0}
                  kembalian={detail.header.kembalian ?? 0}
                  kdTransaksi={detail.header.kd_tansaksi_jual}
                  jenisBayar={detail.header.jenis_pembayaran ?? 'TUNAI'}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <BluetoothPrinterModal open={showBtModal} onClose={() => setShowBtModal(false)} />
    </div>
  )
}
