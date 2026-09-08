import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = { 
  sm: 'max-w-sm', 
  md: 'max-w-md', 
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
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
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm modal-backdrop-animate transition-opacity"
        onClick={onClose}
      />
      {/* Dialog / Responsive Bottom Sheet on mobile */}
      <div className={`relative w-full ${sizes[size]} glass-card shadow-2xl modal-card-animate p-4 sm:p-5 max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-5`}>
        {/* Mobile handle indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between mb-3 sm:mb-5">
          <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-white leading-tight">{title}</h2>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="text-slate-600 dark:text-slate-300 text-sm">{children}</div>
        {footer && <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">{footer}</div>}
      </div>
    </div>
  )
}
