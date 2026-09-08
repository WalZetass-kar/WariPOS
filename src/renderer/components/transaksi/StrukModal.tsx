import React from 'react'
import { MessageCircle, Bluetooth, Printer } from 'lucide-react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Struk from '../../components/Struk'
import { formatRupiah } from '../../utils/format'
import { CartItem, Customer } from '../../../shared/types'

interface StrukModalProps {
  open: boolean
  cart: CartItem[]
  subTotal: number
  pajakAmount: number
  pajakPersen: number
  totalBayar: number
  promoDiskon: number
  paidAmount: number
  kembalian: number
  lastKd: string | null
  jenisBayar: 'TUNAI' | 'TRANSFER' | 'QRIS'
  selectedCustomer: Customer | null
  poinEarned: number
  user: any
  strukRef: React.RefObject<HTMLDivElement>
  manualWaPhone: string
  btPrinting: boolean
  bluetoothPrinterConnected: boolean
  onClose: () => void
  onSendWhatsApp: () => void
  onHandlePrint: () => void
  onHandleBluetoothPrint: () => void
  onChangeManualWaPhone: (phone: string) => void
}

export default function StrukModal({
  open, cart, subTotal, pajakAmount, pajakPersen, totalBayar, promoDiskon, paidAmount, kembalian, lastKd, jenisBayar, selectedCustomer, poinEarned, user, strukRef, manualWaPhone, btPrinting, bluetoothPrinterConnected,
  onClose, onSendWhatsApp, onHandlePrint, onHandleBluetoothPrint, onChangeManualWaPhone
}: StrukModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transaksi Berhasil Selesai"
      size="md"
      footer={
        <div className="flex flex-wrap gap-2.5 w-full justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              icon={<MessageCircle size={16} className="text-emerald-500" />}
              onClick={onSendWhatsApp}
              className="flex-1 sm:flex-initial font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 rounded-xl"
            >
              Kirim WA
            </Button>
            <Button
              variant="secondary"
              icon={<Bluetooth size={16} className={bluetoothPrinterConnected ? 'text-emerald-500' : 'text-slate-400'} />}
              onClick={onHandleBluetoothPrint}
              disabled={btPrinting}
              className="flex-1 sm:flex-initial font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {btPrinting ? 'Mencetak...' : bluetoothPrinterConnected ? 'Thermal BT' : 'Printer BT'}
            </Button>
            <Button
              variant="secondary"
              icon={<Printer size={16} className="text-primary-500" />}
              onClick={onHandlePrint}
              className="flex-1 sm:flex-initial font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cetak Struk
            </Button>
          </div>
          <Button
            onClick={onClose}
            className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold border-0 shadow-sm px-6 py-2.5 rounded-xl transition"
          >
            Transaksi Baru (Enter)
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Grand Total & Kembalian Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-0.5">
              Total Belanja ({cart.length} item)
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatRupiah(totalBayar)}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              Metode: <strong className="text-slate-800 dark:text-slate-200">{jenisBayar}</strong>
            </p>
          </div>

          <div className="text-right border-l border-emerald-200 dark:border-emerald-800/60 pl-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-0.5">
              Uang Kembalian
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm">
              {formatRupiah(kembalian)}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              Bayar: {formatRupiah(paidAmount)}
            </p>
          </div>
        </div>

        {/* Quick WhatsApp Input Bar */}
        <div className="flex items-center gap-2 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/30">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <MessageCircle size={16} />
          </div>
          <input
            type="tel"
            value={manualWaPhone || selectedCustomer?.no_telp || ''}
            onChange={e => onChangeManualWaPhone(e.target.value)}
            placeholder="Masukkan nomor WhatsApp pembeli (cth: 08123456789)..."
            className="w-full text-xs bg-transparent text-slate-900 dark:text-white outline-none placeholder:text-slate-400 font-bold"
          />
          <button
            type="button"
            onClick={onSendWhatsApp}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shrink-0 shadow transition"
          >
            Kirim
          </button>
        </div>

        {/* Struk Paper Preview Container with realistic paper shadow */}
        <div className="max-h-[50vh] overflow-y-auto flex justify-center bg-slate-200/80 dark:bg-slate-950 p-4 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-inner scrollbar-thin">
          <div ref={strukRef} className="shadow-2xl rounded-2xl overflow-hidden border border-slate-200/80 bg-white">
            <Struk
              cart={cart}
              subTotal={subTotal}
              pajak={pajakAmount}
              pajakPersen={pajakPersen}
              totalBayar={totalBayar}
              promoDiskon={promoDiskon}
              bayar={paidAmount}
              kembalian={kembalian}
              kdTransaksi={lastKd ?? ''}
              jenisBayar={jenisBayar}
              customerName={selectedCustomer?.nama_customer}
              poinEarned={poinEarned}
              kasirName={user?.nama_pengguna}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
