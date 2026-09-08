import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: ReactNode
  hover?: boolean
}

export default function Card({ children, className = '', title, subtitle, action, hover = false }: CardProps) {
  return (
    <div className={`glass-card p-4 sm:p-5 overflow-hidden ${hover ? 'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200' : ''} ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3 mb-4">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 flex items-center">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
