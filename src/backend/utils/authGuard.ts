import { demoSession } from '../services/demoSessionManager.js';
import { normalizeRole, hasMinRole, type AppRole } from '../../shared/config/rbac.js';
import type { IpcResponse } from '../../shared/types.js';

const MIN_ROLE_FOR_ACCESS: Record<string, AppRole> = {
  // System & admin functions
  'system:resetData': 'admin',
  'user:create': 'admin',
  'user:update': 'kasir',
  'user:delete': 'admin',
  'user:managePermissions': 'developer',
  'backup:create': 'admin',
  'backup:restore': 'developer',
  'export:database': 'admin',

  // Financial & sensitive reports
  'laporan:labaRugi': 'operator',
  'laporan:penjualan': 'kasir',
  'laporan:pembelian': 'operator',
  'laporan:stok': 'kasir',
  'laporan:kas': 'operator',
  'shift:close': 'operator',

  // Inventory management
  'barang:create': 'operator',
  'barang:update': 'operator',
  'barang:delete': 'admin',
  'barang:bulkDelete': 'admin',
  'pembelian:create': 'operator',
  'pembelian:update': 'operator',
  'supplier:create': 'operator',
  'supplier:delete': 'admin',

  // HR & employee
  'employee:create': 'admin',
  'employee:delete': 'admin',
  'payroll:process': 'admin',

  // Finance
  'finance:createJournal': 'admin',
  'finance:approveJournal': 'developer',

  // License & subscription
  'license:admin': 'developer',

  // Security
  'security:updateSettings': 'admin',

  // E-commerce & integrations
  'ecommerce:sync': 'operator',
  'marketplace:sync': 'operator',

  // Branch management
  'branch:create': 'developer',
  'branch:delete': 'developer',
}

/**
 * Checks if the current user has a valid local session.
 * Returns an error response if not authenticated, otherwise null.
 */
export async function requireAuth(): Promise<IpcResponse | null> {
  const role = demoSession.getRole();
  if (!role) {
    return {
      success: false,
      message: ' Anda harus login untuk mengakses fitur ini.',
    };
  }
  return null;
}

/**
 * Checks if the current user has a minimum role level.
 * Uses the role hierarchy: developer > super_admin > admin > operator > kasir > demo
 */
export function requireMinRole(
  role: string | null | undefined,
  minRole: AppRole,
  channel?: string
): IpcResponse | null {
  if (!role) {
    return {
      success: false,
      message: ' Silakan login terlebih dahulu.',
    };
  }
  if (!hasMinRole(role, minRole)) {
    return {
      success: false,
      message: ` Anda tidak memiliki izin untuk mengakses fitur ini. Minimal role: ${minRole}.`,
    };
  }
  return null;
}

/**
 * Get minimum required role for a specific channel.
 * Falls back to 'kasir' (minimum access) for unlisted channels.
 */
export function getMinRoleForChannel(channel: string): AppRole {
  return MIN_ROLE_FOR_ACCESS[channel] ?? 'kasir'
}

/**
 * Combined auth + role check for IPC handlers.
 * Checks both authentication and minimum role level.
 */
export function requireChannelAccess(
  role: string | null | undefined,
  channel: string
): IpcResponse | null {
  const authErr = role ? null : {
    success: false,
    message: ' Silakan login terlebih dahulu.',
  } as IpcResponse;
  if (authErr) return authErr;

  const minRole = getMinRoleForChannel(channel);
  return requireMinRole(role, minRole, channel);
}
