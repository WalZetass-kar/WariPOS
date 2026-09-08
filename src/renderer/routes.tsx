import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { RequireAuth, RequireDeveloperPanel, RequireMinRole, RequireOperationalAdmin, RequireRoles } from '../apps/routing/RouteGuards'

// ─── Lazy Imports ──────────────────────────────────────────────────────────────
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Produk = lazy(() => import('./pages/Produk'))
const Kategori = lazy(() => import('./pages/Kategori'))
const Satuan = lazy(() => import('./pages/Satuan'))
const Transaksi = lazy(() => import('./pages/Transaksi'))
const Riwayat = lazy(() => import('./pages/Riwayat'))
const Settings = lazy(() => import('./pages/Settings'))
const Supplier = lazy(() => import('./pages/Supplier'))
const Users = lazy(() => import('./pages/Users'))
const Customer = lazy(() => import('./pages/Customer'))
const Kas = lazy(() => import('./pages/Kas'))
const Accounting = lazy(() => import('./pages/Accounting'))
const Laporan = lazy(() => import('./pages/Laporan'))
const Backup = lazy(() => import('./pages/Backup'))
const Pembelian = lazy(() => import('./pages/Pembelian'))
const ActivityLog = lazy(() => import('./pages/ActivityLog'))
const Returns = lazy(() => import('./pages/Returns'))
const Shifts = lazy(() => import('./pages/Shifts'))
const Debts = lazy(() => import('./pages/Debts'))
const StockOpname = lazy(() => import('./pages/StockOpname'))
const Tutorials = lazy(() => import('./pages/Tutorials'))
const Hpp = lazy(() => import('./pages/Hpp'))
const Promo = lazy(() => import('./pages/Promo'))
const Branch = lazy(() => import('./pages/Branch'))
const Security = lazy(() => import('./pages/Security'))
const Loyalty = lazy(() => import('./pages/Loyalty'))
const WhatsApp = lazy(() => import('./pages/WhatsApp'))
const PrintQueue = lazy(() => import('./pages/PrintQueue'))
const EcommerceApi = lazy(() => import('./pages/EcommerceApi'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const LicenseCenter = lazy(() => import('./pages/LicenseCenter'))
const PaymentInvoice = lazy(() => import('./pages/PaymentInvoice'))
const PaymentAutomation = lazy(() => import('./pages/PaymentAutomation'))
const CustomerDisplay = lazy(() => import('./pages/CustomerDisplay'))
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'))
const StockTransfer = lazy(() => import('./pages/StockTransfer'))
const CustomerDisplayPage = lazy(() => import('./pages/CustomerDisplayPage'))
const DailyNotes = lazy(() => import('./pages/DailyNotes'))
const PriceList = lazy(() => import('./pages/PriceList'))
const StockHistory = lazy(() => import('./pages/StockHistory'))
const SupplierRating = lazy(() => import('./pages/SupplierRating'))
const MembershipCard = lazy(() => import('./pages/MembershipCard'))
const SalesCommission = lazy(() => import('./pages/SalesCommission'))
const TaxReport = lazy(() => import('./pages/TaxReport'))
const PettyCash = lazy(() => import('./pages/PettyCash'))
const CashFlow = lazy(() => import('./pages/CashFlow'))
const LabelPrint = lazy(() => import('./pages/LabelPrint'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))
const Integrations = lazy(() => import('./pages/Integrations'))
const AuditTrail = lazy(() => import('./pages/AuditTrail'))

// New Feature Pages
const Employee = lazy(() => import('./pages/Employee'))
const EmployeeContract = lazy(() => import('./pages/EmployeeContract'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Payroll = lazy(() => import('./pages/Payroll'))
const TipPooling = lazy(() => import('./pages/TipPooling'))
const ShiftSchedule = lazy(() => import('./pages/ShiftSchedule'))
const KitchenDisplay = lazy(() => import('./pages/KitchenDisplay'))
const TableManagement = lazy(() => import('./pages/TableManagement'))
const Reservation = lazy(() => import('./pages/Reservation'))
const Recipe = lazy(() => import('./pages/Recipe'))
const Delivery = lazy(() => import('./pages/Delivery'))
const BankAccount = lazy(() => import('./pages/BankAccount'))
const FixedAsset = lazy(() => import('./pages/FixedAsset'))
const Budget = lazy(() => import('./pages/Budget'))
const GiftCard = lazy(() => import('./pages/GiftCard'))
const CustomerFeedback = lazy(() => import('./pages/CustomerFeedback'))
const Campaign = lazy(() => import('./pages/Campaign'))
const Storefront = lazy(() => import('./pages/Storefront'))

// ─── Minimal Standalone Fallback (for Login, CustomerDisplay) ───────────────────
function StandaloneLoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500">Memuat...</span>
    </div>
  )
}

// ─── Preload core pages in background after initial render ─────────────────────
export function preloadCorePages() {
  if (typeof window === 'undefined') return
  const schedule = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1200))
  schedule(() => {
    import('./pages/Dashboard').catch(() => {})
    import('./pages/Transaksi').catch(() => {})
    import('./pages/Produk').catch(() => {})
    import('./pages/Riwayat').catch(() => {})
    import('./pages/Kas').catch(() => {})
    import('./pages/Laporan').catch(() => {})
    import('./pages/Settings').catch(() => {})
  })
}

// ─── Internal helper (used only within AppRoutes) ──────────────────────────────
function LegacyAppRedirect() {
  const { pathname, search, hash } = useLocation()
  const targetPath = pathname.replace(/^\/app(?=\/|$)/, '') || '/'
  return <Navigate to={`${targetPath}${search}${hash}`} replace />
}

// ─── App Routes ────────────────────────────────────────────────────────────────
export default function AppRoutes() {
  return (
    <Suspense fallback={<StandaloneLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app/*" element={<LegacyAppRedirect />} />
        <Route path="/developer/*" element={<Navigate to="/license-admin" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/license" element={<Navigate to="/payment" replace />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/owner-dashboard" element={<Navigate to="/" replace />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/produk" element={<Produk />} />
          <Route path="/kategori" element={<Kategori />} />
          <Route path="/satuan" element={<Satuan />} />
          <Route path="/transaksi" element={<Transaksi />} />
          <Route path="/riwayat" element={<Riwayat />} />
          <Route path="/supplier" element={<Supplier />} />
          <Route path="/customer" element={<Customer />} />
          <Route path="/kas" element={<Kas />} />
          <Route path="/accounting" element={<RequireMinRole minRole="admin"><Accounting /></RequireMinRole>} />
          <Route path="/laporan" element={<RequireMinRole minRole="admin"><Laporan /></RequireMinRole>} />
          <Route path="/pembelian" element={<Pembelian />} />
          <Route path="/users" element={<RequireRoles allowedRoles={['developer', 'super_admin', 'admin']}><Users /></RequireRoles>} />
          <Route path="/backup" element={<RequireOperationalAdmin><Backup /></RequireOperationalAdmin>} />
          <Route path="/activity-log" element={<RequireOperationalAdmin><ActivityLog /></RequireOperationalAdmin>} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/shifts" element={<Shifts />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/stock-opname" element={<StockOpname />} />
          <Route path="/advanced-inventory" element={<Navigate to="/branch" replace />} />
          <Route path="/subscription-plans" element={<Navigate to="/license-admin" replace />} />
          <Route path="/tutorials" element={<Tutorials />} />
          <Route path="/hpp" element={<Hpp />} />
          <Route path="/promo" element={<Promo />} />
          <Route path="/branch" element={<RequireRoles allowedRoles={['developer', 'super_admin', 'admin']}><Branch /></RequireRoles>} />
          <Route path="/security" element={<RequireOperationalAdmin><Security /></RequireOperationalAdmin>} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/whatsapp" element={<WhatsApp />} />
          <Route path="/print-queue" element={<PrintQueue />} />
          <Route path="/ecommerce-api" element={<RequireOperationalAdmin><EcommerceApi /></RequireOperationalAdmin>} />
          <Route path="/marketplace" element={<RequireOperationalAdmin><Marketplace /></RequireOperationalAdmin>} />
          <Route path="/payment" element={<PaymentInvoice />} />
          <Route path="/subscription" element={<PaymentInvoice />} />
          <Route path="/my-subscription" element={<PaymentInvoice />} />
          <Route path="/payment-automation" element={<RequireOperationalAdmin><PaymentAutomation /></RequireOperationalAdmin>} />
          <Route path="/stock-transfer" element={<RequireRoles allowedRoles={['developer', 'super_admin', 'admin']}><StockTransfer /></RequireRoles>} />
          <Route path="/customer-display-page" element={<CustomerDisplayPage />} />
          <Route path="/daily-notes" element={<DailyNotes />} />
          <Route path="/price-list" element={<PriceList />} />
          <Route path="/stock-history" element={<StockHistory />} />
          <Route path="/supplier-rating" element={<SupplierRating />} />
          <Route path="/membership-card" element={<MembershipCard />} />
          <Route path="/sales-commission" element={<SalesCommission />} />
          <Route path="/tax-report" element={<RequireMinRole minRole="admin"><TaxReport /></RequireMinRole>} />
          <Route path="/petty-cash" element={<PettyCash />} />
          <Route path="/cash-flow" element={<RequireMinRole minRole="admin"><CashFlow /></RequireMinRole>} />
          <Route path="/label-print" element={<LabelPrint />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/audit-trail" element={<RequireOperationalAdmin><AuditTrail /></RequireOperationalAdmin>} />
          <Route path="/license-admin" element={<RequireDeveloperPanel><LicenseCenter /></RequireDeveloperPanel>} />
          <Route path="/settings" element={<Settings />} />
          {/* ─── NEW FEATURE ROUTES ─────────────────────────────────── */}
          {/* HR & Employee */}
          <Route path="/employee" element={<Employee />} />
          <Route path="/employee-contract" element={<EmployeeContract />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/tip-pooling" element={<TipPooling />} />
          <Route path="/shift-schedule" element={<ShiftSchedule />} />
          {/* KDS & F&B */}
          <Route path="/kitchen-display" element={<KitchenDisplay />} />
          <Route path="/table-management" element={<TableManagement />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/recipe" element={<Recipe />} />
          {/* Delivery */}
          <Route path="/delivery" element={<Delivery />} />
          {/* Finance */}
          <Route path="/bank-account" element={<RequireMinRole minRole="admin"><BankAccount /></RequireMinRole>} />
          <Route path="/fixed-asset" element={<RequireMinRole minRole="admin"><FixedAsset /></RequireMinRole>} />
          <Route path="/budget" element={<RequireMinRole minRole="admin"><Budget /></RequireMinRole>} />
          {/* Marketing */}
          <Route path="/gift-card" element={<GiftCard />} />
          <Route path="/customer-feedback" element={<CustomerFeedback />} />
          <Route path="/campaign" element={<RequireRoles allowedRoles={['developer', 'super_admin', 'admin']}><Campaign /></RequireRoles>} />
          <Route path="/storefront" element={<RequireOperationalAdmin><Storefront /></RequireOperationalAdmin>} />
        </Route>
        <Route path="/customer-display" element={<CustomerDisplay />} />
        <Route path="/queue-display" element={<QueueDisplay />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export { AppRoutes }
