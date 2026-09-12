import { useState, useEffect, useRef, type PointerEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart2, LayoutDashboard, Package, Settings, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { hasMinRole } from '../../shared/config/rbac'

/**
 * Calculates a mathematically exact circular notch path with smooth tangent shoulder fillets.
 * Snugly and uniformly cradles the floating 66px Kasir button with a continuous 5.5px air gap.
 */
function getNotchPath(w: number, h: number = 74) {
  const rTop = 20 // Top corner radius of navbar
  const cx = w / 2

  // Exact Tangent Geometry Parameters for 66px button:
  const R1 = 43
  const R2 = 12
  const xShoulder = 52.31
  const xInflect = 40.90
  const yInflect = 8.29

  const pLeftShoulder = cx - xShoulder
  const pLeftInflect = cx - xInflect
  const pRightInflect = cx + xInflect
  const pRightShoulder = cx + xShoulder

  return [
    `M 0,${rTop}`,
    `A ${rTop},${rTop} 0 0,1 ${rTop},0`,
    `L ${pLeftShoulder.toFixed(2)},0`,
    `A ${R2},${R2} 0 0,1 ${pLeftInflect.toFixed(2)},${yInflect}`,
    `A ${R1},${R1} 0 0,0 ${pRightInflect.toFixed(2)},${yInflect}`,
    `A ${R2},${R2} 0 0,1 ${pRightShoulder.toFixed(2)},0`,
    `L ${(w - rTop).toFixed(2)},0`,
    `A ${rTop},${rTop} 0 0,1 ${w},${rTop}`,
    `L ${w},${h}`,
    `L 0,${h}`,
    `Z`,
  ].join(' ')
}

export default function MobileBottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  const [entered, setEntered] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [navWidth, setNavWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 375))
  const btnRef = useRef<HTMLAnchorElement>(null)
  const rippleId = useRef(0)

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(14) } catch {}
    }
  }

  // Track window resize so notch SVG scales perfectly with zero distortion
  useEffect(() => {
    const handleResize = () => setNavWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mount entrance slide-up animation
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 60)
    return () => clearTimeout(timer)
  }, [])

  const ITEMS = [
    { to: '/', label: t('menu.dashboard'), icon: LayoutDashboard },
    { to: '/transaksi', label: t('menu.transactions'), icon: ShoppingCart, isFloating: true },
    { to: '/produk', label: t('menu.products'), icon: Package },
    { to: '/laporan', label: t('menu.reports'), icon: BarChart2, minRole: 'admin' as const },
    { to: '/settings', label: t('menu.settings'), icon: Settings },
  ]

  const filtered = ITEMS.filter(item => {
    if (item.isFloating) return false
    if (!item.minRole) return true
    if (user?.hak_akses === 'demo') return true
    return hasMinRole(user?.hak_akses, item.minRole)
  })

  const leftItems = filtered.filter(i => i.to === '/' || i.to === '/produk')
  const rightItems = filtered.filter(i => i.to === '/laporan' || i.to === '/settings')
  const isKasirActive = location.pathname.startsWith('/transaksi')

  const handlePointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
    triggerHaptic()
    setPressing(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++rippleId.current
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600)
    setTimeout(() => setPressing(false), 180)
  }

  const pathD = getNotchPath(navWidth, 74)

  return (
    <>
      {/* Spacer to prevent content from hiding behind floating nav on mobile */}
      <div className="h-[84px] lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 select-none lg:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          opacity: entered ? 1 : 0,
          transition: entered
            ? 'none'
            : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
        }}
      >
        {/* Light Mode SVG Background with Soft Ambient Shadow */}
        <svg
          className="pointer-events-none absolute inset-0 h-[74px] w-full dark:hidden"
          viewBox={`0 0 ${navWidth} 74`}
          style={{
            filter: 'drop-shadow(0 -3px 12px rgba(0, 0, 0, 0.05))',
          }}
        >
          <path d={pathD} fill="#FFFFFF" />
          <path d={pathD} fill="none" stroke="rgba(226, 232, 240, 0.9)" strokeWidth="1" />
        </svg>

        {/* Dark Mode SVG Background */}
        <svg
          className="pointer-events-none absolute inset-0 h-[74px] w-full hidden dark:block"
          viewBox={`0 0 ${navWidth} 74`}
          style={{
            filter: 'drop-shadow(0 -3px 16px rgba(0, 0, 0, 0.3))',
          }}
        >
          <path d={pathD} fill="#0F172A" />
          <path d={pathD} fill="none" stroke="rgba(51, 65, 85, 0.65)" strokeWidth="1" />
        </svg>

        {/* Menu Navigation Container */}
        <div className="relative z-10 flex items-center justify-between h-[74px] px-3 sm:px-8">
          {/* Left Menu Items (Dashboard, Produk) */}
          <div className="flex items-center justify-around flex-1 max-w-[148px] h-full pt-1">
            {leftItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={triggerHaptic}
                aria-label={label}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-xl transition-colors duration-200 ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-primary-50/90 dark:bg-primary-950/50 border border-primary-200/70 dark:border-primary-900/50 shadow-xs"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}
                    <motion.div
                      animate={{ scale: isActive ? 1.05 : 1, y: isActive ? -1 : 0 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                      className="relative flex flex-col items-center"
                    >
                      <Icon
                        size={22}
                        strokeWidth={isActive ? 2.1 : 1.85}
                        className="transition-colors duration-200"
                      />
                      <span className="text-[10px] leading-none mt-1 font-semibold tracking-tight truncate max-w-[58px]">
                        {label}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.span
                        layoutId="mobile-nav-active-dot"
                        className="relative w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400 mt-0.5"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Center Gap Space for Floating Button & Notch */}
          <div className="w-[82px] h-full shrink-0" />

          {/* Right Menu Items (Laporan, Pengaturan) */}
          <div className="flex items-center justify-around flex-1 max-w-[148px] h-full pt-1">
            {rightItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={triggerHaptic}
                aria-label={label}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-xl transition-colors duration-200 ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-primary-50/90 dark:bg-primary-950/50 border border-primary-200/70 dark:border-primary-900/50 shadow-xs"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}
                    <motion.div
                      animate={{ scale: isActive ? 1.05 : 1, y: isActive ? -1 : 0 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                      className="relative flex flex-col items-center"
                    >
                      <Icon
                        size={22}
                        strokeWidth={isActive ? 2.1 : 1.85}
                        className="transition-colors duration-200"
                      />
                      <span className="text-[10px] leading-none mt-1 font-semibold tracking-tight truncate max-w-[58px]">
                        {label}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.span
                        layoutId="mobile-nav-active-dot"
                        className="relative w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400 mt-0.5"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Center Floating Action Button (Kasir) - Mengikuti Tema Terpilih */}
        <NavLink
          ref={btnRef}
          to="/transaksi"
          aria-label="Kasir — Buka layar transaksi"
          role="button"
          draggable={false}
          onPointerDown={handlePointerDown}
          className="absolute left-1/2 top-0 z-20 block group"
          style={{
            width: 66,
            height: 66,
            marginTop: -28,
            transform: entered
              ? `translateX(-50%) scale(${pressing ? 0.93 : isKasirActive ? 1.02 : 1})`
              : 'translateX(-50%) scale(0.4)',
            opacity: entered ? 1 : 0,
            transition: entered
              ? 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease'
              : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.08s, opacity 0.3s ease 0.08s',
          }}
        >
          <div
            className={`relative flex flex-col items-center justify-center w-full h-full rounded-full overflow-hidden transition-all duration-200 select-none bg-primary-600 text-white ring-4 ring-white dark:ring-slate-900 shadow-lg shadow-primary-600/30 hover:opacity-95 ${
              isKasirActive ? 'ring-primary-200/80 dark:ring-primary-900/80' : ''
            }`}
          >
            <ShoppingCart
              size={22}
              strokeWidth={2}
              className="text-white transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[11px] font-extrabold tracking-tight text-white leading-none mt-0.5">
              Kasir
            </span>

            {/* Touch Ripple Effect */}
            {ripples.map(r => (
              <span
                key={r.id}
                className="pointer-events-none absolute rounded-full bg-white/30"
                style={{
                  left: r.x - 10,
                  top: r.y - 10,
                  width: 20,
                  height: 20,
                  animation: 'rippleExpand 0.55s cubic-bezier(0, 0, 0.2, 1) forwards',
                }}
              />
            ))}
          </div>
        </NavLink>
      </nav>
    </>
  )
}
