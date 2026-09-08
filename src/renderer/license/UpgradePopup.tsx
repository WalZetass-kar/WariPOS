import React from 'react'
import { Crown, MessageCircle, X, Zap, ShieldCheck } from 'lucide-react'
import { useLicense } from './FeatureContext'
import { sanitizeHtml } from '../utils/sanitizeHtml'

export const UpgradePopup: React.FC = () => {
  const { popup, closePopup, plan } = useLicense()
  if (!popup) return null

  const whatsappNumber = popup.whatsapp_number?.replace(/[^\d]/g, '')

  const goToPricing = () => {
    closePopup()
    window.location.hash = '#/langganan'
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md modal-backdrop-animate"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closePopup()
        }
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl p-6 sm:p-7 text-white space-y-4 ring-1 ring-white/10 modal-card-animate"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closePopup}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/15 hover:text-white transition"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold tracking-wide mb-1">
            <ShieldCheck size={13} className="text-amber-400" />
            <span>FITUR PRO TERKUNCI</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {popup.title || 'Upgrade Lisensi Toko'}
          </h2>
          {popup.description && (
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto whitespace-pre-line">
              {popup.description}
            </p>
          )}
        </div>

        {/* Current Plan Pill */}
        {plan && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400">Paket Saat Ini:</span>
            <span className="font-extrabold text-amber-300">{plan.name}</span>
          </div>
        )}

        {/* Custom Pricing HTML if present */}
        {popup.pricing_html && (
          <div
            className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3.5 text-xs text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(popup.pricing_html) }}
          />
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={goToPricing}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/10 transition active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Lihat Pilihan Paket & Upgrade</span>
          </button>

          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Halo Admin WariPOS, saya ingin konsultasi upgrade lisensi toko.')}`}
              target="_blank"
              rel="noreferrer"
              onClick={closePopup}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 font-bold text-xs transition"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              <span>Chat WhatsApp Admin (Manual)</span>
            </a>
          )}

          <button
            type="button"
            onClick={closePopup}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1 transition"
          >
            Nanti Saja
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck size={12} className="text-emerald-400" />
          <span>Aktivasi Resmi & Data Toko 100% Aman</span>
        </div>
      </div>
    </div>
  )
}
