import { useState, useRef, useCallback, type TouchEvent, type ReactNode } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  disabled?: boolean
  threshold?: number
}

export default function PullToRefresh({ onRefresh, children, disabled = false, threshold = 80 }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const controls = useAnimation()

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing) return
    const target = e.currentTarget as HTMLElement
    const scrollParent = target.closest('main') || target.parentElement || document.documentElement
    const scrollTop = scrollParent ? scrollParent.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop)
    if (scrollTop > 0) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [disabled, refreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling || disabled || refreshing) return
    const target = e.currentTarget as HTMLElement
    const scrollParent = target.closest('main') || target.parentElement || document.documentElement
    const scrollTop = scrollParent ? scrollParent.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop)
    if (scrollTop > 0) {
      setPulling(false)
      setPullDistance(0)
      return
    }
    const diff = e.touches[0].clientY - startY.current
    if (diff < 0) {
      setPullDistance(0)
      return
    }
    const distance = Math.min(diff * 0.5, threshold * 1.5)
    setPullDistance(distance)
  }, [pulling, disabled, refreshing, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || disabled) return
    setPulling(false)
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true)
      controls.start({ rotate: 360, transition: { duration: 0.8, repeat: Infinity, ease: 'linear' } })
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
        controls.stop()
      }
    } else {
      setPullDistance(0)
    }
  }, [pulling, disabled, refreshing, pullDistance, threshold, onRefresh, controls])

  const showIndicator = pullDistance > 10 || refreshing
  const progress = Math.min(pullDistance / threshold, 1)

  return (
    <div
      className="relative min-h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: refreshing ? 48 : pullDistance }}
        >
          <motion.div
            animate={refreshing ? controls : { rotate: progress * 180 }}
            transition={{ duration: 0 }}
          >
            <RefreshCw
              size={20}
              className={`transition-colors ${progress >= 1 || refreshing ? 'text-red-500' : 'text-slate-400'}`}
            />
          </motion.div>
          {refreshing && (
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">Memperbarui...</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
