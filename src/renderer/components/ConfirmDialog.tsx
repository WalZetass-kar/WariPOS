import { AlertTriangle, Trash2, Info, CheckCircle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  loading?: boolean
  children?: React.ReactNode
}

const variants = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100/80 ring-red-200 dark:bg-red-950/60 dark:ring-red-900/60',
    iconColor: 'text-red-600 dark:text-red-400',
    panel: 'border-red-100 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
    buttonVariant: 'danger' as const
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100/80 ring-amber-200 dark:bg-amber-950/60 dark:ring-amber-900/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    panel: 'border-amber-100 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
    buttonVariant: 'primary' as const
  },
  info: {
    icon: Info,
    iconBg: 'bg-sky-100/80 ring-sky-200 dark:bg-sky-950/60 dark:ring-sky-900/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    panel: 'border-sky-100 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20',
    buttonVariant: 'primary' as const
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-100/80 ring-emerald-200 dark:bg-emerald-950/60 dark:ring-emerald-900/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    panel: 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    buttonVariant: 'primary' as const
  }
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  variant = 'danger',
  loading = false,
  children
}: ConfirmDialogProps) {
  const config = variants[variant]
  const Icon = config.icon

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      size="sm"
      accent={variant}
      footer={
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto" disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={config.buttonVariant} onClick={onConfirm} loading={loading} className="w-full sm:w-auto">
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className={`p-4 rounded-2xl border ${config.panel} flex items-start gap-3.5`}>
          <div className={`shrink-0 w-11 h-11 rounded-xl ${config.iconBg} ring-4 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 flex items-center justify-center shadow-xs`}>
            <Icon size={22} className={config.iconColor} />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {message}
            </p>
          </div>
        </div>
        {children && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300">
            {children}
          </div>
        )}
      </div>
    </Modal>
  )
}
