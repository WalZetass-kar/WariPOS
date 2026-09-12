import { useEffect, useState, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Printer, Bluetooth, FileImage, FileText } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
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

  const handlePrint = useReactToPrint({ content: () => strukRef.current })

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

  return (
    <div className="space-y-4">
      {loadingData ? (
        <SkeletonPage rows={6} />
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">{data.length} transaksi tercatat</p>
          <Card>
            <DataTable data={data} columns={columns} searchPlaceholder="Cari transaksi..." />
          </Card>
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
