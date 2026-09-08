import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helperText, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          {...props}
          onFocus={e => {
            if (props.type === 'number' || typeof props.value === 'number') {
              e.target.select()
            }
            props.onFocus?.(e)
          }}
          className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800
            px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
            transition-all duration-200
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500' : ''}
            ${className}`}
        />
      </div>
      {helperText && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
      )}
    </div>
  )
)

Input.displayName = 'Input'
export default Input
