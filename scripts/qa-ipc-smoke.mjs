#!/usr/bin/env node

import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog } from 'electron'

function log(message) {
  console.log(`[qa:ipc-smoke] ${message}`)
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function asArray(result) {
  assert(result && typeof result === 'object', 'Response kosong')
  assert(result.success === true, result.message || 'Request gagal')
  return Array.isArray(result.data) ? result.data : []
}

function asObject(result) {
  assert(result && typeof result === 'object', 'Response kosong')
  assert(result.success === true, result.message || 'Request gagal')
  return result.data ?? {}
}

function uniqueTag(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

async function main() {
  await app.whenReady()

  const repoRoot = process.cwd()
  const sourceDbPath = path.join(repoRoot, 'sistem_pos.db')
  assert(fs.existsSync(sourceDbPath), `Database sumber tidak ditemukan: ${sourceDbPath}`)

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waripos-ipc-smoke-'))
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waripos-electron-profile-'))
  const cloneDbPath = path.join(workDir, 'sistem_pos.db')

  log(`Source DB: ${sourceDbPath}`)
  log(`Clone DB: ${cloneDbPath}`)
  log(`Electron profile: ${profileDir}`)

  const sourceDb = new Database(sourceDbPath, { readonly: true, fileMustExist: true })
  await sourceDb.backup(cloneDbPath)
  sourceDb.close()

  process.chdir(workDir)

  const rootUrl = pathToFileURL(repoRoot.endsWith(path.sep) ? repoRoot : `${repoRoot}${path.sep}`)
  const dist = (rel) => new URL(rel, rootUrl).href

  const { sqlite } = await import(dist('dist-electron/database/connection.js'))
  const { initDatabase } = await import(dist('dist-electron/backend/utils/dbInit.js'))
  const { demoSession } = await import(dist('dist-electron/backend/services/demoSessionManager.js'))
  const { SyncClientService } = await import(dist('dist-electron/main/syncClient.js'))
  const { registerIpcHandlers } = await import(dist('dist-electron/main/ipcHandlers.js'))

  SyncClientService.saveConfig({ enabled: false, baseUrl: '', token: '' })

  initDatabase()
  demoSession.setSession('qa.dev', 'developer')

  const handlers = new Map()
  registerIpcHandlers({
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
  })

  async function invoke(channel, ...args) {
    const handler = handlers.get(channel)
    assert(handler, `Handler tidak terdaftar: ${channel}`)
    return handler({ sender: {} }, ...args)
  }

  const createdIds = {
    dailyNote: null,
    pettyCash: null,
    branch: null,
  }
  const tempFiles = []
  let originalNotifSettings = null
  let branchSnapshot = null

  async function approveSavePath(customPath) {
    const originalShowSaveDialog = dialog.showSaveDialog
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: customPath })
    try {
      const result = await invoke('dialog:showSaveDialog', { defaultPath: customPath })
      assert(result.success, result.message || 'dialog:showSaveDialog gagal')
      assert(result.data?.filePath === customPath, 'Dialog tidak mengembalikan filePath yang diharapkan')
    } finally {
      dialog.showSaveDialog = originalShowSaveDialog
    }
  }

  try {
    log('Test daily notes CRUD')
    const noteTitle = uniqueTag('QA Daily Note')
    let result = await invoke('dailyNotes:create', {
      tanggal: new Date().toISOString().slice(0, 10),
      judul: noteTitle,
      isi: 'Smoke test untuk memastikan catatan harian tersimpan.',
      jenis: 'info',
      username: 'qa.dev',
    })
    assert(result.success, result.message || 'dailyNotes:create gagal')
    createdIds.dailyNote = result.data?.id
    assert(createdIds.dailyNote, 'ID daily note tidak dikembalikan')

    result = await invoke('dailyNotes:getAll', undefined, noteTitle)
    let notes = asArray(result)
    assert(notes.some((row) => String(row.judul ?? '') === noteTitle), 'Daily note tidak muncul setelah create')

    result = await invoke('dailyNotes:update', createdIds.dailyNote, {
      tanggal: new Date().toISOString().slice(0, 10),
      judul: `${noteTitle} v2`,
      isi: 'Catatan harian sudah diperbarui.',
      jenis: 'warning',
    })
    assert(result.success, result.message || 'dailyNotes:update gagal')

    result = await invoke('dailyNotes:getAll', undefined, `${noteTitle} v2`)
    notes = asArray(result)
    assert(notes.some((row) => String(row.judul ?? '') === `${noteTitle} v2`), 'Daily note hasil update tidak ditemukan')

    result = await invoke('dailyNotes:delete', createdIds.dailyNote)
    assert(result.success, result.message || 'dailyNotes:delete gagal')
    createdIds.dailyNote = null

    log('Test petty cash CRUD')
    const pettyDesc = uniqueTag('QA Petty Cash')
    result = await invoke('pettyCash:create', {
      tanggal: new Date().toISOString().slice(0, 10),
      keterangan: pettyDesc,
      kategori: 'QA',
      jumlah: 12345,
      jenis: 'keluar',
      username: 'qa.dev',
    })
    assert(result.success, result.message || 'pettyCash:create gagal')
    createdIds.pettyCash = result.data?.id
    assert(createdIds.pettyCash, 'ID petty cash tidak dikembalikan')

    result = await invoke('pettyCash:getAll', undefined, undefined, pettyDesc)
    const pettyRows = asArray(result)
    assert(pettyRows.some((row) => String(row.keterangan ?? '') === pettyDesc), 'Petty cash tidak muncul setelah create')

    result = await invoke('pettyCash:delete', createdIds.pettyCash)
    assert(result.success, result.message || 'pettyCash:delete gagal')
    createdIds.pettyCash = null

    log('Test notification settings save/restore')
    originalNotifSettings = asObject(await invoke('notifSettings:get'))
    const toggledSettings = {
      ...originalNotifSettings,
      stok_menipis: !Boolean(originalNotifSettings.stok_menipis),
      min_stok: Number(originalNotifSettings.min_stok ?? 5) + 1,
      wa_number: String(originalNotifSettings.wa_number ?? ''),
    }
    result = await invoke('notifSettings:save', toggledSettings)
    assert(result.success, result.message || 'notifSettings:save gagal')
    const savedSettings = asObject(await invoke('notifSettings:get'))
    assert(Boolean(savedSettings.stok_menipis) === toggledSettings.stok_menipis, 'notifSettings tidak tersimpan')
    assert(Number(savedSettings.min_stok) === Number(toggledSettings.min_stok), 'notifSettings min_stok tidak ikut tersimpan')

    result = await invoke('notifSettings:save', originalNotifSettings)
    assert(result.success, result.message || 'notifSettings restore gagal')

    log('Test branch CRUD + alias')
    const branchRows = asArray(await invoke('branch:getAll'))
    branchSnapshot = branchRows[0] ?? null

    const tempBranchCode = uniqueTag('QA-BR')
    result = await invoke('branch:create', {
      code: tempBranchCode,
      name: 'QA Branch Smoke',
      address: 'Jl. QA Smoke',
      phone: '081200000099',
      is_warehouse: 0,
      is_active: 1,
    })
    assert(result.success, result.message || 'branch:create gagal')
    createdIds.branch = Number(result.data?.id)
    assert(createdIds.branch > 0, 'ID branch tidak dikembalikan')

    result = await invoke('branch:getById', createdIds.branch)
    const branchDetail = asObject(result)
    assert(String(branchDetail.nama_branch ?? '') === 'QA Branch Smoke', 'Alias nama_branch tidak sesuai')
    assert(String(branchDetail.kode_branch ?? '') === tempBranchCode, 'Alias kode_branch tidak sesuai')

    result = await invoke('branch:update', createdIds.branch, {
      name: 'QA Branch Smoke Updated',
    })
    assert(result.success, result.message || 'branch:update gagal')

    result = await invoke('branch:getById', createdIds.branch)
    const updatedBranch = asObject(result)
    assert(String(updatedBranch.nama_branch ?? '') === 'QA Branch Smoke Updated', 'Branch update tidak terbaca')

    result = await invoke('branch:delete', createdIds.branch)
    assert(result.success, result.message || 'branch:delete gagal')
    createdIds.branch = null

    if (branchRows.length > 0) {
      assert(Object.prototype.hasOwnProperty.call(branchRows[0], 'nama_branch'), 'branch:getAll tidak mengembalikan nama_branch')
      assert(Object.prototype.hasOwnProperty.call(branchRows[0], 'kode_branch'), 'branch:getAll tidak mengembalikan kode_branch')
    }

    log('Test read endpoints and exports')
    const priceList = asArray(await invoke('priceList:get'))
    const cashFlow = asArray(await invoke('cashFlow:getAll'))
    const taxSummary = asArray(await invoke('taxReport:getSummary'))
    const commissions = asArray(await invoke('salesCommission:getAll'))
    const supplierRatings = asArray(await invoke('supplierRating:getAll'))
    const memberships = asArray(await invoke('membership:getAll'))
    const stockHistory = asArray(await invoke('stockHistory:getAll'))
    const productsByCategory = asArray(await invoke('barang:getByKategori'))
    const productsByBranch = branchRows.length > 0
      ? asArray(await invoke('barang:getByBranch', Number(branchRows[0].id)))
      : []

    assert(Array.isArray(priceList), 'priceList:get tidak mengembalikan array')
    assert(Array.isArray(cashFlow), 'cashFlow:getAll tidak mengembalikan array')
    assert(Array.isArray(taxSummary), 'taxReport:getSummary tidak mengembalikan array')
    assert(Array.isArray(commissions), 'salesCommission:getAll tidak mengembalikan array')
    assert(Array.isArray(supplierRatings), 'supplierRating:getAll tidak mengembalikan array')
    assert(Array.isArray(memberships), 'membership:getAll tidak mengembalikan array')
    assert(Array.isArray(stockHistory), 'stockHistory:getAll tidak mengembalikan array')
    assert(Array.isArray(productsByCategory), 'barang:getByKategori tidak mengembalikan array')
    assert(Array.isArray(productsByBranch), 'barang:getByBranch tidak mengembalikan array')

    if (stockHistory.length > 0) {
      const first = stockHistory[0]
      assert(['masuk', 'keluar', 'neutral'].includes(String(first.direction ?? '')), 'direction stock history tidak valid')
    }

    if (branchRows.length > 0) {
      const firstBranchId = Number(branchRows[0].id)
      assert(Number.isFinite(firstBranchId), 'branch id tidak valid')
    }

    const priceListExportPath = path.join(workDir, 'qa-price-list.pdf')
    const cashFlowExportPath = path.join(workDir, 'qa-cash-flow.xlsx')
    const taxExportPath = path.join(workDir, 'qa-tax-report.xlsx')

    await approveSavePath(priceListExportPath)
    result = await invoke('export:priceListPDF', priceList.slice(0, 10), 'QA Smoke', priceListExportPath)
    assert(result.success, result.message || 'export:priceListPDF gagal')
    assert(fs.existsSync(priceListExportPath), 'File price list PDF tidak dibuat')
    assert(fs.statSync(priceListExportPath).size > 0, 'File price list PDF kosong')
    tempFiles.push(priceListExportPath)

    await approveSavePath(cashFlowExportPath)
    result = await invoke('export:cashFlowExcel', cashFlow, '2026-01-01', '2026-12-31', cashFlowExportPath)
    assert(result.success, result.message || 'export:cashFlowExcel gagal')
    assert(fs.existsSync(cashFlowExportPath), 'File cash flow XLSX tidak dibuat')
    assert(fs.statSync(cashFlowExportPath).size > 0, 'File cash flow XLSX kosong')
    tempFiles.push(cashFlowExportPath)

    await approveSavePath(taxExportPath)
    result = await invoke('export:taxReportExcel', taxSummary, '2026-01-01', '2026-12-31', taxExportPath)
    assert(result.success, result.message || 'export:taxReportExcel gagal')
    assert(fs.existsSync(taxExportPath), 'File tax report XLSX tidak dibuat')
    assert(fs.statSync(taxExportPath).size > 0, 'File tax report XLSX kosong')
    tempFiles.push(taxExportPath)

    log('All smoke checks passed')
  } finally {
    try {
      if (createdIds.dailyNote) {
        await invoke('dailyNotes:delete', createdIds.dailyNote)
      }
    } catch {}

    try {
      if (createdIds.pettyCash) {
        await invoke('pettyCash:delete', createdIds.pettyCash)
      }
    } catch {}

    try {
      if (createdIds.branch) {
        await invoke('branch:delete', createdIds.branch)
      }
    } catch {}

    try {
      if (originalNotifSettings) {
        await invoke('notifSettings:save', originalNotifSettings)
      }
    } catch {}

    try {
      demoSession.clearSession()
    } catch {}

    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file)
      } catch {}
    }

    if (branchSnapshot) {
      log(`Branch sample used: ${branchSnapshot.nama_branch ?? branchSnapshot.name ?? '-'} / ${branchSnapshot.kode_branch ?? branchSnapshot.code ?? '-'}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
