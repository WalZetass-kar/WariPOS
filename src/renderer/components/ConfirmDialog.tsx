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
    iconBg: 'bg-red-50 ring-red-100 dark:bg-red-950/40 dark:ring-red-900/50',
    iconColor: 'text-red-600 dark:text-red-400',
    panel: 'border-red-100 bg-red-50/80 text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300',
    buttonVariant: 'danger' as const
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    panel: 'border-amber-100 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300',
    buttonVariant: 'primary' as const
  },
  info: {
    icon: Info,
    iconBg: 'bg-pink-50 ring-pink-100 dark:bg-pink-950/40 dark:ring-pink-900/50',
    iconColor: 'text-pink-600 dark:text-pink-400',
    panel: 'border-pink-100 bg-pink-50/80 text-pink-700 dark:border-pink-900/60 dark:bg-pink-950/25 dark:text-pink-300',
    buttonVariant: 'primary' as const
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    panel: 'border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-300',
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
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-2xl ${config.iconBg} ring-8 flex items-center justify-center`}>
            <Icon size={24} className={config.iconColor} />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">{message}</p>
          </div>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs leading-5 ${config.panel}`}>
          Periksa detail sebelum melanjutkan. Aksi ini akan langsung dikirim ke sistem.
        </div>
        {children}
      </div>
    </Modal>
  )
}
