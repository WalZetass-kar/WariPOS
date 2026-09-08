import React from 'react'
import { QrCode, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { formatRupiah } from '../../utils/format'
import { QrisPayment } from './types'

interface QrisModalProps {
  open: boolean
  totalBayar: number
  qrisPayment: QrisPayment | null
  qrisStatus: string
  qrisChecking: boolean
  qrisCompleting: boolean
  isStaticQrisPayment: boolean
  onCancel: () => void
  onCompleteQrisSale: () => void
  onCheckStatus: () => void
}

export default function QrisModal({
  open, totalBayar, qrisPayment, qrisStatus, qrisChecking, qrisCompleting, isStaticQrisPayment,
  onCancel, onCompleteQrisSale, onCheckStatus
}: QrisModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Pembayaran QRIS"
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="danger"
            onClick={onCancel}
            disabled={qrisCompleting}
            className="w-full sm:w-auto font-bold rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 shadow-sm"
          >
            Batalkan
          </Button>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isStaticQrisPayment ? (
              <Button
                variant="success"
                onClick={onCompleteQrisSale}
                loading={qrisCompleting}
                disabled={!qrisPayment}
                className="w-full sm:w-auto font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm px-6 py-2.5"
              >
                Konfirmasi Pembayaran Selesai
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={onCheckStatus}
                loading={qrisChecking}
                disabled={!qrisPayment || qrisCompleting}
                className="w-full sm:w-auto font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 px-5 py-2.5 shadow-sm"
              >
                Cek Status Sekarang
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Total Tagihan Box (Solid Dark & Crisp, No Gradient) */}
        <div className="rounded-2xl bg-slate-900 dark:bg-slate-950 p-5 text-white border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Tagihan
              </span>
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {formatRupiah(totalBayar)}
              </span>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold shadow-sm">
                <QrCode size={14} />
                <span>QRIS</span>
              </span>
              {qrisPayment?.orderId && (
                <p className="mt-1.5 font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                  {qrisPayment.orderId}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* QR Code Presentation Box (Clean Solid Card Pembatas) */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          {qrisPayment?.qrImageUrl ? (
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
              {/* Header Box */}
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-black tracking-tight text-red-600">QRIS</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Standar Pembayaran Nasional</span>
              </div>

              {/* Target Corners Frame */}
              <div className="relative">
                <div className="absolute -top-2 -left-2 w-5 h-5 border-t-3 border-l-3 border-red-600 rounded-tl" />
                <div className="absolute -top-2 -right-2 w-5 h-5 border-t-3 border-r-3 border-red-600 rounded-tr" />
                <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-3 border-l-3 border-red-600 rounded-bl" />
                <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-3 border-r-3 border-red-600 rounded-br" />

                <img
                  src={qrisPayment.qrImageUrl}
                  alt="Kode QRIS Pembayaran"
                  className="h-60 w-60 sm:h-64 sm:w-64 object-contain rounded-lg"
                />
              </div>

              <p className="mt-3 text-[11px] font-bold font-mono text-slate-600 uppercase tracking-wider">
                NMID: {qrisPayment.orderId?.slice(-12) || 'WARIPOS'}
              </p>
            </div>
          ) : qrisPayment?.qrString ? (
            <textarea
              readOnly
              value={qrisPayment.qrString}
              className="h-32 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 text-xs text-slate-900 dark:text-white font-mono"
            />
          ) : (
            <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-400">
              <QrCode size={48} className="mb-2 text-red-600 animate-pulse" />
              <p className="text-sm font-bold text-slate-800 dark:text-white">Menyiapkan QRIS...</p>
              <p className="text-xs text-slate-500 mt-0.5">Memproses kode pembayaran</p>
            </div>
          )}

          {/* Supported Wallets Grid */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {['BCA', 'Mandiri', 'BRI', 'BNI', 'GoPay', 'OVO', 'Dana', 'ShopeePay', 'LinkAja'].map(w => (
              <span
                key={w}
                className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                {w}
              </span>
            ))}
          </div>
        </div>

        {/* Status Alert Bar (Solid Border & Background) */}
        <div className={`rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2.5 ${
          qrisCompleting
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
            : qrisStatus.includes('gagal') || qrisStatus.includes('dibatalkan')
              ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200 border border-red-300 dark:border-red-800'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
        }`}>
          <span className="w-2.5 h-2.5 rounded-full bg-current shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="truncate">{qrisStatus}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
