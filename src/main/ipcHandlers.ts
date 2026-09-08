import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import { BarangController } from '../backend/controllers/BarangController.js'
import { KategoriController } from '../backend/controllers/KategoriController.js'
import { SatuanController } from '../backend/controllers/SatuanController.js'
import { PenjualanController } from '../backend/controllers/PenjualanController.js'
import { DashboardController } from '../backend/controllers/DashboardController.js'
import { IdentitasController } from '../backend/controllers/IdentitasController.js'
import { AuthController } from '../backend/controllers/AuthController.js'
import { SupplierController } from '../backend/controllers/SupplierController.js'
import { UserController } from '../backend/controllers/UserController.js'
import { CustomerController } from '../backend/controllers/CustomerController.js'
import { NotifikasiController } from '../backend/controllers/NotifikasiController.js'
import { KasController } from '../backend/controllers/KasController.js'
import { PembelianController } from '../backend/controllers/PembelianController.js'
import { BackupController } from '../backend/controllers/BackupController.js'
import { LaporanController } from '../backend/controllers/LaporanController.js'
import { ActivityLogController } from '../backend/controllers/ActivityLogController.js'
import { ExportController } from '../backend/controllers/ExportController.js'
import { SchedulerService } from '../backend/services/scheduler.js'
import { BarcodeController } from '../backend/controllers/BarcodeController.js'
import { PaymentMethodController, TaxController, ReturnController, ShiftController, DebtController, StockOpnameController, ProductImageController } from '../backend/controllers/NewFeaturesController.js'
import { UpdateService } from '../backend/services/updateService.js'
import { ErrorLogService } from '../backend/services/errorLogService.js'
import { demoSession } from '../backend/services/demoSessionManager.js'
import { withDemoGuard, DEMO_BLOCKED_RESPONSE } from '../backend/middleware/demoGuardV2.js'
import { PlanController } from '../backend/controllers/PlanController.js'
import { TutorialController } from '../backend/controllers/TutorialController.js'
import { HppController } from '../backend/controllers/HppController.js'
import { StrukSettingsController } from '../backend/controllers/StrukSettingsController.js'
import { SystemController } from '../backend/controllers/SystemController.js'
import { CurrencyController } from '../backend/controllers/CurrencyController.js'
import { InventoryController } from '../backend/controllers/InventoryController.js'
import { AuditController } from '../backend/controllers/AuditController.js'
import { PromoController } from '../backend/controllers/PromoController.js'
import { PromoService } from '../backend/services/promoService.js'
import { MobileAppController } from '../backend/controllers/MobileAppController.js'
import { BranchController } from '../backend/controllers/BranchController.js'
import { FeatureHubController } from '../backend/controllers/FeatureHubController.js'
import { WhatsAppController } from '../backend/controllers/WhatsAppController.js'
import { LoyaltyController } from '../backend/controllers/LoyaltyController.js'
import { SecurityController } from '../backend/controllers/SecurityController.js'
import { EcommerceApiController } from '../backend/controllers/EcommerceApiController.js'
import { IndustrySettingsController } from '../backend/controllers/IndustrySettingsController.js'
import { AssistantController } from '../backend/controllers/AssistantController.js'
import { LicenseController } from '../backend/controllers/LicenseController.js'
import { DeviceController, detectPlatformOS } from '../backend/controllers/DeviceController.js'
import { AccountingController } from '../backend/controllers/AccountingController.js'
import { OwnerDashboardController } from '../backend/controllers/OwnerDashboardController.js'
import { MarketplaceController } from '../backend/controllers/MarketplaceController.js'
import { EmployeeController } from '../backend/controllers/EmployeeController.js'
import { KdsController } from '../backend/controllers/KdsController.js'
import { RecipeController } from '../backend/controllers/RecipeController.js'
import { DeliveryController } from '../backend/controllers/DeliveryController.js'
import { FinanceController } from '../backend/controllers/FinanceController.js'
import { MarketingController } from '../backend/controllers/MarketingController.js'
import { CommerceController } from '../backend/controllers/CommerceController.js'
import { getSubscriptionStatus, checkTransactionLimit, getPopupRule, isFeatureEnabled, getActiveFeatures, getUpgradePopup } from '../backend/middleware/subscriptionGuard.js'
import { sqlite } from '../database/connection.js'
import { SyncServerService, setSyncChannelInvoker } from './syncServer.js'
import { SyncClientService } from './syncClient.js'
import { openExternalHttps } from './platformSecurity.js'
import type { PaginationParams } from '../backend/utils/pagination.js'

type ChannelHandler = (...args: any[]) => any

const channelHandlers = new Map<string, ChannelHandler>()
const approvedSavePaths = new Set<string>()

// ─── INPUT VALIDATION HELPERS ─────────────────────────────────────────
function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLength).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

function validateRequired(data: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (!data[field] && data[field] !== 0 && data[field] !== false) {
      return `Field "${field}" wajib diisi`
    }
  }
  return null
}

function validateNumber(value: unknown, options?: { min?: number; max?: number; required?: boolean }): number | null {
  const num = Number(value)
  if (isNaN(num)) return options?.required ? null : 0
  if (options?.min !== undefined && num < options.min) return options.min
  if (options?.max !== undefined && num > options.max) return options.max
  return num
}

function consumeApprovedSavePath(customPath?: string) {
  if (!customPath) return undefined
  const resolved = path.resolve(customPath)
  if (!approvedSavePaths.has(resolved)) {
    throw new Error('Path export tidak berasal dari dialog simpan aplikasi.')
  }
  approvedSavePaths.delete(resolved)
  return resolved
}

function isDatabaseCorruptionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('database disk image is malformed')
    || message.includes('database image is malformed')
}

function channelErrorResponse(channel: string, error: unknown) {
  console.error(`IPC channel error [${channel}]:`, error)

  if (isDatabaseCorruptionError(error)) {
    return {
      success: false,
      error_code: 'DATABASE_CORRUPT',
      message: 'Database lokal rusak/korup. Tutup aplikasi, lalu restore backup yang valid atau jalankan recovery database.',
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    success: false,
    message: message.length > 200 ? 'Terjadi kesalahan internal. Silakan coba lagi.' : message,
  }
}

function registerChannel(channel: string, handler: ChannelHandler) {
  channelHandlers.set(channel, handler)
  return handler
}

export async function invokeRegisteredChannel(channel: string, args: unknown[] = []) {
  const handler = channelHandlers.get(channel)
  if (!handler) {
    return {
      success: false,
      message: `Channel tidak terdaftar: ${channel}`,
    }
  }

  try {
    return await handler(...args)
  } catch (error) {
    return channelErrorResponse(channel, error)
  }
}

function syncRendererSession(channel: string, result: any) {
  if (channel === 'auth:logout') {
    demoSession.clearSession()
    return
  }

  if (!['auth:login', 'auth:loginPin', 'auth:restoreSession', 'auth:registerTrial'].includes(channel)) return
  if (!result?.success || !result.data || result.data.must_change_password) return

  const userData = result.data as { nama_pengguna?: string; hak_akses?: string }
  if (userData.nama_pengguna) {
    demoSession.setSession(userData.nama_pengguna, userData.hak_akses || 'kasir')
  }
}

async function invokeRendererChannel(channel: string, args: unknown[], localHandler: ChannelHandler) {
  try {
    if (SyncClientService.shouldForward(channel)) {
      const result = await SyncClientService.invoke(channel, args)
      syncRendererSession(channel, result)
      return result
    }

    const result = await localHandler(...args)
    syncRendererSession(channel, result)
    return result
  } catch (error) {
    return channelErrorResponse(channel, error)
  }
}

/**
 * Helper to register an IPC handler with automatic demo guard.
 * Every channel goes through withDemoGuard which checks the server-side session.
 */
function handle(ipcMain: IpcMain, channel: string, handler: (...args: any[]) => any) {
  registerChannel(channel, handler)
  const guarded = withDemoGuard(channel, (_e: any, ...args: any[]) => invokeRendererChannel(channel, args, handler))
  ipcMain.handle(channel, guarded)
}

export function registerIpcHandlers(ipcMain: IpcMain) {
  setSyncChannelInvoker(invokeRegisteredChannel)

  ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
    return openExternalHttps(rawUrl)
  })

  // ─── AUTH (always allowed — no demo guard needed) ───────────────────
  ipcMain.handle('auth:init', () => ({ success: true }))

  const authHasUsers = registerChannel('auth:hasUsers', () => AuthController.hasUsers())
  ipcMain.handle('auth:hasUsers', () => invokeRendererChannel('auth:hasUsers', [], authHasUsers))

  const authCreateInitialAdmin = registerChannel('auth:createInitialAdmin', (data: { username?: string; nama_lengkap?: string; password?: string }) => (
    AuthController.createInitialAdmin(data)
  ))
  ipcMain.handle('auth:createInitialAdmin', (_e, data: { username?: string; nama_lengkap?: string; password?: string }) => (
    invokeRendererChannel('auth:createInitialAdmin', [data], authCreateInitialAdmin)
  ))

  const authRegisterTrial = registerChannel('auth:registerTrial', (data: {
    username?: string
    nama_lengkap?: string
    email?: string
    no_telp?: string
    password?: string
  }, deviceInfo?: any) => (
    AuthController.registerTrial(data, deviceInfo)
  ))
  ipcMain.handle('auth:registerTrial', (_e, data: {
    username?: string
    nama_lengkap?: string
    email?: string
    no_telp?: string
    password?: string
  }, deviceInfo?: any) => (
    invokeRendererChannel('auth:registerTrial', [data, deviceInfo], authRegisterTrial)
  ))

  const authLogin = registerChannel('auth:login', async (username: string, password: string, deviceInfo?: any) => {
    const result = await AuthController.login(username, password, deviceInfo)
    
    // CRITICAL: Set the server-side session on successful login
    if (result.success && result.data && !(result.data as { must_change_password?: boolean }).must_change_password) {
      const userData = result.data as { nama_pengguna: string; hak_akses: string }
      demoSession.setSession(userData.nama_pengguna, userData.hak_akses || 'kasir')
    }
    
    return result
  })
  ipcMain.handle('auth:login', (_e, username: string, password: string, deviceInfo?: any) => (
    invokeRendererChannel('auth:login', [username, password, deviceInfo], authLogin)
  ))

  const authLoginPin = registerChannel('auth:loginPin', async (username: string, pin: string, deviceInfo?: any) => {
    const result = await AuthController.loginWithPin(username, pin, deviceInfo)
    if (result.success && result.data) {
      const userData = result.data as { nama_pengguna: string; hak_akses: string }
      demoSession.setSession(userData.nama_pengguna, userData.hak_akses || 'kasir')
    }
    return result
  })
  ipcMain.handle('auth:loginPin', (_e, username: string, pin: string, deviceInfo?: any) => (
    invokeRendererChannel('auth:loginPin', [username, pin, deviceInfo], authLoginPin)
  ))

  const authChangePassword = registerChannel('auth:changePassword', (username: string, oldPass: string, newPass: string, deviceInfo?: any) => (
    AuthController.changePassword(username, oldPass, newPass, deviceInfo)
  ))
  ipcMain.handle('auth:changePassword', (_e, username: string, oldPass: string, newPass: string, deviceInfo?: any) => (
    invokeRendererChannel('auth:changePassword', [username, oldPass, newPass, deviceInfo], authChangePassword)
  ))
  
  const authCheckIdentitas = registerChannel('auth:checkIdentitas', () => AuthController.checkIdentitas())
  ipcMain.handle('auth:checkIdentitas', () => invokeRendererChannel('auth:checkIdentitas', [], authCheckIdentitas))

  const authRestoreSession = registerChannel('auth:restoreSession', async (input: any) => {
    const result = await AuthController.restoreSession(input)
    if (result.success && result.data) {
      const userData = result.data as { nama_pengguna: string; hak_akses: string }
      demoSession.setSession(userData.nama_pengguna, userData.hak_akses || 'kasir')
    }
    return result
  })
  ipcMain.handle('auth:restoreSession', (_e, input: any) => invokeRendererChannel('auth:restoreSession', [input], authRestoreSession))
  
  // Auth logout — clear the session
  const authLogout = registerChannel('auth:logout', (payload: { username?: string; sessionToken?: string; deviceInfo?: any } | string) => {
    if (typeof payload === 'string') {
      AuthController.logout(payload)
    } else {
      AuthController.logout(payload?.username ?? 'unknown', payload?.sessionToken, payload?.deviceInfo)
    }
    demoSession.clearSession()
    return { success: true, message: 'Logged out' }
  })
  ipcMain.handle('auth:logout', (_e, payload: { username?: string; sessionToken?: string; deviceInfo?: any } | string) => (
    invokeRendererChannel('auth:logout', [payload], authLogout)
  ))

  // ─── DEMO STATUS (always allowed) ──────────────────────────────────
  const demoGetStatus = registerChannel('demo:getStatus', () => {
    return {
      success: true,
      data: {
        isDemo: demoSession.isDemoMode(),
        username: demoSession.getUsername(),
        role: demoSession.getRole(),
        violationCount: demoSession.getViolationCount(),
      },
    }
  })
  ipcMain.handle('demo:getStatus', () => demoGetStatus())

  const demoGetViolationLog = registerChannel('demo:getViolationLog', () => {
    return {
      success: true,
      data: demoSession.getViolationLog(),
    }
  })
  ipcMain.handle('demo:getViolationLog', () => demoGetViolationLog())

  // ─── SYNC SERVER ──────────────────────────────────────────────────
  handle(ipcMain, 'sync:getStatus', () => ({
    success: true,
    data: {
      mode: 'desktop',
      ...SyncServerService.getStatus(),
      client: SyncClientService.getStatus(),
    },
  }))
  handle(ipcMain, 'sync:saveConfig', (config: { enabled?: boolean; port?: number; token?: string }) => {
    if (config.enabled) {
      SyncClientService.saveConfig({ enabled: false })
    }
    return {
      success: true,
      data: {
        mode: 'desktop',
        ...SyncServerService.saveConfig(config),
        client: SyncClientService.getStatus(),
      },
      message: 'Pengaturan sinkronisasi disimpan',
    }
  })
  handle(ipcMain, 'sync:saveClientConfig', (config: { enabled?: boolean; baseUrl?: string; token?: string; deviceName?: string }) => {
    const result = SyncClientService.saveConfig(config)
    if (result.success && result.data.enabled) {
      SyncServerService.saveConfig({ enabled: false })
    }
    return {
      ...result,
      data: {
        mode: 'desktop',
        ...SyncServerService.getStatus(),
        client: SyncClientService.getStatus(),
      },
    }
  })
  handle(ipcMain, 'sync:testConnection', () => {
    const status = SyncServerService.getStatus()
    return {
      success: status.running,
      data: status,
      message: status.running
        ? 'Server sinkronisasi desktop aktif'
        : 'Server sinkronisasi desktop belum aktif',
    }
  })
  handle(ipcMain, 'sync:testClientConnection', (config?: { baseUrl?: string; token?: string; deviceName?: string }) => (
    SyncClientService.testConnection(config)
  ))
  handle(ipcMain, 'sync:rotateToken', () => ({
    success: true,
    data: {
      mode: 'desktop',
      ...SyncServerService.rotateToken(),
      client: SyncClientService.getStatus(),
    },
    message: 'Token sinkronisasi diganti',
  }))

  // ─── BARANG (Products) ─────────────────────────────────────────────
  handle(ipcMain, 'barang:getAll', () => BarangController.getAll())
  handle(ipcMain, 'barang:getPaginated', (params?: PaginationParams) => BarangController.getPaginated(params))
  handle(ipcMain, 'barang:search', (q: string) => BarangController.search(sanitizeString(q, 100)))
  handle(ipcMain, 'barang:create', (data: any) => {
    if (!data?.kd_barang || !data?.nama_barang) {
      return { success: false, message: 'Kode barang dan nama barang wajib diisi' }
    }
    return BarangController.create({
      ...data,
      kd_barang: sanitizeString(data.kd_barang, 50),
      nama_barang: sanitizeString(data.nama_barang, 200),
      nama_pengguna: demoSession.getUsername() ?? data?.nama_pengguna,
    })
  })
  handle(ipcMain, 'barang:update', (kd: string, data: any) => {
    if (!kd) return { success: false, message: 'Kode barang tidak valid' }
    return BarangController.update(sanitizeString(kd, 50), data)
  })
  handle(ipcMain, 'barang:delete', (kd: string) => {
    if (!kd) return { success: false, message: 'Kode barang tidak valid' }
    return BarangController.delete(sanitizeString(kd, 50))
  })
  handle(ipcMain, 'barang:bulkImport', (products: any[], username?: string) => (
    BarangController.bulkImport(products, demoSession.getUsername() ?? username)
  ))

  // ─── KATEGORI ──────────────────────────────────────────────────────
  handle(ipcMain, 'kategori:getAll', () => KategoriController.getAll())
  handle(ipcMain, 'kategori:create', (data: any) => KategoriController.create(data))
  handle(ipcMain, 'kategori:update', (id: number, data: any) => KategoriController.update(id, data))
  handle(ipcMain, 'kategori:delete', (id: number) => KategoriController.delete(id))

  // ─── SATUAN ────────────────────────────────────────────────────────
  handle(ipcMain, 'satuan:getAll', () => SatuanController.getAll())
  handle(ipcMain, 'satuan:create', (data: any) => SatuanController.create(data))
  handle(ipcMain, 'satuan:update', (kd: number, data: any) => SatuanController.update(kd, data))
  handle(ipcMain, 'satuan:delete', (kd: number) => SatuanController.delete(kd))

  // ─── PENJUALAN (Transactions) ──────────────────────────────────────
  handle(ipcMain, 'penjualan:getAll', () => PenjualanController.getAll())
  handle(ipcMain, 'penjualan:getDetail', (kd: string) => PenjualanController.getDetail(kd))
  handle(ipcMain, 'penjualan:create', (data: any) => PenjualanController.create({
    ...data,
    username: demoSession.getUsername() ?? data?.username,
  }))

  // ─── DASHBOARD ─────────────────────────────────────────────────────
  handle(ipcMain, 'dashboard:getSummary', () => DashboardController.getSummary())
  handle(ipcMain, 'ownerDashboard:getInsights', () => OwnerDashboardController.getInsights())

  // ─── AI ASSISTANT ──────────────────────────────────────────────────
  handle(ipcMain, 'assistant:ask', (data: any) => AssistantController.ask(data))

  // ─── IDENTITAS TOKO ────────────────────────────────────────────────
  handle(ipcMain, 'identitas:get', () => IdentitasController.get())
  handle(ipcMain, 'identitas:save', (data: any) => IdentitasController.save(data))

  // ─── SUPPLIER ──────────────────────────────────────────────────────
  handle(ipcMain, 'supplier:getAll', () => SupplierController.getAll())
  handle(ipcMain, 'supplier:getById', (kd: string) => SupplierController.getById(sanitizeString(kd, 50)))
  handle(ipcMain, 'supplier:create', (data: any) => {
    if (!data?.kd_suplier || !data?.nama_suplier) {
      return { success: false, message: 'Kode supplier dan nama supplier wajib diisi' }
    }
    return SupplierController.create({
      ...data,
      kd_suplier: sanitizeString(data.kd_suplier, 50),
      nama_suplier: sanitizeString(data.nama_suplier, 200),
    })
  })
  handle(ipcMain, 'supplier:update', (kd: string, data: any) => {
    if (!kd) return { success: false, message: 'Kode supplier tidak valid' }
    return SupplierController.update(sanitizeString(kd, 50), data)
  })
  handle(ipcMain, 'supplier:delete', (kd: string) => {
    if (!kd) return { success: false, message: 'Kode supplier tidak valid' }
    return SupplierController.delete(sanitizeString(kd, 50))
  })

  // ─── USER MANAGEMENT ──────────────────────────────────────────────
  handle(ipcMain, 'user:getAll', () => UserController.getAll())
  handle(ipcMain, 'user:create', (data: any) => {
    const plainPassword = data?.kata_sandi || data?.password
    if (!data?.nama_pengguna || !plainPassword) {
      return { success: false, message: 'Username dan password wajib diisi' }
    }
    if (String(plainPassword).length < 6) {
      return { success: false, message: 'Password minimal 6 karakter' }
    }
    return UserController.create({
      ...data,
      kata_sandi: plainPassword,
      password: plainPassword,
      nama_pengguna: sanitizeString(data.nama_pengguna, 50),
      _caller: demoSession.getUsername() ?? data?._caller,
    })
  })
  handle(ipcMain, 'user:update', (username: string, data: any) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.update(sanitizeString(username, 50), {
      ...data,
      _caller: demoSession.getUsername() ?? data?._caller,
    })
  })
  handle(ipcMain, 'user:changePassword', (username: string, oldPass: string, newPass: string) => {
    if (!username || !oldPass || !newPass) {
      return { success: false, message: 'Semua field wajib diisi' }
    }
    if (newPass.length < 6) {
      return { success: false, message: 'Password baru minimal 6 karakter' }
    }
    return UserController.changePassword(sanitizeString(username, 50), oldPass, newPass)
  })
  handle(ipcMain, 'user:resetPassword', (username: string, newPass: string, caller?: string) => {
    if (!username || !newPass) {
      return { success: false, message: 'Username dan password baru wajib diisi' }
    }
    if (newPass.length < 6) {
      return { success: false, message: 'Password baru minimal 6 karakter' }
    }
    return UserController.resetPassword(sanitizeString(username, 50), newPass, demoSession.getUsername() ?? caller)
  })
  handle(ipcMain, 'user:delete', (username: string, caller?: string) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.delete(sanitizeString(username, 50), demoSession.getUsername() ?? caller)
  })
  handle(ipcMain, 'user:toggleStatus', (username: string, caller?: string) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.toggleStatus(sanitizeString(username, 50), demoSession.getUsername() ?? caller)
  })
  handle(ipcMain, 'user:block', (username: string, blocked: boolean, caller?: string) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.block(sanitizeString(username, 50), blocked, demoSession.getUsername() ?? caller)
  })
  handle(ipcMain, 'user:extendAccess', (username: string, days: number, caller?: string) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    const validDays = validateNumber(days, { min: 1, max: 3650 })
    if (validDays === null || validDays <= 0) return { success: false, message: 'Durasi harus berupa angka positif (1-3650 hari)' }
    return UserController.extendAccess(sanitizeString(username, 50), validDays, demoSession.getUsername() ?? caller)
  })
  handle(ipcMain, 'user:getPermissions', (username: string) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.getPermissions(sanitizeString(username, 50))
  })
  handle(ipcMain, 'user:savePermissions', (username: string, permissions: Record<string, boolean>) => {
    if (!username) return { success: false, message: 'Username tidak valid' }
    return UserController.savePermissions(sanitizeString(username, 50), permissions)
  })

  // ─── CUSTOMER ──────────────────────────────────────────────────────
  handle(ipcMain, 'customer:getAll', () => CustomerController.getAll())
  handle(ipcMain, 'customer:getById', (kd: string) => CustomerController.getById(sanitizeString(kd, 50)))
  handle(ipcMain, 'customer:search', (query: string) => CustomerController.search(sanitizeString(query, 100)))
  handle(ipcMain, 'customer:create', (data: any) => {
    if (!data?.kd_customer || !data?.nama_customer) {
      return { success: false, message: 'Kode customer dan nama customer wajib diisi' }
    }
    return CustomerController.create({
      ...data,
      kd_customer: sanitizeString(data.kd_customer, 50),
      nama_customer: sanitizeString(data.nama_customer, 200),
    })
  })
  handle(ipcMain, 'customer:update', (kd: string, data: any) => {
    if (!kd) return { success: false, message: 'Kode customer tidak valid' }
    return CustomerController.update(sanitizeString(kd, 50), data)
  })
  handle(ipcMain, 'customer:delete', (kd: string) => {
    if (!kd) return { success: false, message: 'Kode customer tidak valid' }
    return CustomerController.delete(sanitizeString(kd, 50))
  })
  handle(ipcMain, 'customer:toggleStatus', (kd: string) => {
    if (!kd) return { success: false, message: 'Kode customer tidak valid' }
    return CustomerController.toggleStatus(sanitizeString(kd, 50))
  })
  handle(ipcMain, 'customer:addPoin', (kd: string, poin: number) => {
    if (!kd) return { success: false, message: 'Kode customer tidak valid' }
    const validPoin = validateNumber(poin, { min: 0, max: 999999999 })
    if (validPoin === null || validPoin <= 0) return { success: false, message: 'Poin harus berupa angka positif' }
    return CustomerController.addPoin(sanitizeString(kd, 50), validPoin)
  })
  handle(ipcMain, 'customer:getBirthdayToday', () => CustomerController.getBirthdayToday())
  handle(ipcMain, 'customer:getRiwayatPembelian', (kd: string) => {
    if (!kd) return { success: false, message: 'Kode customer tidak valid' }
    return CustomerController.getRiwayatPembelian(sanitizeString(kd, 50))
  })

  // ─── NOTIFIKASI ────────────────────────────────────────────────────
  handle(ipcMain, 'notifikasi:getAll', (username?: string) => NotifikasiController.getAll(username))
  handle(ipcMain, 'notifikasi:getUnread', (username?: string) => NotifikasiController.getUnread(username))
  handle(ipcMain, 'notifikasi:getUnreadCount', (username?: string) => NotifikasiController.getUnreadCount(username))
  handle(ipcMain, 'notifikasi:create', (data: any) => NotifikasiController.create(data))
  handle(ipcMain, 'notifikasi:markAsRead', (kd: number) => NotifikasiController.markAsRead(kd))
  handle(ipcMain, 'notifikasi:markAllAsRead', (username?: string) => NotifikasiController.markAllAsRead(username))
  handle(ipcMain, 'notifikasi:delete', (kd: number) => NotifikasiController.delete(kd))
  handle(ipcMain, 'notifikasi:deleteAll', (username?: string) => NotifikasiController.deleteAll(username))
  handle(ipcMain, 'notifikasi:checkStokMinimum', () => NotifikasiController.checkStokMinimum())
  handle(ipcMain, 'notifikasi:checkExpiredProducts', () => NotifikasiController.checkExpiredProducts())

  // ─── KAS (Cash Drawer) ────────────────────────────────────────────
  handle(ipcMain, 'kas:getActiveKas', (username: string) => KasController.getActiveKas(username))
  handle(ipcMain, 'kas:getAllKas', () => KasController.getAllKas())
  handle(ipcMain, 'kas:getKasById', (kd: string) => KasController.getKasById(kd))
  handle(ipcMain, 'kas:bukaKas', (username: string, modal: number, catatan?: string) => 
    KasController.bukaKas(username, modal, catatan))
  handle(ipcMain, 'kas:tutupKas', (kd: string, saldo: number, catatan?: string) => 
    KasController.tutupKas(kd, saldo, catatan))
  handle(ipcMain, 'kas:getTransaksi', (kd: string) => KasController.getTransaksiByKas(kd))
  handle(ipcMain, 'kas:addPengeluaran', (kd: string, jumlah: number, keterangan: string, username: string) => 
    KasController.addPengeluaran(kd, jumlah, keterangan, username))
  handle(ipcMain, 'kas:addPemasukan', (kd: string, jumlah: number, keterangan: string, username: string) => 
    KasController.addPemasukan(kd, jumlah, keterangan, username))
  handle(ipcMain, 'kas:deleteTransaksi', (kd: number) => KasController.deleteTransaksi(kd))
  handle(ipcMain, 'kas:deleteKas', (kd_kas: string) => KasController.deleteKas(kd_kas))
  handle(ipcMain, 'kas:getLaporan', (startDate: string, endDate: string) => 
    KasController.getLaporanKas(startDate, endDate))

  // ─── PEMBELIAN (Purchases) ─────────────────────────────────────────
  handle(ipcMain, 'pembelian:getAll', () => PembelianController.getAll())
  handle(ipcMain, 'pembelian:getById', (kd: string) => PembelianController.getById(kd))
  handle(ipcMain, 'pembelian:create', (data: any) => PembelianController.create(data))
  handle(ipcMain, 'pembelian:updateStatus', (kd: string, bayar: number) => 
    PembelianController.updateStatus(kd, bayar))
  handle(ipcMain, 'pembelian:delete', (kd: string) => PembelianController.delete(kd))
  handle(ipcMain, 'pembelian:getLaporan', (startDate: string, endDate: string) => 
    PembelianController.getLaporanPembelian(startDate, endDate))

  // ─── BACKUP & RESTORE ─────────────────────────────────────────────
  handle(ipcMain, 'backup:getAll', () => BackupController.getAll())
  handle(ipcMain, 'backup:create', (username: string, keterangan?: string) => 
    BackupController.create(username, keterangan))
  handle(ipcMain, 'backup:restore', (kd: number) => BackupController.restore(kd))
  handle(ipcMain, 'backup:delete', (kd: number) => BackupController.delete(kd))
  handle(ipcMain, 'backup:download', (kd: number) => BackupController.download(kd))
  handle(ipcMain, 'backup:import', (base64Data: string, fileName: string) => BackupController.import(base64Data, fileName))

  // ─── LAPORAN (Reports) ─────────────────────────────────────────────
  handle(ipcMain, 'laporan:penjualan', (startDate: string, endDate: string) => 
    LaporanController.getLaporanPenjualan(startDate, endDate))
  handle(ipcMain, 'laporan:labaRugi', (startDate: string, endDate: string) => 
    LaporanController.getLaporanLabaRugi(startDate, endDate))
  handle(ipcMain, 'laporan:produkTerlaris', (startDate: string, endDate: string, limit?: number) => 
    LaporanController.getLaporanProdukTerlaris(startDate, endDate, limit))
  handle(ipcMain, 'laporan:stok', () => LaporanController.getLaporanStok())
  handle(ipcMain, 'laporan:kas', (startDate: string, endDate: string) => 
    LaporanController.getLaporanKas(startDate, endDate))
  handle(ipcMain, 'laporan:customer', () => LaporanController.getLaporanCustomer())

  // ─── ACTIVITY LOG ──────────────────────────────────────────────────
  handle(ipcMain, 'activityLog:getAll', () => ActivityLogController.getAll())
  handle(ipcMain, 'activityLog:getByUsername', (username: string) => 
    ActivityLogController.getByUsername(username))
  handle(ipcMain, 'activityLog:getByModul', (modul: string) => 
    ActivityLogController.getByModul(modul))
  handle(ipcMain, 'activityLog:search', (filters: any) => ActivityLogController.search(filters))
  handle(ipcMain, 'activityLog:log', (username: string, aktivitas: string, modul: string, detail?: string) => 
    ActivityLogController.log(username, aktivitas, modul, detail))
  handle(ipcMain, 'activityLog:delete', (kd: number) => ActivityLogController.delete(kd))
  handle(ipcMain, 'activityLog:deleteOldLogs', (days?: number) => 
    ActivityLogController.deleteOldLogs(days))

  // ─── EXPORT ────────────────────────────────────────────────────────
  handle(ipcMain, 'export:penjualanExcel', (startDate: string, endDate: string, customPath?: string) => 
    ExportController.exportPenjualanExcel(startDate, endDate, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:penjualanPDF', (startDate: string, endDate: string, customPath?: string) => 
    ExportController.exportPenjualanPDF(startDate, endDate, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:stokExcel', (customPath?: string) => ExportController.exportStokExcel(consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:stokPDF', (customPath?: string) => ExportController.exportStokPDF(consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:cashFlowExcel', (data: any[], startDate: string, endDate: string, customPath?: string) =>
    ExportController.exportCashFlowExcel(data, startDate, endDate, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:priceListPDF', (products: any[], categoryName: string, customPath?: string) =>
    ExportController.exportPriceListPDF(products, categoryName, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:taxReportExcel', (data: any[], startDate: string, endDate: string, customPath?: string) =>
    ExportController.exportTaxReportExcel(data, startDate, endDate, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:toExcel', (data: any[], filename: string, sheetName?: string, customPath?: string) => 
    ExportController.exportToExcel(data, filename, sheetName, consumeApprovedSavePath(customPath)))
  handle(ipcMain, 'export:toPDF', (title: string, headers: string[], data: any[][], filename: string, orientation?: 'portrait' | 'landscape', customPath?: string) => 
    ExportController.exportToPDF(title, headers, data, filename, orientation, consumeApprovedSavePath(customPath)))

  // ─── INDUSTRY INTEGRATIONS ─────────────────────────────────────────
  handle(ipcMain, 'integrations:get', () => IndustrySettingsController.get())
  handle(ipcMain, 'integrations:save', (data: any) => IndustrySettingsController.save(data))
  handle(ipcMain, 'integrations:testAi', (data?: any) => AssistantController.test(data))
  handle(ipcMain, 'integrations:listAiModels', (data?: any) => AssistantController.listModels(data))
  handle(ipcMain, 'integrations:testGoogleSheets', () => IndustrySettingsController.testGoogleSheets())
  handle(ipcMain, 'integrations:exportDashboardToSheets', (summary: any) => IndustrySettingsController.exportDashboardToSheets(summary))

  // ─── SCHEDULER ─────────────────────────────────────────────────────
  handle(ipcMain, 'scheduler:runStokCheck', () => SchedulerService.runStokCheck())
  handle(ipcMain, 'scheduler:runExpiredCheck', () => SchedulerService.runExpiredCheck())
  handle(ipcMain, 'scheduler:runDebtCheck', () => SchedulerService.runDebtCheck())
  handle(ipcMain, 'scheduler:runBackup', (username: string) => SchedulerService.runBackup(username))
  handle(ipcMain, 'scheduler:runCleanLogs', (days?: number) => SchedulerService.runCleanLogs(days))

  // ─── BARCODE ───────────────────────────────────────────────────────
  handle(ipcMain, 'barcode:generate', () => BarcodeController.generateBarcode())
  handle(ipcMain, 'barcode:search', (barcode: string) => BarcodeController.searchByBarcode(barcode))
  handle(ipcMain, 'barcode:getSettings', () => BarcodeController.getSettings())
  handle(ipcMain, 'barcode:updateSettings', (data: any) => BarcodeController.updateSettings(data))

  // ─── PAYMENT METHODS ──────────────────────────────────────────────
  handle(ipcMain, 'payment:getAll', () => PaymentMethodController.getAll())
  handle(ipcMain, 'payment:create', (data: any) => PaymentMethodController.create(data))
  handle(ipcMain, 'payment:update', (id: number, data: any) => PaymentMethodController.update(id, data))
  handle(ipcMain, 'payment:delete', (id: number) => PaymentMethodController.delete(id))
  handle(ipcMain, 'payment:createQris', (data: any) => PaymentMethodController.createQris(data))
  handle(ipcMain, 'payment:checkStatus', (orderId: string) => PaymentMethodController.checkStatus(orderId))
  handle(ipcMain, 'payment:cancelQris', (orderId: string) => PaymentMethodController.cancelQris(orderId))
  handle(ipcMain, 'payment:getGatewaySettings', () => PaymentMethodController.getGatewaySettings())
  handle(ipcMain, 'payment:saveGatewaySettings', (data: any) => PaymentMethodController.saveGatewaySettings(data))
  handle(ipcMain, 'payment:getQrisSessions', (limit?: number) => PaymentMethodController.getQrisSessions(limit))
  handle(ipcMain, 'payment:markQrisPaid', (orderId: string) => PaymentMethodController.markQrisPaid(orderId))

  // ─── ACCOUNTING ────────────────────────────────────────────────────
  handle(ipcMain, 'accounting:getSummary', (startDate?: string, endDate?: string) => AccountingController.getSummary(startDate, endDate))
  handle(ipcMain, 'accounting:getAccounts', () => AccountingController.getAccounts())
  handle(ipcMain, 'accounting:saveAccount', (data: any) => AccountingController.saveAccount(data))
  handle(ipcMain, 'accounting:deleteAccount', (id: number) => AccountingController.deleteAccount(id))
  handle(ipcMain, 'accounting:getJournalEntries', (limit?: number) => AccountingController.getJournalEntries(limit))
  handle(ipcMain, 'accounting:createJournalEntry', (data: any) => AccountingController.createJournalEntry({
    ...data,
    created_by: demoSession.getUsername() ?? data?.created_by,
  }))
  handle(ipcMain, 'accounting:getTrialBalance', (startDate?: string, endDate?: string) => AccountingController.getTrialBalance(startDate, endDate))

  // ─── TAX ───────────────────────────────────────────────────────────
  handle(ipcMain, 'tax:getActive', () => TaxController.getActive())
  handle(ipcMain, 'tax:getActiveRate', () => ({ success: true, data: { rate: TaxController.getActiveRate() } }))
  handle(ipcMain, 'tax:setActiveRate', (rate: number) => TaxController.setActiveRate(rate))
  handle(ipcMain, 'tax:getAll', () => TaxController.getAll())
  handle(ipcMain, 'tax:setActive', (id: number) => TaxController.setActive(id))
  handle(ipcMain, 'tax:create', (data: any) => TaxController.create(data))
  handle(ipcMain, 'tax:update', (id: number, data: any) => TaxController.update(id, data))
  handle(ipcMain, 'tax:delete', (id: number) => TaxController.delete(id))

  // ─── RETURNS ───────────────────────────────────────────────────────
  handle(ipcMain, 'return:create', (data: any) => ReturnController.create(data))
  handle(ipcMain, 'return:getAll', () => ReturnController.getAll())
  handle(ipcMain, 'return:getDetails', (id: number) => ReturnController.getDetails(id))
  handle(ipcMain, 'return:approve', (id: number, userId: string | number) => ReturnController.approve(id, userId))
  handle(ipcMain, 'return:reject', (id: number, userId: string | number) => ReturnController.reject(id, userId))
  handle(ipcMain, 'return:delete', (id: number) => ReturnController.delete(id))

  // ─── SHIFTS ────────────────────────────────────────────────────────
  handle(ipcMain, 'shift:open', (data: any) => ShiftController.open(data))
  handle(ipcMain, 'shift:close', (id: number, data: any) => ShiftController.close(id, data))
  handle(ipcMain, 'shift:getCurrent', (userId: string | number) => ShiftController.getCurrent(userId))
  handle(ipcMain, 'shift:getAll', () => ShiftController.getAll())
  handle(ipcMain, 'shift:delete', (id: number) => ShiftController.delete(id))

  // ─── DEBTS ─────────────────────────────────────────────────────────
  handle(ipcMain, 'debt:create', (data: any) => DebtController.create(data))
  handle(ipcMain, 'debt:addPayment', (debtId: number, data: any) => DebtController.addPayment(debtId, data))
  handle(ipcMain, 'debt:getAll', (type?: string) => DebtController.getAll(type))
  handle(ipcMain, 'debt:getPayments', (debtId: number) => DebtController.getPayments(debtId))
  handle(ipcMain, 'debt:delete', (id: number) => DebtController.delete(id))

  // ─── STOCK OPNAME ──────────────────────────────────────────────────
  handle(ipcMain, 'opname:create', (data: any) => StockOpnameController.create(data))
  handle(ipcMain, 'opname:approve', (id: number, userId: number) => StockOpnameController.approve(id, userId))
  handle(ipcMain, 'opname:getAll', () => StockOpnameController.getAll())
  handle(ipcMain, 'opname:getDetails', (id: number) => StockOpnameController.getDetails(id))
  handle(ipcMain, 'opname:delete', (id: number) => StockOpnameController.delete(id))
  handle(ipcMain, 'opname:addItem', (data: any) => StockOpnameController.addItem(data))
  handle(ipcMain, 'opname:getItems', (opnameId: number) => StockOpnameController.getItems(opnameId))

  // ─── PRODUCT IMAGES ────────────────────────────────────────────────
  handle(ipcMain, 'productImage:add', (barangId: number, imagePath: string, isPrimary: boolean) => ProductImageController.add(barangId, imagePath, isPrimary))
  handle(ipcMain, 'productImage:getByProduct', (barangId: number) => ProductImageController.getByProduct(barangId))
  handle(ipcMain, 'productImage:delete', (id: number) => ProductImageController.delete(id))
  handle(ipcMain, 'productImage:setPrimary', (id: number, barangId: number) => ProductImageController.setPrimary(id, barangId))

  // ─── UPDATES ───────────────────────────────────────────────────────
  handle(ipcMain, 'update:check', () => UpdateService.checkForUpdates())
  handle(ipcMain, 'update:getHistory', () => UpdateService.getUpdateHistory())

  // ─── ERROR LOGGING ─────────────────────────────────────────────────
  handle(ipcMain, 'errorLog:log', (errorType: string, errorMessage: string, stackTrace?: string, userId?: string, context?: string) => ErrorLogService.log(errorType, errorMessage, stackTrace, userId, context))
  handle(ipcMain, 'errorLog:getAll', (limit?: number) => ErrorLogService.getAll(limit))
  handle(ipcMain, 'errorLog:deleteOld', (days?: number) => ErrorLogService.deleteOld(days))
  handle(ipcMain, 'errorLog:clear', () => ErrorLogService.clear())

  // ─── SUBSCRIPTION PLANS ─────────────────────────────────────────────
  handle(ipcMain, 'plan:getAll', () => PlanController.getAll())
  handle(ipcMain, 'plan:getActive', () => PlanController.getActive())
  handle(ipcMain, 'plan:create', (data: any) => PlanController.create(data, demoSession.getUsername()))
  handle(ipcMain, 'plan:update', (id: number, data: any) => PlanController.update(id, data, demoSession.getUsername()))
  handle(ipcMain, 'plan:deactivate', (id: number) => PlanController.deactivate(id, demoSession.getUsername()))
  handle(ipcMain, 'plan:delete', (id: number) => PlanController.delete(id, demoSession.getUsername()))

  // ─── TUTORIALS ─────────────────────────────────────────────────────
  handle(ipcMain, 'tutorial:getAll', () => TutorialController.getAll())
  handle(ipcMain, 'tutorial:getById', (id: number) => TutorialController.getById(id))
  handle(ipcMain, 'tutorial:create', (data: any) => TutorialController.create(data))
  handle(ipcMain, 'tutorial:update', (id: number, data: any) => TutorialController.update(id, data))
  handle(ipcMain, 'tutorial:delete', (id: number) => TutorialController.delete(id))

  // ─── HPP CALCULATOR ────────────────────────────────────────────────
  // Note: hpp:calculate has its own demo-limit logic inside the controller.
  // It is intentionally NOT in MUTATION_CHANNELS so demo users can use it up to 10 times.
  handle(ipcMain, 'hpp:calculate', (data: any) => HppController.calculate(data))
  handle(ipcMain, 'hpp:getHistory', (username: string) => HppController.getHistory(username))
  handle(ipcMain, 'hpp:getUsageCount', (username: string) => HppController.getUsageCount(username))
  handle(ipcMain, 'hpp:delete', (id: number, username: string) => HppController.delete(id, username))

  // ─── STRUK SETTINGS ────────────────────────────────────────────────
  handle(ipcMain, 'strukSettings:get', () => StrukSettingsController.get())
  handle(ipcMain, 'strukSettings:update', (data: any) => StrukSettingsController.update(data))
  handle(ipcMain, 'strukSettings:uploadQris', (base64: string) => StrukSettingsController.uploadQris(base64))
  handle(ipcMain, 'strukSettings:removeQris', () => StrukSettingsController.removeQris())

  // ─── CURRENCY ──────────────────────────────────────────────────────
  handle(ipcMain, 'currency:getAll', () => CurrencyController.getAll())
  handle(ipcMain, 'currency:getActive', () => CurrencyController.getActive())
  handle(ipcMain, 'currency:create', (data: any) => CurrencyController.create(data))
  handle(ipcMain, 'currency:update', (id: number, data: any) => CurrencyController.update(id, data))
  handle(ipcMain, 'currency:delete', (id: number) => CurrencyController.delete(id))
  handle(ipcMain, 'currency:setDefault', (id: number) => CurrencyController.setDefault(id))

  // ─── INVENTORY ─────────────────────────────────────────────────────
  handle(ipcMain, 'warehouse:getAll', () => InventoryController.getWarehouses())
  handle(ipcMain, 'warehouse:create', (data: any) => InventoryController.createWarehouse(data))
  handle(ipcMain, 'warehouse:update', (id: number, data: any) => InventoryController.updateWarehouse(id, data))
  handle(ipcMain, 'warehouse:delete', (id: number) => InventoryController.deleteWarehouse(id))
  handle(ipcMain, 'inventory:getBatches', (kd: string) => InventoryController.getBatches(kd))
  handle(ipcMain, 'inventory:addBatch', (data: any) => InventoryController.addBatch(data))
  handle(ipcMain, 'inventory:updateBatch', (id: number, data: any) => InventoryController.updateBatch(id, data))
  handle(ipcMain, 'inventory:deleteBatch', (id: number) => InventoryController.deleteBatch(id))
  handle(ipcMain, 'inventory:getSerials', (kd: string) => InventoryController.getSerials(kd))
  handle(ipcMain, 'inventory:addSerial', (data: any) => InventoryController.addSerial(data))
  handle(ipcMain, 'inventory:updateSerial', (id: number, data: any) => InventoryController.updateSerial(id, data))
  handle(ipcMain, 'inventory:deleteSerial', (id: number) => InventoryController.deleteSerial(id))
  handle(ipcMain, 'inventory:transfer', (data: any) => InventoryController.transfer(data))
  handle(ipcMain, 'inventory:getWarehouseStock', (warehouseId?: number) => InventoryController.getWarehouseStock(warehouseId))
  handle(ipcMain, 'inventory:getTransfers', (limit?: number) => InventoryController.getTransfers(limit))

  // ─── PROMO ─────────────────────────────────────────────────────────
  handle(ipcMain, 'promo:getAll', () => PromoController.getAll())
  handle(ipcMain, 'promo:getActive', () => PromoController.getActive())
  handle(ipcMain, 'promo:create', (data: any) => PromoController.create(data))
  handle(ipcMain, 'promo:update', (id: number, data: any) => PromoController.update(id, data))
  handle(ipcMain, 'promo:delete', (id: number) => PromoController.delete(id))
  handle(ipcMain, 'promo:validate', (code: string, subtotal: number, items: any[]) => PromoController.validate(code, subtotal, items))
  handle(ipcMain, 'promo:apply', (code: string) => PromoService.applyPromo(code))

  // ─── BRANCH / MULTI-OUTLET ────────────────────────────────────────────
  handle(ipcMain, 'branch:getAll', () => BranchController.getAll())
  handle(ipcMain, 'branch:getActive', () => BranchController.getActive())
  handle(ipcMain, 'branch:getWarehouses', () => BranchController.getWarehouses())
  handle(ipcMain, 'branch:getById', (id: number) => BranchController.getById(id))
  handle(ipcMain, 'branch:getStockSummary', (branchId?: number) => BranchController.getStockSummary(branchId))
  handle(ipcMain, 'branch:getTransferHistory', (limit?: number) => BranchController.getTransferHistory(limit))
  handle(ipcMain, 'branch:create', (data: any) => BranchController.create(data))
  handle(ipcMain, 'branch:update', (id: number, data: any) => BranchController.update(id, data))
  handle(ipcMain, 'branch:delete', (id: number) => BranchController.delete(id))
  handle(ipcMain, 'branch:transferStock', (fromId: number, toId: number, productId: string, qty: number, notes: string, userId: string) => 
    BranchController.transferStock(fromId, toId, productId, qty, notes, userId))

  // ─── FEATURE HUB / EXTENDED OPERATIONS ────────────────────────────
  handle(ipcMain, 'dailyNotes:getAll', (filterDate?: string, search?: string) => FeatureHubController.getDailyNotes(filterDate, search))
  handle(ipcMain, 'dailyNotes:create', (data: any) => FeatureHubController.createDailyNote(data))
  handle(ipcMain, 'dailyNotes:update', (id: number, data: any) => FeatureHubController.updateDailyNote(id, data))
  handle(ipcMain, 'dailyNotes:delete', (id: number) => FeatureHubController.deleteDailyNote(id))

  handle(ipcMain, 'pettyCash:getAll', (startDate?: string, endDate?: string, search?: string) => FeatureHubController.getPettyCash(startDate, endDate, search))
  handle(ipcMain, 'pettyCash:create', (data: any) => FeatureHubController.createPettyCash(data))
  handle(ipcMain, 'pettyCash:delete', (id: number) => FeatureHubController.deletePettyCash(id))

  handle(ipcMain, 'notifSettings:get', () => FeatureHubController.getNotificationSettings())
  handle(ipcMain, 'notifSettings:save', (data: any) => FeatureHubController.saveNotificationSettings(data))

  handle(ipcMain, 'priceList:get', (kdKategori?: number, search?: string) => FeatureHubController.getPriceList(kdKategori, search))
  handle(ipcMain, 'cashFlow:getAll', (startDate?: string, endDate?: string) => FeatureHubController.getCashFlow(startDate, endDate))
  handle(ipcMain, 'taxReport:getSummary', (startDate?: string, endDate?: string) => FeatureHubController.getTaxSummary(startDate, endDate))
  handle(ipcMain, 'salesCommission:getAll', (search?: string, month?: number, year?: number, customRates?: any) => FeatureHubController.getSalesCommissions(search, month, year, customRates))
  handle(ipcMain, 'salesCommission:getStaffDetail', (username: string, month?: number, year?: number) => FeatureHubController.getStaffSalesDetail(username, month, year))
  handle(ipcMain, 'supplierRating:getAll', (search?: string) => FeatureHubController.getSupplierRatings(search))
  handle(ipcMain, 'membership:getAll', (search?: string) => FeatureHubController.getMemberships(search))
  handle(ipcMain, 'stockHistory:getAll', (search?: string, filterJenis?: string) => FeatureHubController.getStockHistory(search, filterJenis))
  handle(ipcMain, 'barang:getByKategori', (kdKategori?: number) => FeatureHubController.getProductsByCategory(kdKategori))
  handle(ipcMain, 'barang:batchUpdatePrice', (payload: any) => FeatureHubController.batchUpdatePrice(payload))
  handle(ipcMain, 'barang:getByBranch', (branchId: number) => FeatureHubController.getProductsByBranch(branchId))
  handle(ipcMain, 'stock:transfer', (payload: any) => FeatureHubController.transferStock(payload))

  // ─── LOYALTY / POINTS ───────────────────────────────────────────────
  handle(ipcMain, 'loyalty:getTiers', () => LoyaltyController.getTiers())
  handle(ipcMain, 'loyalty:getCustomerTier', (customerId: string) => LoyaltyController.getCustomerTier(customerId))
  handle(ipcMain, 'loyalty:calculatePoints', (amount: number, tierId: number) => LoyaltyController.calculatePoints(amount, tierId))
  handle(ipcMain, 'loyalty:redeemPoints', (customerId: string, points: number) => LoyaltyController.redeemPoints(customerId, points))
  handle(ipcMain, 'loyalty:createTier', (data: any) => LoyaltyController.createTier(data))
  handle(ipcMain, 'loyalty:updateTier', (id: number, data: any) => LoyaltyController.updateTier(id, data))
  handle(ipcMain, 'loyalty:deleteTier', (id: number) => LoyaltyController.deleteTier(id))

  // ─── AUDIT TRAIL ───────────────────────────────────────────────────
  handle(ipcMain, 'audit:getAll', () => AuditController.getAll())
  handle(ipcMain, 'audit:log', (data: any) => AuditController.log(data))
  handle(ipcMain, 'audit:clear', () => AuditController.clear())

  // ─── MOBILE APP SUPPORT ────────────────────────────────────────────
  handle(ipcMain, 'mobile:getSummary', (token: string) => MobileAppController.getRemoteSummary(token))
  handle(ipcMain, 'mobile:processScan', (barcode: string, username: string) => MobileAppController.processMobileScan(barcode, username))

  // ─── SYSTEM STATUS ─────────────────────────────────────────────────
  handle(ipcMain, 'system:checkDb', () => SystemController.checkDb())
  handle(ipcMain, 'system:resetData', () => SystemController.resetData())
  handle(ipcMain, 'system:seedSampleData', () => SystemController.seedSampleData())

  // ─── WHATSAPP SETTINGS ─────────────────────────────────────────────
  handle(ipcMain, 'whatsapp:get', () => WhatsAppController.get())
  handle(ipcMain, 'whatsapp:save', (data: any) => {
    const result = WhatsAppController.save(data)
    // Update local session if needed
    return result
  })
  handle(ipcMain, 'whatsapp:test', (phone: string, message?: string) => WhatsAppController.test({ phone, message }))
  handle(ipcMain, 'whatsapp:getTemplates', () => WhatsAppController.getTemplates())
  handle(ipcMain, 'whatsapp:saveTemplate', (data: any) => WhatsAppController.saveTemplate(data))
  handle(ipcMain, 'whatsapp:getBroadcastHistory', () => WhatsAppController.getBroadcastHistory())
  handle(ipcMain, 'whatsapp:saveBroadcastHistory', (data: any) => WhatsAppController.saveBroadcastHistory(data))

  // ─── SECURITY SETTINGS ─────────────────────────────────────────────
  handle(ipcMain, 'security:get', () => SecurityController.get())
  handle(ipcMain, 'security:save', (data: any) => SecurityController.save(data))
  
  // ─── ECOMMERCE API SETTINGS ────────────────────────────────────────
  handle(ipcMain, 'ecommerce:get', () => EcommerceApiController.get())
  handle(ipcMain, 'ecommerce:save', (data: any) => EcommerceApiController.save(data, demoSession.getUsername()))
  handle(ipcMain, 'ecommerce:getIntegration', () => {
    const result = EcommerceApiController.getIntegration()
    if (result.success && result.data) {
      // Ensure connectors field exists for UI parity
      return {
        ...result,
        data: {
          ...result.data,
          connectors: (result.data as any).connectors ?? {
            woocommerce: { status: 'disconnected', lastSync: null },
            tokopedia: { status: 'pending', lastSync: null },
            shopee: { status: 'pending', lastSync: null },
            tiktok: { status: 'pending', lastSync: null }
          }
        }
      }
    }
    return result
  })
  handle(ipcMain, 'ecommerce:saveIntegration', (data: any) => EcommerceApiController.saveIntegration(data, demoSession.getUsername()))
  handle(ipcMain, 'ecommerce:syncNow', () => EcommerceApiController.syncNow(demoSession.getUsername()))
  handle(ipcMain, 'ecommerce:enqueueStockUpdate', (productId: string | number, qty: number) => EcommerceApiController.enqueueStockUpdate(productId, qty))

  // ─── MARKETPLACE OMNICHANNEL ───────────────────────────────────────
  handle(ipcMain, 'marketplace:getChannels', () => MarketplaceController.getChannels())
  handle(ipcMain, 'marketplace:saveChannel', (data: any) => MarketplaceController.saveChannel(data))
  handle(ipcMain, 'marketplace:deleteChannel', (id: number) => MarketplaceController.deleteChannel(id))
  handle(ipcMain, 'marketplace:getSkuMap', (channelId?: number) => MarketplaceController.getSkuMap(channelId))
  handle(ipcMain, 'marketplace:saveSkuMap', (data: any) => MarketplaceController.saveSkuMap(data))
  handle(ipcMain, 'marketplace:runStockSync', (channelId?: number) => MarketplaceController.runStockSync(channelId))

  // ─── DEVICE TRACKING ───────────────────────────────────────────────
  handle(ipcMain, 'device:getAll', () => ({ success: true, data: DeviceController.getAllDevices() }))
  handle(ipcMain, 'device:getByUser', (username: string) => ({ success: true, data: DeviceController.getByUser(username) }))
  handle(ipcMain, 'device:revoke', (id: number, revokedBy: string) => DeviceController.revoke(id, revokedBy))
  handle(ipcMain, 'device:revokeAll', (username: string, revokedBy: string) => DeviceController.revokeAll(username, revokedBy))
  handle(ipcMain, 'device:getAllSessions', () => ({ success: true, data: DeviceController.getAllActiveSessions() }))
  handle(ipcMain, 'device:revokeSession', (id: number, revokedBy?: string) => DeviceController.revokeSession(id, revokedBy))
  handle(ipcMain, 'device:detectPlatformOS', (userAgent: string) => ({ success: true, data: detectPlatformOS(userAgent) }))

  // ─── SUBSCRIPTION / FEATURE CHECK ──────────────────────────────────
  handle(ipcMain, 'subscription:getStatus', (username: string) => ({ success: true, data: getSubscriptionStatus(username) }))
  handle(ipcMain, 'subscription:checkTransactionLimit', (username: string) => ({ success: true, data: checkTransactionLimit(username) }))
  handle(ipcMain, 'subscription:isFeatureEnabled', (username: string, featureKey: string) => ({ success: true, data: isFeatureEnabled(username, featureKey) }))
  handle(ipcMain, 'subscription:getActiveFeatures', (username: string) => ({ success: true, data: getActiveFeatures(username) }))
  handle(ipcMain, 'subscription:getPopupRule', (code: string) => ({ success: true, data: getPopupRule(code) }))
  handle(ipcMain, 'subscription:getUpgradePopup', (username: string, featureKey?: string) => ({ success: true, data: getUpgradePopup(username, featureKey) }))

  // ─── POPUP RULES ───────────────────────────────────────────────────
  handle(ipcMain, 'popup:getAll', () => ({ success: true, data: sqlite.prepare('SELECT * FROM mediasoft_popup_rules ORDER BY id').all() }))
  handle(ipcMain, 'popup:update', (id: number, data: any) => {
    const allowed = new Set(['title', 'description', 'cta_text', 'cta_url', 'whatsapp_number', 'pricing_html', 'is_active', 'trigger_on'])
    const entries = Object.entries(data ?? {}).filter(([k]) => allowed.has(k))
    if (entries.length === 0) return { success: true }
    const fields = entries.map(([k]) => `${k} = ?`).join(', ')
    const vals = [...entries.map(([, v]) => v), id]
    sqlite.prepare(`UPDATE mediasoft_popup_rules SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...vals)
    return { success: true }
  })

  // ─── LICENSE SERVER ────────────────────────────────────────────────
  handle(ipcMain, 'license:getConfig', () => LicenseController.getConfig())
  handle(ipcMain, 'license:testConnection', (url?: string) => LicenseController.testConnection(url))
  handle(ipcMain, 'license:testAndSave', (url: string, email: string, password: string) => LicenseController.testAndSave(url, email, password))
  handle(ipcMain, 'license:validateApplication', () => LicenseController.validateApplication())
  handle(ipcMain, 'license:syncFromServer', () => LicenseController.syncFromServer())
  handle(ipcMain, 'license:syncBuyerLicense', (username: string, deviceInfo?: any) => LicenseController.syncBuyerLicense(username, deviceInfo))
  handle(ipcMain, 'license:createPaymentInvoice', (data: any) => LicenseController.createPaymentInvoice(data))
  handle(ipcMain, 'license:createManualPaymentRequest', (data: any) => LicenseController.createManualPaymentRequest(data))
  handle(ipcMain, 'license:createMidtransPayment', (data: any) => LicenseController.createMidtransPayment(data))
  handle(ipcMain, 'license:checkMidtransPayment', (orderId: string, email: string, planCode: string) => LicenseController.checkAndActivateMidtransPayment(orderId, email, planCode))
  handle(ipcMain, 'license:getPaymentStatus', (externalRef: string) => LicenseController.getPaymentStatus(externalRef))
  handle(ipcMain, 'license:getPublicPlans', () => LicenseController.getPublicPlans())
  handle(ipcMain, 'license:getPublicPopup', (code: string) => LicenseController.getPublicPopup(code))
  handle(ipcMain, 'license:getUsers', (search?: string) => LicenseController.getUsers(search))
  handle(ipcMain, 'license:createUser', (data: any) => LicenseController.createUser(data))
  handle(ipcMain, 'license:updateUser', (id: string | number, data: any) => LicenseController.updateUser(id, data))
  handle(ipcMain, 'license:deleteUser', (id: string | number) => LicenseController.deleteUser(id))
  handle(ipcMain, 'license:changeUserPlan', (id: string | number, data: any) => LicenseController.changeUserPlan(id, data))
  handle(ipcMain, 'license:resetUserPassword', (id: string | number) => LicenseController.resetUserPassword(id))
  handle(ipcMain, 'license:resetPassword', (id: string | number) => LicenseController.resetUserPassword(id))
  handle(ipcMain, 'license:getPlans', () => LicenseController.getLicensePlans())
  handle(ipcMain, 'license:createPlan', (data: any) => LicenseController.createLicensePlan(data))
  handle(ipcMain, 'license:updatePlan', (id: string | number, data: any) => LicenseController.updateLicensePlan(id, data))
  handle(ipcMain, 'license:deletePlan', (id: string | number) => LicenseController.deleteLicensePlan(id))
  handle(ipcMain, 'license:getPlanFeatures', (planId: string | number) => LicenseController.getPlanFeatures(planId))
  handle(ipcMain, 'license:setPlanFeatures', (planId: string | number, data: any) => LicenseController.setPlanFeatures(planId, data))
  handle(ipcMain, 'license:getFeatures', () => LicenseController.getLicenseFeatures())
  handle(ipcMain, 'license:createFeature', (data: any) => LicenseController.createLicenseFeature(data))
  handle(ipcMain, 'license:updateFeature', (id: string | number, data: any) => LicenseController.updateLicenseFeature(id, data))
  handle(ipcMain, 'license:getPopups', () => LicenseController.getPopups())
  handle(ipcMain, 'license:updatePopup', (id: string | number, data: any) => LicenseController.updatePopup(id, data))
  handle(ipcMain, 'license:getPayments', () => LicenseController.getPayments())
  handle(ipcMain, 'license:createPayment', (data: any) => LicenseController.createPayment(data))
  handle(ipcMain, 'license:approvePayment', (id: string | number) => LicenseController.approvePayment(id))
  handle(ipcMain, 'license:deletePayment', (id: string | number) => LicenseController.deletePayment(id))
  handle(ipcMain, 'license:getStats', () => LicenseController.getStats())
  handle(ipcMain, 'license:getRevenue', () => LicenseController.getRevenue())
  handle(ipcMain, 'license:getDevices', (query?: { search?: string; status?: string; platform?: string }) => LicenseController.getDevices(query))
  handle(ipcMain, 'license:getDeviceDetail', (id: string | number) => LicenseController.getDeviceDetail(id))
  handle(ipcMain, 'license:blockDevice', (id: string | number) => LicenseController.blockDevice(id))
  handle(ipcMain, 'license:unblockDevice', (id: string | number) => LicenseController.unblockDevice(id))
  handle(ipcMain, 'license:suspendDeviceLicense', (id: string | number) => LicenseController.suspendDeviceLicense(id))
  handle(ipcMain, 'license:activateDeviceLicense', (id: string | number) => LicenseController.activateDeviceLicense(id))
  handle(ipcMain, 'license:extendDeviceLicense', (id: string | number, data: any) => LicenseController.extendDeviceLicense(id, data))
  handle(ipcMain, 'license:getAppUpdates', () => LicenseController.getAppUpdates())
  handle(ipcMain, 'license:saveAppUpdate', (data: any) => LicenseController.saveAppUpdate(data))
  handle(ipcMain, 'license:checkAppUpdate', (data: any) => LicenseController.checkAppUpdate(data))
  handle(ipcMain, 'license:getErrors', (query?: { type?: string }) => LicenseController.getErrors(query))
  handle(ipcMain, 'license:getAnnouncements', () => LicenseController.getAnnouncements())
  handle(ipcMain, 'license:createAnnouncement', (data: any) => LicenseController.createAnnouncement(data))
  handle(ipcMain, 'license:updateAnnouncement', (id: string | number, data: any) => LicenseController.updateAnnouncement(id, data))
  handle(ipcMain, 'license:deleteAnnouncement', (id: string | number) => LicenseController.deleteAnnouncement(id))
  handle(ipcMain, 'license:heartbeat', (data: any, token?: string | null) => LicenseController.heartbeat(data, token))
  handle(ipcMain, 'license:logError', (data: any) => LicenseController.logError(data))

  // ─── EMPLOYEE / HR ────────────────────────────────────────────────
  handle(ipcMain, 'employee:getAll', () => EmployeeController.getAll())
  handle(ipcMain, 'employee:getById', (id: number) => EmployeeController.getById(id))
  handle(ipcMain, 'employee:search', (query: string) => EmployeeController.search(query))
  handle(ipcMain, 'employee:create', (data: any) => EmployeeController.create(data))
  handle(ipcMain, 'employee:update', (id: number, data: any) => EmployeeController.update(id, data))
  handle(ipcMain, 'employee:delete', (id: number) => EmployeeController.delete(id))
  handle(ipcMain, 'employee:getByStatus', (status: string) => EmployeeController.getByStatus(status))
  // Contracts
  handle(ipcMain, 'contract:getByEmployee', (employeeId: number) => EmployeeController.getContracts(employeeId))
  handle(ipcMain, 'contract:getById', (id: number) => EmployeeController.getContractById(id))
  handle(ipcMain, 'contract:create', (data: any) => EmployeeController.createContract(data))
  handle(ipcMain, 'contract:update', (id: number, data: any) => EmployeeController.updateContract(id, data))
  handle(ipcMain, 'contract:terminate', (id: number, data: any) => EmployeeController.terminateContract(id, data))
  // Attendance
  handle(ipcMain, 'attendance:getAll', (date?: string) => EmployeeController.getAttendance(date || new Date().toISOString().split('T')[0]))
  handle(ipcMain, 'attendance:getByEmployee', (employeeId: number, startDate: string, endDate: string) => EmployeeController.getAttendanceByEmployee(employeeId, startDate, endDate))
  handle(ipcMain, 'attendance:clockIn', (...args: any[]) => {
    if (typeof args[0] === 'object' && args[0] !== null) {
      return EmployeeController.clockIn(args[0])
    }
    const employee_id = Number(args[0])
    const tgl = typeof args[1] === 'string' && args[1].includes('-') ? args[1] : new Date().toISOString().split('T')[0]
    const jam_masuk = typeof args[2] === 'string' && args[2].includes(':') ? args[2] : new Date().toTimeString().slice(0, 5)
    const status = typeof args[3] === 'string' ? args[3] : 'HADIR'
    const catatan = typeof args[4] === 'string' ? args[4] : ''
    return EmployeeController.clockIn({ employee_id, tgl, jam_masuk, status, catatan })
  })
  handle(ipcMain, 'attendance:clockOut', (...args: any[]) => {
    const id = Number(args[0])
    if (typeof args[1] === 'object' && args[1] !== null) {
      return EmployeeController.clockOut(id, args[1])
    }
    const jam_keluar = typeof args[1] === 'string' && args[1].includes(':') ? args[1] : new Date().toTimeString().slice(0, 5)
    const catatan = typeof args[2] === 'string' ? args[2] : ''
    return EmployeeController.clockOut(id, { jam_keluar, catatan })
  })
  handle(ipcMain, 'attendance:getSummary', (...args: any[]) => {
    let employeeId = 0
    let month = new Date().getMonth() + 1
    let year = new Date().getFullYear()
    if (typeof args[0] === 'string' && args[0].includes('-')) {
      const parts = args[0].split('-')
      year = parseInt(parts[0]) || year
      month = parseInt(parts[1]) || month
    } else if (typeof args[0] === 'number') {
      employeeId = args[0]
      if (args[1]) month = Number(args[1]) || month
      if (args[2]) year = Number(args[2]) || year
    }
    return EmployeeController.getAttendanceSummary(employeeId, month, year)
  })
  // Payroll
  handle(ipcMain, 'payroll:getAll', (month: number, year: number) => EmployeeController.getPayroll(month, year))
  handle(ipcMain, 'payroll:getByEmployee', (employeeId: number, month: number, year: number) => EmployeeController.getPayrollByEmployee(employeeId, month, year))
  handle(ipcMain, 'payroll:create', (data: any) => EmployeeController.createPayroll(data))
  handle(ipcMain, 'payroll:updateStatus', (id: number, status: string) => EmployeeController.updatePayrollStatus(id, status))
  handle(ipcMain, 'payroll:getSlip', (id: number) => EmployeeController.generatePayrollSlip(id))
  handle(ipcMain, 'payroll:getSummary', (month: number, year: number) => EmployeeController.getPayrollSummary(month, year))
  handle(ipcMain, 'payroll:getDetails', (payrollId: number) => EmployeeController.getDetails(payrollId))
  handle(ipcMain, 'payroll:addDetail', (data: any) => EmployeeController.addDetail(data))
  handle(ipcMain, 'payroll:deleteDetail', (id: number) => EmployeeController.deleteDetail(id))
  // Tip Pooling
  handle(ipcMain, 'tip:getAll', () => EmployeeController.getTipPoolings())
  handle(ipcMain, 'tip:create', (data: any) => EmployeeController.createTipPooling(data))
  handle(ipcMain, 'tip:distribute', (id: number, distributions: any[]) => EmployeeController.distributeTip(id, distributions))
  handle(ipcMain, 'tip:getDistributions', (poolingId: number) => EmployeeController.getTipDistributions(poolingId))
  // Shift Schedule
  handle(ipcMain, 'shiftSchedule:getAll', (date?: string) => EmployeeController.getSchedules(date || new Date().toISOString().split('T')[0]))
  handle(ipcMain, 'shiftSchedule:getByEmployee', (employeeId: number, startDate: string, endDate: string) => EmployeeController.getSchedulesByEmployee(employeeId, startDate, endDate))
  handle(ipcMain, 'shiftSchedule:create', (data: any) => EmployeeController.createSchedule(data))
  handle(ipcMain, 'shiftSchedule:delete', (id: number) => EmployeeController.deleteSchedule(id))

  // ─── KDS (Kitchen Display) ─────────────────────────────────────────
  handle(ipcMain, 'kds:getOrders', (status?: string, dapur?: string) => KdsController.getOrders(status, dapur))
  handle(ipcMain, 'kds:getOrderById', (id: number) => KdsController.getOrderById(id))
  handle(ipcMain, 'kds:createOrder', (data: any) => KdsController.createOrder(data))
  handle(ipcMain, 'kds:updateOrderStatus', (id: number, status: string, waktu?: string) => KdsController.updateOrderStatus(id, status, waktu))
  handle(ipcMain, 'kds:deleteOrder', (id: number) => KdsController.deleteOrder(id))
  handle(ipcMain, 'kds:clearOrders', (status?: string) => KdsController.clearOrders(status))
  handle(ipcMain, 'kds:getOrderItems', (orderId: number) => KdsController.getOrderItems(orderId))
  handle(ipcMain, 'kds:addOrderItem', (data: any) => KdsController.addOrderItem(data))
  handle(ipcMain, 'kds:updateOrderItemStatus', (id: number, status: string, waktu?: string) => KdsController.updateOrderItemStatus(id, status, waktu))
  handle(ipcMain, 'kds:getSummary', () => KdsController.getOrdersSummary())
  handle(ipcMain, 'kds:getPending', () => KdsController.getPendingOrders())
  handle(ipcMain, 'kds:getAvgPrepTime', () => KdsController.getAveragePrepTime())

  // ─── TABLE MANAGEMENT ──────────────────────────────────────────────
  handle(ipcMain, 'floor:getAll', () => KdsController.getFloorLayouts())
  handle(ipcMain, 'floor:getById', (id: number) => KdsController.getFloorLayoutById(id))
  handle(ipcMain, 'floor:create', (data: any) => KdsController.createFloorLayout(data))
  handle(ipcMain, 'floor:update', (id: number, data: any) => KdsController.updateFloorLayout(id, data))
  handle(ipcMain, 'floor:delete', (id: number) => KdsController.deleteFloorLayout(id))
  handle(ipcMain, 'table:getAll', (layoutId?: number) => KdsController.getAllTables(layoutId))
  handle(ipcMain, 'table:getById', (id: number) => KdsController.getTableById(id))
  handle(ipcMain, 'table:create', (data: any) => KdsController.createTable(data))
  handle(ipcMain, 'table:update', (id: number, data: any) => KdsController.updateTable(id, data))
  handle(ipcMain, 'table:updateStatus', (id: number, status: string) => KdsController.updateTableStatus(id, status))
  handle(ipcMain, 'table:delete', (id: number) => KdsController.deleteTable(id))
  handle(ipcMain, 'table:getSummary', () => KdsController.getTablesSummary())

  // ─── RESERVATION ──────────────────────────────────────────────────
  handle(ipcMain, 'reservation:getAll', (date?: string) => KdsController.getReservations(date))
  handle(ipcMain, 'reservation:getById', (id: number) => KdsController.getReservationById(id))
  handle(ipcMain, 'reservation:create', (data: any) => KdsController.createReservation(data))
  handle(ipcMain, 'reservation:update', (id: number, data: any) => KdsController.updateReservation(id, data))
  handle(ipcMain, 'reservation:updateStatus', (id: number, status: string) => KdsController.updateReservationStatus(id, status))
  handle(ipcMain, 'reservation:delete', (id: number) => KdsController.deleteReservation(id))
  handle(ipcMain, 'reservation:cancel', (id: number) => KdsController.cancelReservation(id))
  handle(ipcMain, 'reservation:getActive', () => KdsController.getActiveReservations())
  handle(ipcMain, 'reservation:getUpcoming', (limit?: number) => KdsController.getUpcomingReservations(limit))

  // ─── RECIPE / BOM ─────────────────────────────────────────────────
  handle(ipcMain, 'recipe:getAll', (kategori?: string) => RecipeController.getAll(kategori))
  handle(ipcMain, 'recipe:getById', (id: number) => RecipeController.getById(id))
  handle(ipcMain, 'recipe:create', (data: any) => RecipeController.create(data))
  handle(ipcMain, 'recipe:update', (id: number, data: any) => RecipeController.update(id, data))
  handle(ipcMain, 'recipe:delete', (id: number) => RecipeController.delete(id))
  handle(ipcMain, 'recipe:getIngredients', (recipeId: number) => RecipeController.getIngredients(recipeId))
  handle(ipcMain, 'recipe:addIngredient', (data: any) => RecipeController.addIngredient(data))
  handle(ipcMain, 'recipe:updateIngredient', (id: number, data: any) => RecipeController.updateIngredient(id, data))
  handle(ipcMain, 'recipe:deleteIngredient', (id: number, recipeId: number) => RecipeController.deleteIngredient(id, recipeId))
  handle(ipcMain, 'recipe:calcCost', (recipeId: number) => RecipeController.calculateProductionCost(recipeId))
  handle(ipcMain, 'recipe:search', (query: string) => RecipeController.search(query))
  handle(ipcMain, 'recipe:getByProduct', (kd_barang: string) => RecipeController.getByKdBarang(kd_barang))

  // ─── DELIVERY ─────────────────────────────────────────────────────
  handle(ipcMain, 'delivery:getOrders', (status?: string) => DeliveryController.getOrders(status))
  handle(ipcMain, 'delivery:getOrderById', (id: number) => DeliveryController.getOrderById(id))
  handle(ipcMain, 'delivery:createOrder', (data: any) => DeliveryController.createOrder(data))
  handle(ipcMain, 'delivery:updateOrderStatus', (id: number, status: string, data?: any) => DeliveryController.updateOrderStatus(id, status, data))
  handle(ipcMain, 'delivery:assignCourier', (id: number, kurir: string) => DeliveryController.assignCourier(id, kurir))
  handle(ipcMain, 'delivery:getVehicles', (status?: string) => DeliveryController.getVehicles(status))
  handle(ipcMain, 'delivery:createVehicle', (data: any) => DeliveryController.createVehicle(data))
  handle(ipcMain, 'delivery:updateVehicle', (id: number, data: any) => DeliveryController.updateVehicle(id, data))
  handle(ipcMain, 'delivery:deleteVehicle', (id: number) => DeliveryController.deleteVehicle(id))

  // ─── BANK & FINANCE ──────────────────────────────────────────────
  handle(ipcMain, 'bank:getAccounts', () => FinanceController.getBankAccounts())
  handle(ipcMain, 'bank:getAccountById', (id: number) => FinanceController.getBankAccountById(id))
  handle(ipcMain, 'bank:createAccount', (data: any) => FinanceController.createBankAccount(data))
  handle(ipcMain, 'bank:updateAccount', (id: number, data: any) => FinanceController.updateBankAccount(id, data))
  handle(ipcMain, 'bank:deleteAccount', (id: number) => FinanceController.deleteBankAccount(id))
  handle(ipcMain, 'bank:getTransactions', (accountId: number, startDate?: string, endDate?: string) => FinanceController.getBankTransactions(accountId, startDate, endDate))
  handle(ipcMain, 'bank:addTransaction', (data: any) => FinanceController.addBankTransaction(data))
  handle(ipcMain, 'bank:reconcile', (accountId: number, month: number, year: number, saldo_bank: number) => FinanceController.reconcile(accountId, month, year, saldo_bank))
  // Fixed Assets
  handle(ipcMain, 'asset:getAll', (status?: string) => FinanceController.getAssets(status))
  handle(ipcMain, 'asset:getById', (id: number) => FinanceController.getAssetById(id))
  handle(ipcMain, 'asset:create', (data: any) => FinanceController.createAsset(data))
  handle(ipcMain, 'asset:update', (id: number, data: any) => FinanceController.updateAsset(id, data))
  handle(ipcMain, 'asset:delete', (id: number) => FinanceController.deleteAsset(id))
  handle(ipcMain, 'asset:calcDepreciation', (assetId: number) => FinanceController.calculateDepreciation(assetId))
  handle(ipcMain, 'asset:getDepreciationHistory', (assetId: number) => FinanceController.getDepreciationHistory(assetId))
  // Budgets
  handle(ipcMain, 'budget:getAll', (month?: number, year?: number) => FinanceController.getBudgets(month, year))
  handle(ipcMain, 'budget:getById', (id: number) => FinanceController.getBudgetById(id))
  handle(ipcMain, 'budget:create', (data: any) => FinanceController.createBudget(data))
  handle(ipcMain, 'budget:update', (id: number, data: any) => FinanceController.updateBudget(id, data))
  handle(ipcMain, 'budget:delete', (id: number) => FinanceController.deleteBudget(id))
  handle(ipcMain, 'budget:getSummary', (year: number) => FinanceController.getBudgetSummary(year))

  // ─── GIFT CARD ────────────────────────────────────────────────────
  handle(ipcMain, 'giftcard:getAll', (status?: string) => MarketingController.getAllGiftCards(status))
  handle(ipcMain, 'giftcard:getById', (id: number) => MarketingController.getGiftCardById(id))
  handle(ipcMain, 'giftcard:getByCode', (kode: string) => MarketingController.getGiftCardByKode(kode))
  handle(ipcMain, 'giftcard:create', (data: any) => MarketingController.createGiftCard(data))
  handle(ipcMain, 'giftcard:topUp', (id: number, nominal: number) => MarketingController.topUpGiftCard(id, nominal))
  handle(ipcMain, 'giftcard:redeem', (kode: string, kd_transaksi: string, jumlah: number) => MarketingController.redeemGiftCard(kode, kd_transaksi, jumlah))
  handle(ipcMain, 'giftcard:getUsage', (giftCardId: number) => MarketingController.getGiftCardUsage(giftCardId))

  // ─── CUSTOMER FEEDBACK ────────────────────────────────────────────
  handle(ipcMain, 'feedback:getAll', (status?: string, rating?: number) => MarketingController.getAllFeedback(status, rating))
  handle(ipcMain, 'feedback:getById', (id: number) => MarketingController.getFeedbackById(id))
  handle(ipcMain, 'feedback:create', (data: any) => MarketingController.createFeedback(data))
  handle(ipcMain, 'feedback:reply', (id: number, status: string, balasan?: string) => MarketingController.updateFeedbackStatus(id, status, balasan))
  handle(ipcMain, 'feedback:getSummary', () => MarketingController.getFeedbackSummary())

  // ─── CAMPAIGNS ────────────────────────────────────────────────────
  handle(ipcMain, 'campaign:getAll', (status?: string) => MarketingController.getAllCampaigns(status))
  handle(ipcMain, 'campaign:getById', (id: number) => MarketingController.getCampaignById(id))
  handle(ipcMain, 'campaign:create', (data: any) => MarketingController.createCampaign(data))
  handle(ipcMain, 'campaign:update', (id: number, data: any) => MarketingController.updateCampaign(id, data))
  handle(ipcMain, 'campaign:delete', (id: number) => MarketingController.deleteCampaign(id))
  handle(ipcMain, 'campaign:send', (id: number) => MarketingController.sendCampaign(id))
  handle(ipcMain, 'campaign:getLogs', (campaignId: number) => MarketingController.getCampaignLogs(campaignId))

  // ─── STOREFRONT (Online Store) ────────────────────────────────────
  handle(ipcMain, 'storefront:getSettings', () => CommerceController.getStorefrontSettings())
  handle(ipcMain, 'storefront:updateSettings', (data: any) => CommerceController.updateStorefrontSettings(data))
  handle(ipcMain, 'storefront:getProducts', () => CommerceController.getStorefrontProducts())
  handle(ipcMain, 'storefront:updateProduct', (id: number, data: any) => CommerceController.updateStorefrontProduct(id, data))
  handle(ipcMain, 'storefront:getOrders', (status?: string) => CommerceController.getStorefrontOrders(status))
  handle(ipcMain, 'storefront:getOrderById', (id: number) => CommerceController.getStorefrontOrderById(id))
  handle(ipcMain, 'storefront:createOrder', (data: any) => CommerceController.createStorefrontOrder(data))
  handle(ipcMain, 'storefront:updateOrderStatus', (id: number, status: string) => CommerceController.updateStorefrontOrderStatus(id, status))

  // ─── VENDOR PORTAL ────────────────────────────────────────────────
  handle(ipcMain, 'vendor:getSettings', (supplierId: string) => CommerceController.getVendorSettings(supplierId))
  handle(ipcMain, 'vendor:updateSettings', (supplierId: string, data: any) => CommerceController.updateVendorSettings(supplierId, data))

  // ─── DOCUMENT MANAGEMENT ──────────────────────────────────────────
  handle(ipcMain, 'document:getAll', (tipe?: string, kategori?: string) => CommerceController.getAllDocuments(tipe, kategori))
  handle(ipcMain, 'document:getById', (id: number) => CommerceController.getDocumentById(id))
  handle(ipcMain, 'document:create', (data: any) => CommerceController.createDocument(data))
  handle(ipcMain, 'document:update', (id: number, data: any) => CommerceController.updateDocument(id, data))
  handle(ipcMain, 'document:delete', (id: number) => CommerceController.deleteDocument(id))
  handle(ipcMain, 'document:search', (query: string) => CommerceController.searchDocuments(query))

  // ─── FORECASTING ──────────────────────────────────────────────────
  handle(ipcMain, 'forecast:getSettings', () => CommerceController.getForecastSettings())
  handle(ipcMain, 'forecast:updateSettings', (data: any) => CommerceController.updateForecastSettings(data))
  handle(ipcMain, 'forecast:getAll', (kd_barang?: string) => CommerceController.getForecasts(kd_barang))
  handle(ipcMain, 'forecast:generate', (kd_barang: string) => CommerceController.generateForecast(kd_barang))
  handle(ipcMain, 'pricing:getRules', () => CommerceController.getDynamicPricingRules())
  handle(ipcMain, 'pricing:createRule', (data: any) => CommerceController.createDynamicPricingRule(data))
  handle(ipcMain, 'pricing:updateRule', (id: number, data: any) => CommerceController.updateDynamicPricingRule(id, data))
  handle(ipcMain, 'pricing:deleteRule', (id: number) => CommerceController.deleteDynamicPricingRule(id))
  handle(ipcMain, 'pricing:getActive', (kd_barang?: string) => CommerceController.getActiveRules(kd_barang))

  // ─── DIALOG ────────────────────────────────────────────────────────
  handle(ipcMain, 'dialog:showSaveDialog', async (options: any) => {
    const result = await dialog.showSaveDialog(options)
    if (!result.canceled && result.filePath) {
      approvedSavePaths.add(path.resolve(result.filePath))
    }
    return { success: true, data: result }
  })

  // ─── PRINT ─────────────────────────────────────────────────────────
  const printGetPrinters = registerChannel('print:getPrinters', async (event: IpcMainInvokeEvent) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, message: 'Window not found' }
      const printers = await win.webContents.getPrintersAsync()
      return { success: true, data: printers }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })
  ipcMain.handle('print:getPrinters', withDemoGuard('print:getPrinters', printGetPrinters))

  const printExecute = registerChannel('print:execute', async (event: IpcMainInvokeEvent, options: { printerName?: string; silent?: boolean; copies?: number }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, message: 'Window not found' }
      return new Promise<{ success: boolean; message?: string }>((resolve) => {
        win.webContents.print(
          {
            silent: options.silent ?? true,
            printBackground: true,
            deviceName: options.printerName ?? '',
            copies: options.copies ?? 1,
          },
          (success, failureReason) => {
            if (success) resolve({ success: true })
            else resolve({ success: false, message: failureReason })
          }
        )
      })
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })
  ipcMain.handle('print:execute', withDemoGuard('print:execute', printExecute))

  // ─── WINDOW / CUSTOMER DISPLAY & QUEUE DISPLAY ───────────────────
  let customerDisplayWindow: BrowserWindow | null = null
  let queueDisplayWindow: BrowserWindow | null = null

  const openCustomerDisplay = registerChannel('window:openCustomerDisplay', async () => {
    try {
      if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
        customerDisplayWindow.show()
        customerDisplayWindow.focus()
        return { success: true, message: 'Layar Customer Display sudah terbuka' }
      }

      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
      const preloadPath = isDev 
        ? path.join(process.cwd(), 'src', 'main', 'preload.cjs')
        : path.join(app.getAppPath(), 'dist-electron', 'main', 'preload.cjs')

      customerDisplayWindow = new BrowserWindow({
        width: 1024,
        height: 700,
        minWidth: 800,
        minHeight: 500,
        title: 'WariPOS - Customer Display',
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
        backgroundColor: '#020617',
        autoHideMenuBar: true,
      })

      if (isDev) {
        await customerDisplayWindow.loadURL('http://localhost:5173/#/customer-display')
      } else {
        const rendererIndexPath = path.join(app.getAppPath(), 'dist', 'index.html')
        await customerDisplayWindow.loadFile(rendererIndexPath, { hash: '/customer-display' })
      }

      customerDisplayWindow.on('closed', () => {
        customerDisplayWindow = null
      })

      return { success: true, message: 'Layar Customer Display berhasil dibuka' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })
  ipcMain.handle('window:openCustomerDisplay', withDemoGuard('window:openCustomerDisplay', openCustomerDisplay))

  const openQueueDisplay = registerChannel('window:openQueueDisplay', async () => {
    try {
      if (queueDisplayWindow && !queueDisplayWindow.isDestroyed()) {
        queueDisplayWindow.show()
        queueDisplayWindow.focus()
        return { success: true, message: 'Layar TV Antrian sudah terbuka' }
      }

      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
      const preloadPath = isDev 
        ? path.join(process.cwd(), 'src', 'main', 'preload.cjs')
        : path.join(app.getAppPath(), 'dist-electron', 'main', 'preload.cjs')

      queueDisplayWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 550,
        title: 'WariPOS - Layar TV Antrian Publik',
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
        backgroundColor: '#020617',
        autoHideMenuBar: true,
      })

      if (isDev) {
        await queueDisplayWindow.loadURL('http://localhost:5173/#/queue-display')
      } else {
        const rendererIndexPath = path.join(app.getAppPath(), 'dist', 'index.html')
        await queueDisplayWindow.loadFile(rendererIndexPath, { hash: '/queue-display' })
      }

      queueDisplayWindow.on('closed', () => {
        queueDisplayWindow = null
      })

      return { success: true, message: 'Layar TV Antrian berhasil dibuka' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })
  ipcMain.handle('window:openQueueDisplay', withDemoGuard('window:openQueueDisplay', openQueueDisplay))
}
