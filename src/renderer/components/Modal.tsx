import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  subtitle?: string
  accent?: 'default' | 'danger' | 'warning' | 'info' | 'success' | 'none'
}

const sizes = { 
  sm: 'max-w-sm', 
  md: 'max-w-md', 
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

const accentGradients = {
  default: 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600',
  danger: 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600',
  warning: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500',
  info: 'bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500',
  success: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500',
  none: ''
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  icon,
  subtitle,
  accent = 'default'
}: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm modal-backdrop-animate transition-opacity"
        onClick={onClose}
      />
      {/* Dialog / Responsive Bottom Sheet on mobile with flex-col layout */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${sizes[size]} bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl modal-card-animate flex flex-col max-h-[90dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl overflow-hidden`}
      >
        {/* Top Accent Stripe */}
        {accent !== 'none' && (
          <div className={`h-1 sm:h-1.5 w-full ${accentGradients[accent]} shrink-0`} />
        )}

        {/* Mobile handle indicator */}
        <div className="sm:hidden w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {icon && (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-xs">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white leading-snug truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            aria-label="Tutup modal"
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 text-slate-600 dark:text-slate-300 text-sm overscroll-contain">
          {children}
        </div>

        {/* Sticky/Pinned Modal Action Footer */}
        {footer && (
          <div className="shrink-0 px-5 sm:px-6 py-3 sm:py-3.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5">
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
