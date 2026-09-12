import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    const isCartToast = message.toLowerCase().includes('keranjang')
    const duration = isCartToast ? 1800 : 3200

    setToasts(prev => {
      // Jika notifikasi keranjang, batasi agar tidak menumpuk lebih dari 1-2 notifikasi
      const filtered = isCartToast ? prev.filter(t => !t.message.toLowerCase().includes('keranjang')) : prev
      const limited = filtered.slice(-1)
      return [...limited, { id, type, message }]
    })

    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {}
      if (detail.message) {
        toast(detail.message, detail.type || 'success')
      }
    }
    window.addEventListener('toast:show', onToast)
    return () => window.removeEventListener('toast:show', onToast)
  }, [toast])

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = { success: CheckCircle, error: XCircle, info: Info }
  const colors = {
    success: 'bg-emerald-50/95 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-700 dark:text-emerald-300',
    error: 'bg-red-50/95 border-red-200 text-red-800 dark:bg-red-950/90 dark:border-red-700 dark:text-red-300',
    info: 'bg-primary-50/95 border-primary-200 text-primary-800 dark:bg-primary-950/90 dark:border-primary-700 dark:text-primary-300',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed left-1/2 top-3 sm:top-4 z-50 flex w-[min(calc(100vw-2rem),360px)] -translate-x-1/2 flex-col gap-1.5 pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto toast-smooth-animate ${colors[t.type]}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="text-xs sm:text-sm font-semibold truncate flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="p-0.5 opacity-60 hover:opacity-100 shrink-0">
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
