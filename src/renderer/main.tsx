import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, useNavigate } from 'react-router-dom'
import './i18n' // initialize i18next
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { DemoProvider } from './contexts/DemoContext'
import ErrorBoundary from './components/ErrorBoundary'
import RemoteLicensePopup from './components/RemoteLicensePopup'
import SplashScreen from './components/SplashScreen'
import { validateProductionConfig } from './utils/productionConfig'
import { registerDeepLinkHandlers } from './utils/deepLinks'
import { registerMobileBackButton } from './utils/mobileBackButton'
import { useLocation } from 'react-router-dom'
import AppRoutes from './routes'
import './styles/globals.css'
import { initSentry } from './utils/sentry'

function ProductionConfigGate({ children }: { children: React.ReactNode }) {
  const validation = validateProductionConfig()
  if (!validation.valid) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-xl font-bold">Konfigurasi production belum valid</h1>
          <p className="mt-3 text-sm text-red-100">{validation.message}</p>
          <p className="mt-4 text-xs text-slate-300">
            Isi `.env.production` dengan endpoint HTTPS produksi dan certificate pin sebelum build production digunakan.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function MobileBridge() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  useEffect(() => registerDeepLinkHandlers(route => navigate(route)), [navigate])

  useEffect(() => {
    return registerMobileBackButton(
      () => {
        if (location.pathname !== '/' && location.pathname !== '/login') {
          navigate(-1)
          return true
        }
        return false
      },
      (msg) => toast(msg, 'info')
    )
  }, [location.pathname, navigate, toast])

  return null
}

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <MobileBridge />
      <AppRoutes />
    </HashRouter>
  )
}

// Initialize Sentry before mounting the React tree
initSentry()

const container = document.getElementById('root')!
const root = (window as any).__reactRoot || ((window as any).__reactRoot = ReactDOM.createRoot(container))

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ProductionConfigGate>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <DemoProvider>
                <App />
                <RemoteLicensePopup />
              </DemoProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </ProductionConfigGate>
    </ErrorBoundary>
  </React.StrictMode>
)
