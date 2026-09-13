import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import appLogo from '../assets/app-logo.png'
import { useTheme } from '../contexts/ThemeContext'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const { mode } = useTheme()
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const isDark = mode === 'dark'

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onFinishRef.current()
    }, 1000)

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
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 select-none ${
            isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex flex-col items-center gap-5 max-w-xs w-full text-center">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-2"
            >
              <img
                src={appLogo}
                alt="WariPOS"
                className="w-full h-full object-contain drop-shadow-md"
              />
            </motion.div>

            {/* Branding: WariPOS Kasir Kita */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Wari<span className="text-red-600">POS</span>
              </h1>
              <p className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">
                Kasir Kita
              </p>
            </div>

            {/* Circular Loading Spinner */}
            <div className="pt-2 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full border-3 border-slate-200 dark:border-slate-800 border-t-red-600 dark:border-t-red-500 animate-spin" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
