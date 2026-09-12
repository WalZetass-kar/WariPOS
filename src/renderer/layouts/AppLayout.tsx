import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileBottomNav from './MobileBottomNav'
import OfflineIndicator from '../components/OfflineIndicator'
import QuickSearch from '../components/QuickSearch'
import Onboarding from '../components/Onboarding'
import FirstLaunchTutorialModal from '../components/FirstLaunchTutorialModal'
import UpdateNotification from '../components/UpdateNotification'
import DemoOverlay from '../components/DemoOverlay'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmDialog from '../components/ConfirmDialog'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { preloadCorePages } from '../routes'

function PageLoadingFallback() {
  return (
    <div className="space-y-4 animate-pulse p-1">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-3.5 w-64 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4" />
    </div>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const { isDemo, logout } = useAuth()
  
  useKeyboardShortcuts()
  useSessionTimeout() // Auto logout after 30 minutes idle

  useEffect(() => {
    const handleRequest = () => setShowLogoutConfirm(true)
    window.addEventListener('auth:request-logout', handleRequest)
    return () => window.removeEventListener('auth:request-logout', handleRequest)
  }, [])

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false)
    logout()
    navigate('/login')
  }

  const handlePullRefresh = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('app:refresh'))
    await new Promise(r => setTimeout(r, 500))
  }, [])

  useEffect(() => {
    preloadCorePages()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setQuickSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  const handleMenuClick = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(prev => !prev)
      return
    }

    setSidebarOpen(true)
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isDemo ? 'pt-8' : ''}`}>
      {/* Demo Mode Overlay (banner + watermark + badge) */}
      <DemoOverlay />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={handleMenuClick} />
        <main ref={mainRef} className={`flex-1 overflow-y-auto touch-pan-y ${location.pathname === '/transaksi' ? 'p-2.5 sm:p-4 pb-28 sm:pb-24 lg:p-4 lg:pb-4' : location.pathname === '/assistant' ? 'p-4 sm:p-5' : 'p-4 pb-24 sm:p-5 lg:pb-5'} scrollbar-thin`}>
          <PullToRefresh onRefresh={handlePullRefresh} disabled={location.pathname === '/transaksi'}>
            <Suspense fallback={<PageLoadingFallback />}>
              <Outlet />
            </Suspense>
          </PullToRefresh>
        </main>
      </div>
      <OfflineIndicator />
      {location.pathname !== '/assistant' && <MobileBottomNav />}
      <QuickSearch isOpen={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />
      <Onboarding />
      <FirstLaunchTutorialModal />
      <UpdateNotification />

      <ConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun WariPOS? Sesi Anda pada perangkat ini akan diakhiri."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  )
}
