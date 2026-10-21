/**
 * Barrel export untuk modul license.
 *
 * Cara pakai cepat di app POS:
 *
 * import {
 *   initLicenseClient,
 *   LicenseProvider,
 *   LoginScreen,
 *   UpgradePopup,
 *   FeatureGate,
 *   useLicense,
 *   useFeature,
 * } from './license';
 *
 * const client = initLicenseClient({
 *   baseURL: import.meta.env.VITE_LICENSE_SERVER_URL || '',
 *   appPlatform: 'electron-windows',
 *   appVersion: '2.0.0',
 *   onForceLogout: () => location.reload(),
 * });
 *
 * function Root() {
 *   return (
 *     <LicenseProvider client={client}>
 *       <Gate />
 *       <UpgradePopup />
 *     </LicenseProvider>
 *   );
 * }
 *
 * function Gate() {
 *   const { ready, user } = useLicense();
 *   if (!ready) return <Splash />;
 *   if (!user)  return <LoginScreen />;
 *   return <PosApp />;
 * }
 */

export { initLicenseClient, getLicenseClient, secureStorage } from './apiClient';
export type {
  UserInfo,
  PlanInfo,
  FeatureMap,
  PopupConfig,
  AccountStatus,
  LicenseClientOptions,
} from './apiClient';
export { LicenseProvider, useLicense, useFeature, dispatchFeatureLocked } from './FeatureContext';
export { FeatureGate } from './FeatureGate';
export { UpgradePopup } from './UpgradePopup';
export { LoginScreen } from './LoginScreen';

// Panel admin (hanya dirender saat user lokal adalah developer).
export { AdminPanel, AdminGate, AdminLink, useIsAdmin, adminApi } from './admin';

/** Daftar fitur yang dipakai aplikasi POS. Pakai konstanta agar typo terdeteksi. */
export const FEATURES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  TRANSACTIONS: 'transactions',
  PRINT_RECEIPT: 'print_receipt',
  BARCODE_SCAN: 'barcode_scan',
  STOCK: 'stock',
  DISCOUNT: 'discount',
  TAX: 'tax',
  DEBT: 'debt',
  REPORTS: 'reports',
  EXPORT_EXCEL: 'export_excel',
  EXPORT_PDF: 'export_pdf',
  MULTI_CASHIER: 'multi_cashier',
  MULTI_BRANCH: 'multi_branch',
  BACKUP: 'backup',
  RESTORE: 'restore',
  SUPPLIER: 'supplier',
  CUSTOMER: 'customer',
  SHIFT: 'shift',
  RETURN_REFUND: 'return_refund',
} as const;

export type FeatureCode = (typeof FEATURES)[keyof typeof FEATURES];
