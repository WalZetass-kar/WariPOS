import { forwardRef, useEffect, useState } from 'react'
import { formatRupiah } from '../utils/format'
import { api } from '../utils/api'
import type { CartItem } from '../../shared/types'

interface StrukProps {
  cart: CartItem[]
  subTotal: number
  pajak?: number
  pajakPersen?: number
  totalBayar?: number
  promoDiskon?: number
  bayar: number
  kembalian: number
  kdTransaksi: string
  jenisBayar: string
  customerName?: string
  poinEarned?: number
  kasirName?: string
}

interface StrukSettings {
  printer_type: 'a4' | 'thermal' | 'dot_matrix'
  paper_size: '58mm' | '80mm'
  layout_type: 'classic' | 'modern' | 'minimal'
  show_logo: boolean
  show_alamat: boolean
  show_telepon: boolean
  show_email: boolean
  show_kasir: boolean
  show_customer: boolean
  footer_text: string
  qris_image: string | null
  qris_enabled: boolean
}

interface Identitas {
  namatoko?: string
  alamattoko?: string
  nomortelptoko?: string
  alamatemailowner?: string
  logo?: string
}

function boolFromDb(value: unknown, fallback: boolean) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return Boolean(value)
}

const Struk = forwardRef<HTMLDivElement, StrukProps>(
  ({ cart, subTotal, pajak = 0, pajakPersen = 0, totalBayar, promoDiskon = 0, bayar, kembalian, kdTransaksi, jenisBayar, customerName, poinEarned, kasirName }, ref) => {
    const now = new Date().toLocaleString('id-ID')
    const total = totalBayar ?? subTotal

    const [settings, setSettings] = useState<StrukSettings>({
      printer_type: 'thermal',
      paper_size: '58mm',
      layout_type: 'classic',
      show_logo: true,
      show_alamat: true,
      show_telepon: true,
      show_email: true,
      show_kasir: true,
      show_customer: true,
      footer_text: 'Terima kasih atas kunjungan Anda!',
      qris_image: null,
      qris_enabled: false,
    })

    const [identitas, setIdentitas] = useState<Identitas>({})

    useEffect(() => {
      // Load settings
      api<any>('strukSettings:get').then(r => {
        if (r.success && r.data) {
          setSettings({
            printer_type: r.data.printer_type || 'thermal',
            paper_size: r.data.paper_size || '58mm',
            layout_type: r.data.layout_type || 'classic',
            show_logo: boolFromDb(r.data.show_logo, true),
            show_alamat: boolFromDb(r.data.show_alamat, true),
            show_telepon: boolFromDb(r.data.show_telepon, true),
            show_email: boolFromDb(r.data.show_email, true),
            show_kasir: boolFromDb(r.data.show_kasir, true),
            show_customer: boolFromDb(r.data.show_customer, true),
            footer_text: r.data.footer_text ?? 'Terima kasih atas kunjungan Anda!',
            qris_image: r.data.qris_image || null,
            qris_enabled: boolFromDb(r.data.qris_enabled, false),
          })
        }
      })

      // Load identitas
      api<Identitas>('identitas:get').then(r => {
        if (r.success && r.data) {
          setIdentitas(r.data)
        }
      })
    }, [])

    const printerWidth = settings.printer_type === 'a4' ? 595 : settings.paper_size === '80mm' ? 380 : 280

    return (
      <div 
        ref={ref} 
        className={`font-mono text-[10px] leading-tight text-slate-800 p-2 bg-white print:p-0 print:text-black ${
          settings.layout_type === 'modern' ? 'rounded-lg border border-slate-100 shadow-sm' : ''
        }`} 
        style={{ width: printerWidth }}
      >
        <div className={`text-center mb-3 ${settings.layout_type === 'modern' ? 'bg-slate-50 py-3 rounded-t-lg -mx-2 -mt-2 mb-4' : ''}`}>
          {settings.show_logo && identitas.logo && (
            <img src={identitas.logo} alt="Logo" className="w-12 h-12 mx-auto mb-2 object-contain" />
          )}
          <p className={`font-bold ${settings.layout_type === 'modern' ? 'text-sm' : 'text-xs'}`}>
            {identitas.namatoko || 'WariPOS'}
          </p>
          {settings.show_alamat && identitas.alamattoko && (
            <p className="text-slate-500 text-[9px]">{identitas.alamattoko}</p>
          )}
          {(settings.show_telepon || settings.show_email) && (
            <div className="text-slate-400 text-[9px]">
              {settings.show_telepon && identitas.nomortelptoko && <span>Telp: {identitas.nomortelptoko}</span>}
              {settings.show_email && identitas.alamatemailowner && <span> · {identitas.alamatemailowner}</span>}
            </div>
          )}
          {settings.layout_type !== 'minimal' && (
            <p className="text-slate-400 text-[8px] mt-1">{now}</p>
          )}
        </div>

        {settings.layout_type === 'minimal' ? (
          <div className="flex justify-between text-slate-400 text-[8px] mb-2">
            <span>{kdTransaksi}</span>
            <span>{now}</span>
          </div>
        ) : (
          <div className="border-t border-dashed border-slate-300 my-2" />
        )}

        {settings.layout_type !== 'minimal' && (
          <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-500 mb-2">
            <div>No: {kdTransaksi}</div>
            <div className="text-right">{now}</div>
            {settings.show_kasir && kasirName && <div>Kasir: {kasirName}</div>}
            {settings.show_customer && customerName && <div className="text-right">Cust: {customerName}</div>}
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          {cart.map(item => {
            const disc = (item.harga_jual * item.disc) / 100
            const itemTotal = (item.harga_jual - disc) * item.qty
            return (
              <div key={item.kd_barang} className="border-b border-dotted border-slate-200 dark:border-slate-700 pb-1.5 last:border-0">
                <p className="break-words whitespace-normal font-medium text-[10px] text-slate-900 leading-snug">
                  {item.nama_barang}
                </p>
                <div className="flex justify-between items-baseline text-slate-500 text-[9px] mt-0.5">
                  <span>{item.qty} x {formatRupiah(item.harga_jual)}{item.disc > 0 ? ` (-${item.disc}%)` : ''}</span>
                  <span className="font-bold text-slate-800 ml-2 shrink-0">{formatRupiah(itemTotal)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {settings.layout_type === 'minimal' ? (
          <div className="border-t border-slate-200 my-1" />
        ) : (
          <div className="border-t border-dashed border-slate-300 my-2" />
        )}

        <div className="space-y-0.5">
          <div className="flex justify-between text-slate-500 text-[9px]">
            <span>Subtotal</span>
            <span>{formatRupiah(subTotal)}</span>
          </div>
          {pajakPersen > 0 && (
            <div className="flex justify-between text-slate-500 text-[9px]">
              <span>PPN {pajakPersen}%</span>
              <span>{formatRupiah(pajak)}</span>
            </div>
          )}
          {promoDiskon > 0 && (
            <div className="flex justify-between text-emerald-600 text-[9px]">
              <span>Diskon Promo</span>
              <span>-{formatRupiah(promoDiskon)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold py-1 ${settings.layout_type === 'modern' ? 'text-sm text-primary-600' : 'text-xs'}`}>
            <span>TOTAL</span>
            <span>{formatRupiah(total)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-[9px]">
            <span>Bayar ({jenisBayar})</span>
            <span>{formatRupiah(bayar)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 text-[9px]">
            <span>Kembalian</span>
            <span>{formatRupiah(kembalian)}</span>
          </div>
          {poinEarned && poinEarned > 0 && (
            <div className="flex justify-between text-amber-600 font-medium text-[8px] mt-1 italic">
              <span>* Anda mendapat {poinEarned} poin</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-slate-300 my-3" />
        
        {/* Footer Text */}
        <p className={`text-center text-slate-400 text-[9px] italic ${settings.layout_type === 'modern' ? 'bg-slate-50 py-2 rounded-lg' : ''}`}>
          {settings.footer_text}
        </p>

        {/* QRIS */}
        {settings.qris_enabled && settings.qris_image && (
          <div className="mt-3 text-center border-t border-slate-100 pt-3">
            <p className="text-[8px] text-slate-400 mb-1">Scan QRIS untuk pembayaran digital:</p>
            <img 
              src={settings.qris_image} 
              alt="QRIS" 
              className="w-24 h-24 mx-auto object-contain bg-white p-1 border border-slate-100 rounded"
            />
          </div>
        )}
      </div>
    )
  }
)

Struk.displayName = 'Struk'
export default Struk
