import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

const variants = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm active:scale-[0.98]',
  secondary: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-[0.98]',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98]',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100',
}

const sizes = {
  sm: 'px-3 py-2 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-3 text-base gap-2.5 rounded-lg',
}

export default function Button({
  variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200
        ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}
