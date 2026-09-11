const { contextBridge, ipcRenderer } = require('electron')

const isDev = process.env.NODE_ENV !== 'production'

/**
 * EXHAUSTIVE whitelist of all allowed IPC channels.
 * Any channel not in this list is BLOCKED.
 */
const ALLOWED_CHANNELS = new Set([
  // App
  'app:openExternal',

  // Auth
  'auth:init',
  'auth:hasUsers',
  'auth:createInitialAdmin',
  'auth:registerTrial',
  'auth:login',
  'auth:loginPin',
  'auth:verifyPinKasir',
  'auth:changePassword',
  'auth:checkIdentitas',
  'auth:restoreSession',
  'auth:logout',

  // Demo status
  'demo:getStatus',
  'demo:getViolationLog',

  // Sync
  'sync:getStatus',
  'sync:saveConfig',
  'sync:saveClientConfig',
  'sync:testConnection',
  'sync:testClientConnection',
  'sync:rotateToken',

  // Barang
  'barang:getAll',
  'barang:getPaginated',
  'barang:search',
  'barang:create',
  'barang:update',
  'barang:delete',
  'barang:bulkImport',
  'barang:getByKategori',
  'barang:batchUpdatePrice',
  'barang:getByBranch',

  // Kategori
  'kategori:getAll',
  'kategori:create',
  'kategori:update',
  'kategori:delete',

  // Satuan
  'satuan:getAll',

  // Penjualan
  'penjualan:getAll',
  'penjualan:getDetail',
  'penjualan:create',

  // Dashboard
  'dashboard:getSummary',

  // AI Assistant
  'assistant:ask',

  // Identitas
  'identitas:get',
  'identitas:save',

  // Supplier
  'supplier:getAll',
  'supplier:getById',
  'supplier:create',
  'supplier:update',
  'supplier:delete',

  // User Management
  'user:getAll',
  'user:create',
  'user:update',
  'user:changePassword',
  'user:resetPassword',
  'user:delete',
  'user:toggleStatus',
  'user:block',
  'user:extendAccess',
  'user:getPermissions',
  'user:savePermissions',

  // Customer
  'customer:getAll',
  'customer:getById',
  'customer:search',
  'customer:create',
  'customer:update',
  'customer:delete',
  'customer:toggleStatus',
  'customer:addPoin',
  'customer:getBirthdayToday',
  'customer:getRiwayatPembelian',

  // Notifikasi
  'notifikasi:getAll',
  'notifikasi:getUnread',
  'notifikasi:getUnreadCount',
  'notifikasi:create',
  'notifikasi:markAsRead',
  'notifikasi:markAllAsRead',
  'notifikasi:delete',
  'notifikasi:deleteAll',
  'notifikasi:checkStokMinimum',
  'notifikasi:checkExpiredProducts',

  // Kas
  'kas:getActiveKas',
  'kas:getAllKas',
  'kas:getKasById',
  'kas:bukaKas',
  'kas:tutupKas',
  'kas:getTransaksi',
  'kas:addPengeluaran',
  'kas:addPemasukan',
  'kas:deleteTransaksi',
  'kas:deleteKas',
  'kas:getLaporan',

  // Pembelian
  'pembelian:getAll',
  'pembelian:getById',
  'pembelian:create',
  'pembelian:updateStatus',
  'pembelian:delete',
  'pembelian:getLaporan',

  // Backup
  'backup:getAll',
  'backup:create',
  'backup:restore',
  'backup:delete',
  'backup:download',
  'backup:import',

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
  'activityLog:log',
  'activityLog:delete',
  'activityLog:deleteOldLogs',

  // Export
  'export:penjualanExcel',
  'export:penjualanPDF',
  'export:stokExcel',
  'export:stokPDF',
  'export:cashFlowExcel',
  'export:priceListPDF',
  'export:taxReportExcel',
  'export:toExcel',
  'export:toPDF',

  // Industry Integrations
  'integrations:get',
  'integrations:save',
  'integrations:testAi',
  'integrations:listAiModels',
  'integrations:testGoogleSheets',
  'integrations:exportDashboardToSheets',
  'integrations:exportReportToSheets',

  // Scheduler
  'scheduler:runStokCheck',
  'scheduler:runExpiredCheck',
  'scheduler:runDebtCheck',
  'scheduler:runBackup',
  'scheduler:runCleanLogs',

  // Barcode
  'barcode:generate',
  'barcode:search',
  'barcode:getSettings',
  'barcode:updateSettings',

  // Payment Methods
  'payment:getAll',
  'payment:create',
  'payment:update',
  'payment:delete',
  'payment:createQris',
  'payment:checkStatus',
  'payment:cancelQris',
  'payment:getGatewaySettings',
  'payment:saveGatewaySettings',
  'payment:getQrisSessions',
  'payment:markQrisPaid',

  // Accounting
  'accounting:getSummary',
  'accounting:getAccounts',
  'accounting:saveAccount',
  'accounting:deleteAccount',
  'accounting:getJournalEntries',
  'accounting:createJournalEntry',
  'accounting:getTrialBalance',

  // Tax
  'tax:getActive',
  'tax:getActiveRate',
  'tax:setActiveRate',
  'tax:getAll',
  'tax:setActive',
  'tax:create',
  'tax:update',
  'tax:delete',

  // Returns
  'return:create',
  'return:getAll',
  'return:getDetails',
  'return:approve',
  'return:reject',
  'return:delete',

  // Shifts
  'shift:open',
  'shift:close',
  'shift:getCurrent',
  'shift:getAll',
  'shift:delete',

  // Debts
  'debt:create',
  'debt:addPayment',
  'debt:getAll',
  'debt:getPayments',
  'debt:delete',

  // Stock Opname
  'opname:create',
  'opname:approve',
  'opname:getAll',
  'opname:getDetails',
  'opname:delete',
  'opname:addItem',
  'opname:getItems',

  // Product Images
  'productImage:add',
  'productImage:getByProduct',
  'productImage:delete',
  'productImage:setPrimary',

  // Updates
  'update:check',
  'update:getHistory',

  // Error Logging
  'errorLog:log',
  'errorLog:getAll',
  'errorLog:deleteOld',
  'errorLog:clear',

  // Subscription Plans
  'plan:getAll',
  'plan:getActive',
  'plan:create',
  'plan:update',
  'plan:deactivate',
  'plan:delete',

  // Tutorial
  'tutorial:getAll',
  'tutorial:getById',
  'tutorial:create',
  'tutorial:update',
  'tutorial:delete',

  // HPP Calculator
  'hpp:calculate',
  'hpp:getHistory',
  'hpp:getUsageCount',
  'hpp:delete',

  // Struk Settings
  'strukSettings:get',
  'strukSettings:update',
  'strukSettings:uploadQris',
  'strukSettings:removeQris',

  // System
  'system:checkDb',
  'system:resetData',
  'system:seedSampleData',

  // Satuan CRUD
  'satuan:create',
  'satuan:update',
  'satuan:delete',

  // Dialog
  'dialog:showSaveDialog',

  // Promo/Discount
  'promo:getAll',
  'promo:getActive',
  'promo:create',
  'promo:update',
  'promo:delete',
  'promo:validate',
  'promo:apply',

  // Branch/Multi-outlet
  'branch:getAll',
  'branch:getActive',
  'branch:getWarehouses',
  'branch:getById',
  'branch:getStockSummary',
  'branch:getTransferHistory',
  'branch:create',
  'branch:update',
  'branch:delete',
  'branch:transferStock',
  'stock:transfer',

  // Feature Hub
  'dailyNotes:getAll',
  'dailyNotes:create',
  'dailyNotes:update',
  'dailyNotes:delete',
  'pettyCash:getAll',
  'pettyCash:create',
  'pettyCash:delete',
  'notifSettings:get',
  'notifSettings:save',
  'priceList:get',
  'cashFlow:getAll',
  'taxReport:getSummary',
  'salesCommission:getAll',
  'salesCommission:getStaffDetail',
  'supplierRating:getAll',
  'membership:getAll',
  'stockHistory:getAll',

  // Loyalty/Points
  'loyalty:getTiers',
  'loyalty:getCustomerTier',
  'loyalty:calculatePoints',
  'loyalty:redeemPoints',
  'loyalty:createTier',
  'loyalty:updateTier',
  'loyalty:deleteTier',

  // Currency
  'currency:getAll',
  'currency:getActive',
  'currency:create',
  'currency:update',
  'currency:delete',
  'currency:setDefault',

  // Inventory / Warehouse
  'warehouse:getAll',
  'warehouse:create',
  'warehouse:update',
  'warehouse:delete',
  'inventory:getBatches',
  'inventory:addBatch',
  'inventory:updateBatch',
  'inventory:deleteBatch',
  'inventory:getSerials',
  'inventory:addSerial',
  'inventory:updateSerial',
  'inventory:deleteSerial',
  'inventory:transfer',
  'inventory:getWarehouseStock',
  'inventory:getTransfers',

  // Owner dashboard
  'ownerDashboard:getInsights',

  // Audit Trail
  'audit:getAll',
  'audit:log',
  'audit:clear',

  // Mobile App
  'mobile:getSummary',
  'mobile:processScan',

  // WhatsApp Settings
  'whatsapp:get',
  'whatsapp:save',
  'whatsapp:test',
  'whatsapp:getTemplates',
  'whatsapp:saveTemplate',
  'whatsapp:getBroadcastHistory',
  'whatsapp:saveBroadcastHistory',
  // Security Settings
  'security:get',
  'security:save',
  // Ecommerce API Settings
  'ecommerce:get',
  'ecommerce:save',
  'ecommerce:getIntegration',
  'ecommerce:saveIntegration',
  'ecommerce:syncNow',
  'ecommerce:enqueueStockUpdate',
  // Marketplace
  'marketplace:getChannels',
  'marketplace:saveChannel',
  'marketplace:deleteChannel',
  'marketplace:getSkuMap',
  'marketplace:saveSkuMap',
  'marketplace:runStockSync',
  // Device Tracking
  'device:getAll',
  'device:getByUser',
  'device:revoke',
  'device:revokeAll',
  'device:getAllSessions',
  'device:revokeSession',
  'device:detectPlatformOS',
  // Subscription / Feature Check
  'subscription:getStatus',
  'subscription:checkTransactionLimit',
  'subscription:isFeatureEnabled',
  'subscription:getActiveFeatures',
  'subscription:getPopupRule',
  'subscription:getUpgradePopup',
  // Popup Rules
  'popup:getAll',
  'popup:update',
  // License Server
  'license:getConfig',
  'license:testConnection',
  'license:testAndSave',
  'license:validateApplication',
  'license:syncFromServer',
  'license:syncBuyerLicense',
  'license:createPaymentInvoice',
  'license:createManualPaymentRequest',
  'license:createMidtransPayment',
  'license:checkMidtransPayment',
  'license:getPaymentStatus',
  'license:getPublicPlans',
  'license:getPublicPopup',
  'license:getUsers',
  'license:createUser',
  'license:updateUser',
  'license:deleteUser',
  'license:changeUserPlan',
  'license:resetUserPassword',
  'license:resetPassword',
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
  'license:checkAppUpdate',
  'license:getErrors',
  'license:getAnnouncements',
  'license:createAnnouncement',
  'license:updateAnnouncement',
  'license:deleteAnnouncement',
  'license:heartbeat',
  'license:logError',
  // Print
  'print:getPrinters',
  'print:execute',

  // Window / Display
  'window:openCustomerDisplay',
  'window:openQueueDisplay',

  // Employee / HR
  'employee:getAll',
  'employee:getById',
  'employee:search',
  'employee:create',
  'employee:update',
  'employee:delete',
  'employee:getByStatus',
  // Contracts
  'contract:getByEmployee',
  'contract:getById',
  'contract:create',
  'contract:update',
  'contract:terminate',
  // Attendance
  'attendance:getAll',
  'attendance:getByEmployee',
  'attendance:clockIn',
  'attendance:clockOut',
  'attendance:getSummary',
  // Payroll
  'payroll:getAll',
  'payroll:getByEmployee',
  'payroll:create',
  'payroll:updateStatus',
  'payroll:getSlip',
  'payroll:getSummary',
  'payroll:getDetails',
  'payroll:addDetail',
  'payroll:deleteDetail',
  // Tip Pooling
  'tip:getAll',
  'tip:create',
  'tip:distribute',
  'tip:getDistributions',
  // Shift Schedule
  'shiftSchedule:getAll',
  'shiftSchedule:getByEmployee',
  'shiftSchedule:create',
  'shiftSchedule:delete',

  // KDS (Kitchen Display)
  'kds:getOrders',
  'kds:getOrderById',
  'kds:createOrder',
  'kds:updateOrderStatus',
  'kds:deleteOrder',
  'kds:clearOrders',
  'kds:getOrderItems',
  'kds:addOrderItem',
  'kds:updateOrderItemStatus',
  'kds:getSummary',
  'kds:getPending',
  'kds:getAvgPrepTime',

  // Floor Layout & Tables
  'floor:getAll',
  'floor:getById',
  'floor:create',
  'floor:update',
  'floor:delete',
  'table:getAll',
  'table:getById',
  'table:create',
  'table:update',
  'table:updateStatus',
  'table:delete',
  'table:getSummary',

  // Reservations
  'reservation:getAll',
  'reservation:getById',
  'reservation:create',
  'reservation:update',
  'reservation:updateStatus',
  'reservation:delete',
  'reservation:cancel',
  'reservation:getActive',
  'reservation:getUpcoming',

  // Recipe / BOM
  'recipe:getAll',
  'recipe:getById',
  'recipe:create',
  'recipe:update',
  'recipe:delete',
  'recipe:getIngredients',
  'recipe:addIngredient',
  'recipe:updateIngredient',
  'recipe:deleteIngredient',
  'recipe:calcCost',
  'recipe:search',
  'recipe:getByProduct',

  // Delivery
  'delivery:getOrders',
  'delivery:getOrderById',
  'delivery:createOrder',
  'delivery:updateOrderStatus',
  'delivery:assignCourier',
  'delivery:getVehicles',
  'delivery:createVehicle',
  'delivery:updateVehicle',
  'delivery:deleteVehicle',

  // Bank & Finance
  'bank:getAccounts',
  'bank:getAccountById',
  'bank:createAccount',
  'bank:updateAccount',
  'bank:deleteAccount',
  'bank:getTransactions',
  'bank:addTransaction',
  'bank:reconcile',
  // Fixed Assets
  'asset:getAll',
  'asset:getById',
  'asset:create',
  'asset:update',
  'asset:delete',
  'asset:calcDepreciation',
  'asset:getDepreciationHistory',
  // Budgets
  'budget:getAll',
  'budget:getById',
  'budget:create',
  'budget:update',
  'budget:delete',
  'budget:getSummary',

  // Gift Card
  'giftcard:getAll',
  'giftcard:getById',
  'giftcard:getByCode',
  'giftcard:create',
  'giftcard:topUp',
  'giftcard:redeem',
  'giftcard:getUsage',

  // Customer Feedback
  'feedback:getAll',
  'feedback:getById',
  'feedback:create',
  'feedback:reply',
  'feedback:getSummary',

  // Campaigns
  'campaign:getAll',
  'campaign:getById',
  'campaign:create',
  'campaign:update',
  'campaign:delete',
  'campaign:send',
  'campaign:getLogs',

  // Storefront (Online Store)
  'storefront:getSettings',
  'storefront:updateSettings',
  'storefront:getProducts',
  'storefront:updateProduct',
  'storefront:getOrders',
  'storefront:getOrderById',
  'storefront:createOrder',
  'storefront:updateOrderStatus',

  // Vendor Portal
  'vendor:getSettings',
  'vendor:updateSettings',

  // Document Management
  'document:getAll',
  'document:getById',
  'document:create',
  'document:update',
  'document:delete',
  'document:search',

  // Forecasting & Dynamic Pricing
  'forecast:getSettings',
  'forecast:updateSettings',
  'forecast:getAll',
  'forecast:generate',
  'pricing:getRules',
  'pricing:createRule',
  'pricing:updateRule',
  'pricing:deleteRule',
  'pricing:getActive',
])

// Expose safe IPC bridge to renderer via window.api
contextBridge.exposeInMainWorld('api', {
  /**
   * Invoke an IPC channel with channel whitelist validation.
   * BLOCKED channels will throw an error immediately without reaching main process.
   */
  invoke: (channel, ...args) => {
    // SECURITY: Validate channel is in whitelist
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.error(`[PRELOAD BLOCKED] Channel "${channel}" is not whitelisted!`)
      return Promise.reject(new Error(`Channel "${channel}" is not allowed`))
    }

    // Only log IPC calls in development — prevents channel name leak in production
    if (isDev) console.log('[IPC invoke]', channel)
    return ipcRenderer.invoke(channel, ...args)
  },
  onDeepLink: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, url) => callback(url)
    ipcRenderer.on('app:deepLink', listener)
    return () => ipcRenderer.removeListener('app:deepLink', listener)
  },
})

contextBridge.exposeInMainWorld('secureStorage', {
  getItem: (key) => {
    const result = ipcRenderer.sendSync('secureStorage:getItem', key)
    if (!result?.success) return null
    return result.data ?? null
  },
  setItem: (key, value) => {
    const result = ipcRenderer.sendSync('secureStorage:setItem', key, value)
    return !!result?.success
  },
  removeItem: (key) => {
    const result = ipcRenderer.sendSync('secureStorage:removeItem', key)
    return !!result?.success
  },
})

if (isDev) console.log('[preload] window.api exposed successfully (with channel whitelist)')
