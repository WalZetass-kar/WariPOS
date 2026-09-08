import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import appLogo from '../assets/app-logo.png'
import { useTheme } from '../contexts/ThemeContext'

interface SplashScreenProps {
  onFinish: () => void
}

const loadingSteps = [
  'Memuat database...',
  'Menyiapkan modul kasir...',
  'Memverifikasi sistem...',
  'Memulai aplikasi...',
]

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [progress, setProgress] = useState(25)
  const [isVisible, setIsVisible] = useState(true)
  const { mode } = useTheme()
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const isDark = mode === 'dark'

  useEffect(() => {
    const step1 = setTimeout(() => { setCurrentStepIndex(1); setProgress(50) }, 250)
    const step2 = setTimeout(() => { setCurrentStepIndex(2); setProgress(75) }, 550)
    const step3 = setTimeout(() => { setCurrentStepIndex(3); setProgress(100) }, 850)
    const finishTimer = setTimeout(() => {
      setIsVisible(false)
      onFinishRef.current()
    }, 1100)

    return () => {
      clearTimeout(step1)
      clearTimeout(step2)
      clearTimeout(step3)
      clearTimeout(finishTimer)
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
          className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 select-none ${
            isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex flex-col items-center gap-6 max-w-xs w-full">
            {/* Logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-2">
              <img
                src={appLogo}
                alt="WariPOS"
                className="w-full h-full object-contain drop-shadow-md"
              />
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Wari<span className="text-red-600">POS</span>
              </h1>
            </div>

            {/* Clean Progress Bar */}
            <div className="w-full space-y-2 pt-2">
              <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <motion.div
                  className="h-full bg-red-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>{loadingSteps[currentStepIndex]}</span>
                <span className="font-mono">{progress}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
