/**
 * DEMO GUARD V2 — Centralized IPC Mutation Blocker (Layer 2)
 * 
 * This guard wraps ALL IPC handlers in the main process.
 * It checks the server-side session (NOT client data) to determine
 * if the current user is in demo mode.
 * 
 * Key security properties:
 * 1. Uses demoSession (main process memory) — renderer can't tamper
 * 2. Blocks based on channel pattern — comprehensive coverage
 * 3. Logs all violation attempts — audit trail
 * 4. Catches errors from deeper layers — consistent error response
 */

import { demoSession } from '../services/demoSessionManager.js'
import type { IpcResponse } from '../../shared/types.js'
import { canManageOperations, canOpenDeveloperPanel } from '../../shared/config/rbac.js'

/** Standard blocked response — consistent across all layers */
export const DEMO_BLOCKED_RESPONSE: IpcResponse = {
  success: false,
  message: ' Mode Demo (READ ONLY): Aksi ini tidak diizinkan. Silakan login dengan akun biasa untuk menggunakan fitur penuh.',
}

const ACCESS_DENIED_RESPONSE: IpcResponse = {
  success: false,
  message: 'Akses ditolak. Akun Anda tidak memiliki izin untuk menjalankan aksi ini.',
}

/**
 * EXHAUSTIVE list of all mutation IPC channels.
 * If a channel is in this set, it is BLOCKED for demo users.
 * We use an explicit blocklist rather than a pattern match to prevent false negatives.
 */
const MUTATION_CHANNELS: Set<string> = new Set([
  // Barang (Products)
  'barang:create',
  'barang:update',
  'barang:delete',
  'barang:bulkImport',

  // Kategori
  'kategori:create',
  'kategori:update',
  'kategori:delete',

  // Satuan
  'satuan:create',
  'satuan:update',
  'satuan:delete',

  // Penjualan (Sales/Transactions)
  'penjualan:create',

  // Identitas (Store settings)
  'identitas:save',

  // WhatsApp
  'whatsapp:save',
  'whatsapp:test',
  'whatsapp:saveTemplate',
  'whatsapp:saveBroadcastHistory',

  // Security
  'security:save',

  // Ecommerce API
  'ecommerce:save',
  'ecommerce:saveIntegration',
  'ecommerce:syncNow',
  'ecommerce:enqueueStockUpdate',

  // License / device / popup administration
  'license:testAndSave',
  'license:syncFromServer',
  'license:deletePayment',
  'license:blockDevice',
  'license:unblockDevice',
  'license:suspendDeviceLicense',
  'license:activateDeviceLicense',
  'license:extendDeviceLicense',
  'license:saveAppUpdate',
  'license:createAnnouncement',
  'license:updateAnnouncement',
  'license:deleteAnnouncement',
  'device:revoke',
  'device:revokeAll',
  'device:revokeSession',
  'popup:update',

  // Supplier
  'supplier:create',
  'supplier:update',
  'supplier:delete',

  // User Management
  'user:create',
  'user:update',
  'user:changePassword',
  'user:resetPassword',
  'user:delete',
  'user:toggleStatus',
  'user:block',
  'user:extendAccess',
  'user:savePermissions',

  // Customer
  'customer:create',
  'customer:update',
  'customer:delete',
  'customer:toggleStatus',
  'customer:addPoin',

  // Notifikasi
  'notifikasi:create',
  'notifikasi:markAsRead',
  'notifikasi:markAllAsRead',
  'notifikasi:delete',
  'notifikasi:deleteAll',

  // Kas (Cash drawer)
  'kas:bukaKas',
  'kas:tutupKas',
  'kas:addPengeluaran',
  'kas:addPemasukan',
  'kas:deleteTransaksi',
  'kas:deleteKas',

  // Pembelian (Purchases)
  'pembelian:create',
  'pembelian:updateStatus',
  'pembelian:delete',

  // Backup & Restore
  'backup:create',
  'backup:restore',
  'backup:delete',
  'backup:import',

  // Activity Log
  'activityLog:log',
  'activityLog:delete',
  'activityLog:deleteOldLogs',

  // Scheduler Manual Triggers
  'scheduler:runBackup',
  'scheduler:runCleanLogs',

  // Barcode
  'barcode:generate',
  'barcode:updateSettings',

  // Payment Methods
  'payment:create',
  'payment:update',
  'payment:delete',
  'payment:createQris',
  'payment:cancelQris',

  // Tax
  'tax:setActive',
  'tax:create',
  'tax:update',
  'tax:delete',

  // Returns
  'return:create',
  'return:approve',
  'return:reject',
  'return:delete',

  // Shifts
  'shift:open',
  'shift:close',
  'shift:delete',

  // Debts
  'debt:create',
  'debt:addPayment',
  'debt:delete',

  // Stock Opname
  'opname:create',
  'opname:approve',
  'opname:delete',
  'opname:addItem',

  // Product Images
  'productImage:add',
  'productImage:delete',
  'productImage:setPrimary',

  // Error Log (allow log, block clear/delete)
  'errorLog:deleteOld',
  'errorLog:clear',

  // Tutorials (admin-only mutations)
  'tutorial:create',
  'tutorial:update',
  'tutorial:delete',

  // Subscription plans
  'plan:create',
  'plan:update',
  'plan:deactivate',
  'plan:delete',

  // HPP Calculator (delete own record)
  'hpp:delete',

  // Advanced Features (Mutations)
  'currency:create',
  'currency:update',
  'currency:delete',
  'currency:setDefault',

  'warehouse:create',
  'warehouse:update',
  'warehouse:delete',

  'inventory:addBatch',
  'inventory:updateBatch',
  'inventory:deleteBatch',
  'inventory:addSerial',
  'inventory:updateSerial',
  'inventory:deleteSerial',
  'inventory:transfer',

  'promo:create',
  'promo:update',
  'promo:delete',
  'promo:toggleStatus',
  'promo:apply',

  'branch:create',
  'branch:update',
  'branch:delete',
  'branch:transferStock',

  'loyalty:redeemPoints',
  'loyalty:createTier',
  'loyalty:updateTier',
  'loyalty:deleteTier',

  'strukSettings:update',
  'strukSettings:uploadQris',
  'strukSettings:removeQris',

  'audit:log',
  'audit:clear',
  'audit:deleteOld',

  'mobile:processScan',

  // Note: strukSettings channels have custom role-based access control

  // See shouldBlockChannel() function
])


/**
* READ-ONLY channels that are always allowed.
* Used as secondary validation.
*/
const READ_CHANNELS: Set<string> = new Set([
// ... rest of read channels
'strukSettings:get',

// Advanced Features (Reads)
'currency:getAll',
'currency:getById',
'currency:getActive',

'warehouse:getAll',
'warehouse:getById',

'inventory:getBatches',
'inventory:getSerials',
'inventory:getTransfers',

'promo:getAll',
'promo:getById',
'promo:getActive',

'audit:getAll',
'audit:getLatest',

'mobile:getSummary',

  'auth:checkIdentitas',
  'auth:logout',

  // Demo session info
  'demo:getStatus',
  'demo:getViolationLog',

  // Barang
  'barang:getAll',
  'barang:search',

  // Kategori
  'kategori:getAll',

  // Satuan
  'satuan:getAll',

  // Penjualan
  'penjualan:getAll',
  'penjualan:getDetail',

  // Dashboard
  'dashboard:getSummary',

  // Identitas
  'identitas:get',

  // Supplier
  'supplier:getAll',
  'supplier:getById',

  // User
  'user:getAll',
  'user:getPermissions',

  // Customer
  'customer:getAll',
  'customer:getById',
  'customer:search',
  'customer:getBirthdayToday',
  'customer:getRiwayatPembelian',

  // Notifikasi
  'notifikasi:getAll',
  'notifikasi:getUnread',
  'notifikasi:getUnreadCount',
  'notifikasi:checkStokMinimum',
  'notifikasi:checkExpiredProducts',

  // Kas
  'kas:getActiveKas',
  'kas:getAllKas',
  'kas:getKasById',
  'kas:getTransaksi',
  'kas:getLaporan',

  // Pembelian
  'pembelian:getAll',
  'pembelian:getById',
  'pembelian:getLaporan',

  // Backup
  'backup:getAll',
  'backup:download',

  // Laporan
  'laporan:penjualan',
  'laporan:labaRugi',
  'laporan:produkTerlaris',
  'laporan:stok',
  'laporan:kas',
  'laporan:customer',

  // Activity Log
  'activityLog:getAll',
  'activityLog:getByUsername',
  'activityLog:getByModul',
  'activityLog:search',

  // Export (read-only)
  'export:penjualanExcel',
  'export:penjualanPDF',
  'export:stokExcel',
  'export:stokPDF',
  'export:toExcel',
  'export:toPDF',

  // Scheduler checks (read-only triggers)
  'scheduler:runStokCheck',
  'scheduler:runExpiredCheck',
  'scheduler:runDebtCheck',

  // Barcode
  'barcode:search',
  'barcode:getSettings',

  // Payment Methods
  'payment:getAll',
  'payment:checkStatus',

  // Tax
  'tax:getActive',
  'tax:getAll',

  // Returns
  'return:getAll',

  // Shifts
  'shift:getCurrent',
  'shift:getAll',

  // Debts
  'debt:getAll',
  'debt:getPayments',

  // Stock Opname
  'opname:getAll',
  'opname:getDetails',
  'opname:getItems',

  // Product Images
  'productImage:getByProduct',

  // Updates
  'update:check',
  'update:getHistory',

  // Error Log
  'errorLog:log',
  'errorLog:getAll',

  // Subscription plans (read-only for all users)
  'plan:getAll',
  'plan:getActive',

  // Branch / multi-outlet
  'branch:getAll',
  'branch:getActive',
  'branch:getWarehouses',
  'branch:getById',

  // Loyalty
  'loyalty:getTiers',
  'loyalty:getCustomerTier',
  'loyalty:calculatePoints',

  // Promo
  'promo:validate',

  // Mobile app
  'mobile:getSummary',

  // Tutorials (all users can read)
  'tutorial:getAll',
  'tutorial:getById',

  // HPP Calculator (demo users can calculate up to limit, reads always allowed)
  'hpp:calculate',
  'hpp:getHistory',
  'hpp:getUsageCount',

  // Struk Settings (all users can read)
  'strukSettings:get',
])

const OPERATIONAL_ADMIN_CHANNELS: Set<string> = new Set([
  'backup:getAll',
  'backup:create',
  'backup:restore',
  'backup:delete',
  'backup:download',
  'backup:import',
  'activityLog:getAll',
  'activityLog:getByUsername',
  'activityLog:getByModul',
  'activityLog:search',
  'activityLog:delete',
  'activityLog:deleteOldLogs',
  'ecommerce:get',
  'ecommerce:save',
  'ecommerce:getIntegration',
  'ecommerce:saveIntegration',
  'ecommerce:syncNow',
  'ecommerce:enqueueStockUpdate',
])

const ADMIN_ONLY_CHANNELS: Set<string> = new Set([
  // User administration
  'user:getAll',
  'user:create',
  'user:update',
  'user:resetPassword',
  'user:delete',
  'user:toggleStatus',
  'user:block',
  'user:extendAccess',
  'user:savePermissions',

  // App administration
  'backup:getAll',
  'backup:create',
  'backup:restore',
  'backup:delete',
  'backup:download',
  'backup:import',
  'activityLog:getAll',
  'activityLog:getByUsername',
  'activityLog:getByModul',
  'activityLog:search',
  'activityLog:delete',
  'activityLog:deleteOldLogs',
  'security:get',
  'security:save',
  'ecommerce:get',
  'ecommerce:save',
  'ecommerce:getIntegration',
  'ecommerce:saveIntegration',
  'ecommerce:syncNow',
  'ecommerce:enqueueStockUpdate',
  'system:resetData',

  // Commercial/admin setup
  'plan:getAll',
  'plan:create',
  'plan:update',
  'plan:deactivate',
  'plan:delete',
  'device:getAll',
  'device:getByUser',
  'device:revoke',
  'device:revokeAll',
  'device:getAllSessions',
  'device:revokeSession',
  'device:detectPlatformOS',
  'popup:getAll',
  'popup:update',
  'license:getConfig',
  'license:testConnection',
  'license:testAndSave',
  'license:validateApplication',
  'license:syncFromServer',
  'license:getUsers',
  'license:createUser',
  'license:updateUser',
  'license:deleteUser',
  'license:changeUserPlan',
  'license:resetUserPassword',
  'license:getPlans',
  'license:createPlan',
  'license:updatePlan',
  'license:deletePlan',
  'license:getPlanFeatures',
  'license:setPlanFeatures',
  'license:getFeatures',
  'license:createFeature',
  'license:updateFeature',
  'license:getPopups',
  'license:updatePopup',
  'license:getPayments',
  'license:createPayment',
  'license:approvePayment',
  'license:deletePayment',
  'license:getStats',
  'license:getRevenue',
  'license:getDevices',
  'license:getDeviceDetail',
  'license:blockDevice',
  'license:unblockDevice',
  'license:suspendDeviceLicense',
  'license:activateDeviceLicense',
  'license:extendDeviceLicense',
  'license:getAppUpdates',
  'license:saveAppUpdate',
  'license:getErrors',
  'license:getAnnouncements',
  'license:createAnnouncement',
  'license:updateAnnouncement',
  'license:deleteAnnouncement',

  // Audit maintenance
  'audit:getAll',
  'audit:clear',
  'audit:deleteOld',
])

const PUBLIC_LICENSE_CHANNELS: Set<string> = new Set([
  'license:syncBuyerLicense',
  'license:createPaymentInvoice',
  'license:createManualPaymentRequest',
  'license:getPaymentStatus',
  'license:getPublicPlans',
  'license:getPublicPopup',
  'license:checkAppUpdate',
  'license:heartbeat',
  'license:logError',
])

function canAccessAdminChannel(role: string | null): boolean {
  return canOpenDeveloperPanel(role)
}

const FEATURE_CHANNELS: Array<{ match: (channel: string) => boolean; feature: string }> = [
  { match: channel => channel.startsWith('laporan:'), feature: 'reports' },
  { match: channel => channel === 'export:penjualanExcel' || channel === 'export:stokExcel' || channel === 'export:toExcel', feature: 'export_excel' },
  { match: channel => channel === 'export:penjualanPDF' || channel === 'export:stokPDF' || channel === 'export:toPDF', feature: 'export_pdf' },
  { match: channel => channel === 'backup:restore' || channel === 'backup:import', feature: 'restore' },
  { match: channel => channel.startsWith('backup:') && channel !== 'backup:getAll', feature: 'backup' },
  { match: channel => channel.startsWith('opname:'), feature: 'stock_opname' },
  { match: channel => channel.startsWith('shift:'), feature: 'shift_management' },
  { match: channel => channel.startsWith('debt:'), feature: 'debt_management' },
  { match: channel => channel.startsWith('branch:'), feature: 'multi_branch' },
  { match: channel => channel.startsWith('return:'), feature: 'return_refund' },
  { match: channel => channel.startsWith('ecommerce:'), feature: 'api_access' },
]

function requiredFeatureForChannel(channel: string): string | null {
  return FEATURE_CHANNELS.find(rule => rule.match(channel))?.feature ?? null
}

/**
 * Check if a channel is a mutation (write) operation.
 */
export function isMutationChannel(channel: string): boolean {
  if (PUBLIC_LICENSE_CHANNELS.has(channel)) return false

  // Explicit check against the mutation set
  if (MUTATION_CHANNELS.has(channel)) return true

  // Fallback pattern check for any NEW channels that might be added later
  // This catches channels like "newFeature:create" that haven't been added to the set yet
  const mutationPatterns = [
    ':create', ':update', ':delete', ':save', ':simpan',
    ':hapus', ':ubah', ':buka', ':tutup', ':bayar',
    ':cicil', ':approve', ':reject', ':reset',
    ':add', ':remove', ':set', ':toggle', ':import',
    ':restore', ':clear', ':open', ':close',
  ]
  
  // Only apply pattern matching for channels NOT in the read set
  if (!READ_CHANNELS.has(channel)) {
    return mutationPatterns.some(p => channel.endsWith(p) || channel.includes(p))
  }

  return false
}

/**
 * Check if a channel should be blocked based on user role.
 * Returns true if the user doesn't have permission.
 */
export function shouldBlockChannel(channel: string): boolean {
  const role = demoSession.getRole()

  // Public license self-service endpoints must be reachable from the login,
  // trial, and buyer flows. Admin-only license management remains below.
  if (PUBLIC_LICENSE_CHANNELS.has(channel)) return false

  // Operational admin channels can be used by store admins and developer roles.
  if (OPERATIONAL_ADMIN_CHANNELS.has(channel)) {
    return !canManageOperations(role)
  }

  // Developer-only channels are blocked for every non-developer role, including demo.
  if (ADMIN_ONLY_CHANNELS.has(channel)) {
    return !canAccessAdminChannel(role)
  }

  // Demo users blocked from all mutations
  if (demoSession.isDemoMode()) {
    return isMutationChannel(channel)
  }
  
  // Struk settings: only developer, admin, operator allowed
  const strukSettingsChannels = [
    'strukSettings:update',
    'strukSettings:uploadQris',
    'strukSettings:removeQris',
  ]
  
  if (strukSettingsChannels.includes(channel)) {
    const allowedRoles = ['developer', 'admin', 'operator']
    // Block if role is NOT in allowed list
    return !allowedRoles.includes(role || '')
  }
  
  // All other channels: allow for non-demo users
  return false
}

/**
 * Check if a channel should be blocked for demo users.
 * Returns true if the channel is a mutation AND the user is demo.
 * @deprecated Use shouldBlockChannel instead
 */
export function shouldBlockDemoChannel(channel: string): boolean {
  return shouldBlockChannel(channel)
}

/**
 * Create a demo-guarded IPC handler.
 * Wraps the original handler with demo mode check.
 * 
 * @param channel - The IPC channel name
 * @param handler - The original handler function
 * @returns Wrapped handler that blocks demo users from mutations
 */
export function withDemoGuard<T extends (...args: any[]) => any>(
  channel: string,
  handler: T
): T {
  const wrapped = (async (...args: any[]) => {
    // Check if this channel should be blocked
    if (shouldBlockChannel(channel)) {
      if (demoSession.isDemoMode()) {
        demoSession.logViolation(channel, args.slice(1)) // Skip IPC event arg
        return { ...DEMO_BLOCKED_RESPONSE }
      }

      console.warn(` ACCESS DENIED: channel="${channel}" user="${demoSession.getUsername()}" role="${demoSession.getRole()}"`)
      return { ...ACCESS_DENIED_RESPONSE }
    }

    const username = demoSession.getUsername()
    const feature = requiredFeatureForChannel(channel)
    if (feature && username && !canAccessAdminChannel(demoSession.getRole())) {
      const { getUpgradePopup, isFeatureEnabled } = await import('./subscriptionGuard.js')
      if (!isFeatureEnabled(username, feature)) {
        const popup = getUpgradePopup(username, feature)
        return {
          success: false,
          error_code: 'FEATURE_LOCKED',
          message: 'Fitur ini tidak aktif untuk paket langganan akun Anda.',
          data: { feature, popup },
        }
      }
    }

    // Execute the original handler
    try {
      return await handler(...args)
    } catch (error: any) {
      // Catch demo blocks from the database layer
      if (
        error.code === 'DEMO_WRITE_BLOCKED' ||
        error.message?.includes('DEMO_MODE_BLOCKED')
      ) {
        demoSession.logViolation(`${channel}:db-layer`, args.slice(1))
        return { ...DEMO_BLOCKED_RESPONSE }
      }
      throw error
    }
  }) as unknown as T

  return wrapped
}
