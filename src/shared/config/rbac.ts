export type AppRole = 'demo' | 'kasir' | 'operator' | 'admin' | 'super_admin' | 'developer'

const ROLE_ALIASES: Record<string, AppRole> = {
  superadmin: 'developer',
  owner: 'admin',
  user: 'kasir',
}

const ROLE_LEVEL: Record<AppRole, number> = {
  developer: 50,
  super_admin: 45,
  admin: 40,
  operator: 30,
  kasir: 20,
  demo: 10,
}

export const USER_PANEL_ROLES: AppRole[] = ['developer', 'super_admin', 'admin', 'operator', 'kasir', 'demo']
export const OPERATIONAL_ADMIN_ROLES: AppRole[] = ['developer', 'super_admin', 'admin']
export const DEVELOPER_PANEL_ROLES: AppRole[] = ['developer', 'super_admin']

// ─── PERMISSION CODES ─────────────────────────────────────────────────────────

export type PermissionCode =
  | 'nav_dashboard'
  | 'nav_penjualan'
  | 'nav_barang'
  | 'nav_pembelian'
  | 'nav_supplier'
  | 'nav_loyalty'
  | 'nav_pengguna'
  | 'nav_plans'
  | 'nav_tutorials'
  | 'nav_hpp'
  | 'nav_whatsapp'
  | 'nav_print_queue'
  | 'nav_identitas'
  | 'nav_export_db'
  | 'nav_activity_log'
  | 'nav_security'
  | 'nav_ecommerce_api'
  | 'nav_license_admin'
  | 'nav_branch'
  | 'nav_promo'
  | 'nav_employee'
  | 'nav_kds'
  | 'nav_fnb'
  | 'nav_delivery'
  | 'nav_finance_adv'
  | 'nav_marketing'
  | 'nav_storefront'

export const ALL_PERMISSIONS: PermissionCode[] = [
  'nav_dashboard',
  'nav_penjualan',
  'nav_barang',
  'nav_pembelian',
  'nav_supplier',
  'nav_loyalty',
  'nav_pengguna',
  'nav_plans',
  'nav_tutorials',
  'nav_hpp',
  'nav_whatsapp',
  'nav_print_queue',
  'nav_identitas',
  'nav_export_db',
  'nav_activity_log',
  'nav_security',
  'nav_ecommerce_api',
  'nav_license_admin',
  'nav_branch',
  'nav_promo',
  'nav_employee',
  'nav_kds',
  'nav_fnb',
  'nav_delivery',
  'nav_finance_adv',
  'nav_marketing',
  'nav_storefront',
]

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, PermissionCode[]> = {
  developer: ALL_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
  admin: [
    'nav_dashboard',
    'nav_penjualan',
    'nav_barang',
    'nav_pembelian',
    'nav_supplier',
    'nav_loyalty',
    'nav_pengguna',
    'nav_plans',
    'nav_tutorials',
    'nav_hpp',
    'nav_whatsapp',
    'nav_print_queue',
    'nav_identitas',
    'nav_export_db',
    'nav_activity_log',
    'nav_security',
    'nav_ecommerce_api',
    'nav_branch',
    'nav_promo',
    'nav_employee',
    'nav_kds',
    'nav_fnb',
    'nav_delivery',
    'nav_finance_adv',
    'nav_marketing',
    'nav_storefront',
  ],
  operator: [
    'nav_dashboard',
    'nav_penjualan',
    'nav_barang',
    'nav_pembelian',
    'nav_supplier',
    'nav_loyalty',
    'nav_tutorials',
    'nav_hpp',
    'nav_whatsapp',
    'nav_print_queue',
    'nav_promo',
    'nav_employee',
    'nav_kds',
    'nav_fnb',
    'nav_delivery',
  ],
  kasir: [
    'nav_dashboard',
    'nav_penjualan',
    'nav_barang',
    'nav_supplier',
    'nav_loyalty',
    'nav_kds',
    'nav_fnb',
  ],
  demo: [
    'nav_dashboard',
    'nav_penjualan',
    'nav_barang',
  ],
}

export function normalizeRole(role?: string | null): AppRole | null {
  if (!role) return null
  const normalized = role.trim().toLowerCase()
  return ROLE_ALIASES[normalized] ?? (ROLE_LEVEL[normalized as AppRole] ? normalized as AppRole : null)
}

export function hasRole(role: string | null | undefined, allowedRoles: readonly AppRole[]): boolean {
  const normalized = normalizeRole(role)
  return !!normalized && allowedRoles.includes(normalized)
}

export function hasMinRole(role: string | null | undefined, minRole: AppRole): boolean {
  const normalized = normalizeRole(role)
  if (!normalized) return false
  return ROLE_LEVEL[normalized] >= ROLE_LEVEL[minRole]
}

export function canOpenUserPanel(role: string | null | undefined): boolean {
  return hasRole(role, USER_PANEL_ROLES)
}

export function canManageOperations(role: string | null | undefined): boolean {
  return hasRole(role, OPERATIONAL_ADMIN_ROLES)
}

export function canOpenDeveloperPanel(role: string | null | undefined): boolean {
  return hasRole(role, DEVELOPER_PANEL_ROLES)
}

export function getDefaultPermissions(role: AppRole): PermissionCode[] {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? []
}

export function hasPermission(
  role: string | null | undefined,
  requiredPermissions: PermissionCode[],
  userPermissions?: Record<string, boolean>
): boolean {
  const normalized = normalizeRole(role)
  if (!normalized) return false
  const defaults = getDefaultPermissions(normalized)
  for (const code of requiredPermissions) {
    const userValue = userPermissions?.[code]
    const hasIt = userValue !== undefined ? userValue : defaults.includes(code)
    if (!hasIt) return false
  }
  return true
}

export interface UserIdentitySummary {
  nama_pengguna?: string | null
  nama_lengkap?: string | null
  email?: string | null
  hak_akses?: string | null
}

/**
 * Developer access is decided by the role stored in the database.
 *
 * Identity patterns such as a username, a display name or an email address
 * are not accepted here. Those values can be chosen by anyone who creates a
 * local account, so they must never grant access to the developer panel.
 */
export function isDeveloperUser(user?: UserIdentitySummary | null): boolean {
  if (!user) return false
  const role = normalizeRole(user.hak_akses)
  return role === 'developer' || role === 'super_admin'
}

