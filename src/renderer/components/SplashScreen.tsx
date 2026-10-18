import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import appLogo from '../assets/app-logo.png'
import { useTheme } from '../contexts/ThemeContext'

interface SplashScreenProps {
  onFinish: () => void
}

const SPLASH_DURATION_MS = 1000

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const { isDark } = useTheme()
  const reduceMotion = useReducedMotion()
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onFinishRef.current()
    }, SPLASH_DURATION_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center px-6 select-none ${
            isDark ? 'bg-slate-950' : 'bg-primary-100'
          }`}
          role="status"
          aria-label="Memuat WariPOS"
        >
          {/* Printer slot the receipt comes out of */}
          <div className={`w-60 max-w-[80vw] h-3 rounded-full ${isDark ? 'bg-slate-700' : 'bg-primary-300'}`} aria-hidden="true" />

          {/* The receipt "prints" downward once, then holds still while the app loads */}
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            animate={reduceMotion ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="-mt-1.5 w-52 max-w-[70vw] [filter:drop-shadow(0_12px_20px_rgba(var(--glass-shadow-rgb),0.3))]"
          >
            <div className="receipt-edge bg-white px-5 pt-6 text-center text-slate-900">
              <img
                src={appLogo}
                alt=""
                className="mx-auto h-16 w-16 object-contain"
                draggable={false}
              />
              <h1 className="mt-3 text-2xl font-black tracking-tight leading-none">
                Wari<span className="text-primary-600">POS</span>
              </h1>
              <p className="mt-1.5 text-xs font-medium text-slate-600">Kasir Kita</p>

              <div className="my-4 border-t-2 border-dashed border-primary-200" aria-hidden="true" />

              <p className="text-left text-[11px] font-medium text-slate-600">Menyiapkan kasir</p>
              {/* Progress tracks the real splash timer, not a fake percentage */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: SPLASH_DURATION_MS / 1000, ease: 'linear' }}
                  className="h-full rounded-full bg-primary-400"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
