import { BackupModel } from '../models/BackupModel.js'
import { IndustrySettingsController } from './IndustrySettingsController.js'
import Database from 'better-sqlite3'
import { sqlite, reopenDatabase } from '../../database/connection.js'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'
import * as unzipper from 'unzipper'

// @ts-ignore - Use require for archiver (CommonJS compatibility)
const archiver = require('archiver')

function dataDir() {
  return app.isPackaged ? app.getPath('userData') : process.cwd()
}

function backupDir() {
  const dir = path.join(dataDir(), 'backups')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function dbPath() {
  return path.join(dataDir(), 'sistem_pos.db')
}

function uploadsDir() {
  const dir = path.join(dataDir(), 'uploads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function isSqliteDatabase(buffer: Buffer) {
  return buffer.subarray(0, 16).toString('binary') === 'SQLite format 3\0'
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function validateSqliteDatabaseFile(filePath: string): { valid: boolean; message?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, message: 'File database tidak ditemukan' }
  }

  const header = fs.readFileSync(filePath, { flag: 'r' }).subarray(0, 16)
  if (!isSqliteDatabase(header)) {
    return { valid: false, message: 'File bukan database SQLite yang valid' }
  }

  let validationDb: Database.Database | null = null
  try {
    validationDb = new Database(filePath, { readonly: true, fileMustExist: true })
    const rows = validationDb
      .prepare('PRAGMA integrity_check')
      .all() as Array<{ integrity_check: string }>
    const errors = rows
      .map(row => row.integrity_check)
      .filter(message => message !== 'ok')

    if (errors.length > 0) {
      return {
        valid: false,
        message: errors.slice(0, 3).join('; '),
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : String(error) }
  } finally {
    validationDb?.close()
  }
}

function createConsistentDatabaseCopy(destinationPath: string) {
  if (fs.existsSync(destinationPath)) fs.rmSync(destinationPath, { force: true })

  sqlite.exec(`VACUUM INTO ${quoteSqlString(destinationPath)}`)

  const validation = validateSqliteDatabaseFile(destinationPath)
  if (!validation.valid) {
    fs.rmSync(destinationPath, { force: true })
    throw new Error(`Backup database tidak lolos validasi: ${validation.message}`)
  }
}

function removeWalArtifacts(targetDb: string) {
  for (const suffix of ['-wal', '-shm']) {
    const artifact = `${targetDb}${suffix}`
    if (fs.existsSync(artifact)) fs.rmSync(artifact, { force: true })
  }
}

function replaceLiveDatabase(sourcePath: string, targetDb: string) {
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  sqlite.close()
  removeWalArtifacts(targetDb)
  fs.copyFileSync(sourcePath, targetDb)
  removeWalArtifacts(targetDb)
  reopenDatabase()
}

function scheduleRestart() {
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 750)
}

function cleanOldBackupFiles(retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const oldBackups = BackupModel.getOlderThan(cutoff)
  for (const backup of oldBackups) {
    const file = path.join(backupDir(), backup.nama_file)
    if (fs.existsSync(file)) fs.rmSync(file, { force: true })
    BackupModel.delete(backup.kd_backup)
  }
}

async function createZipBackup(zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)

    // Add database file
    const dbFile = dbPath()
    if (fs.existsSync(dbFile)) {
      archive.file(dbFile, { name: 'sistem_pos.db' })
    }

    // Add uploads directory (product images, QRIS, etc)
    const uploadsPath = uploadsDir()
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath, { recursive: true, withFileTypes: true })
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.path || file.parentPath || uploadsPath, file.name)
          const relativePath = path.relative(dataDir(), filePath)
          archive.file(filePath, { name: relativePath })
        }
      }
    }

    archive.finalize()
  })
}

async function extractZipBackup(zipPath: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on('close', resolve)
      .on('error', reject)
  })
}

export class BackupController {
  /**
   * Auto backup before critical operations
   * Returns backup filename or null if failed
   */
  static autoBackup(operation: string): string | null {
    try {
      const dir = backupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `auto_${operation}_${timestamp}.db`
      const backupPath = path.join(dir, backupFileName)

      createConsistentDatabaseCopy(backupPath)

      const stats = fs.statSync(backupPath)
      BackupModel.create({
        nama_file: backupFileName,
        ukuran: stats.size,
        tgl_backup: new Date().toISOString(),
        username: 'SYSTEM',
        keterangan: `Auto backup before ${operation}`,
      })

      return backupFileName
    } catch (error) {
      console.error('[AutoBackup] Failed:', error)
      return null
    }
  }

  static getAll() {
    try {
      const backups = BackupModel.getAll()
      return { success: true, data: backups }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data backup: ' + (error as Error).message }
    }
  }

  static create(username: string, keterangan?: string) {
    try {
      const settings = IndustrySettingsController.getSettings()
      const dir = backupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `backup_${timestamp}.db`
      const backupPath = path.join(dir, backupFileName)

      createConsistentDatabaseCopy(backupPath)

      // Get file size
      const stats = fs.statSync(backupPath)
      const ukuran = stats.size

      // Save to database
      const tgl_backup = new Date().toISOString()
      BackupModel.create({
        nama_file: backupFileName,
        ukuran,
        tgl_backup,
        username,
        keterangan: keterangan || null,
      })

      cleanOldBackupFiles(settings.backupRetentionDays)

      return {
        success: true,
        message: 'Backup berhasil dibuat',
        data: { nama_file: backupFileName, ukuran },
      }
    } catch (error) {
      return { success: false, message: 'Gagal membuat backup: ' + (error as Error).message }
    }
  }

  static async createZip(username: string, keterangan?: string) {
    try {
      const settings = IndustrySettingsController.getSettings()
      const dir = backupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `backup_full_${timestamp}.zip`
      const backupPath = path.join(dir, backupFileName)

      // Create temporary database backup first
      const tempDbPath = path.join(dir, `temp_${timestamp}.db`)
      createConsistentDatabaseCopy(tempDbPath)

      // Create ZIP with database + uploads
      await createZipBackup(backupPath)

      // Remove temp database
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath)
      }

      // Get file size
      const stats = fs.statSync(backupPath)
      const ukuran = stats.size

      // Save to database
      const tgl_backup = new Date().toISOString()
      BackupModel.create({
        nama_file: backupFileName,
        ukuran,
        tgl_backup,
        username,
        keterangan: keterangan ? `[FULL] ${keterangan}` : '[FULL] Database + Uploads',
      })

      cleanOldBackupFiles(settings.backupRetentionDays)

      return {
        success: true,
        message: 'Full backup (ZIP) berhasil dibuat',
        data: { nama_file: backupFileName, ukuran },
      }
    } catch (error) {
      return { success: false, message: 'Gagal membuat full backup: ' + (error as Error).message }
    }
  }

  static restore(kd_backup: number) {
    try {
      const backup = BackupModel.getById(kd_backup)
      if (!backup) {
        return { success: false, message: 'Backup tidak ditemukan' }
      }

      const backupPath = path.join(backupDir(), backup.nama_file)
      const targetDb = dbPath()

      if (!fs.existsSync(backupPath)) {
        return { success: false, message: 'File backup tidak ditemukan' }
      }
      const backupValidation = validateSqliteDatabaseFile(backupPath)
      if (!backupValidation.valid) {
        return { success: false, message: `File backup bukan database SQLite yang valid: ${backupValidation.message}` }
      }

      // Create backup of current database before restore
      const currentBackupPath = path.join(backupDir(), `before_restore_${Date.now()}.db`)
      createConsistentDatabaseCopy(currentBackupPath)

      replaceLiveDatabase(backupPath, targetDb)
      scheduleRestart()

      return {
        success: true,
        message: 'Database berhasil di-restore. Aplikasi akan restart.',
      }
    } catch (error) {
      return { success: false, message: 'Gagal restore database: ' + (error as Error).message }
    }
  }

  static async restoreZip(kd_backup: number) {
    try {
      const backup = BackupModel.getById(kd_backup)
      if (!backup) {
        return { success: false, message: 'Backup tidak ditemukan' }
      }

      const zipPath = path.join(backupDir(), backup.nama_file)
      if (!fs.existsSync(zipPath)) {
        return { success: false, message: 'File backup ZIP tidak ditemukan' }
      }

      // Create backup of current state before restore
      const currentBackupPath = path.join(backupDir(), `before_restore_${Date.now()}.db`)
      createConsistentDatabaseCopy(currentBackupPath)

      // Extract ZIP to temporary directory
      const tempDir = path.join(backupDir(), `temp_restore_${Date.now()}`)
      fs.mkdirSync(tempDir, { recursive: true })

      await extractZipBackup(zipPath, tempDir)

      // Validate extracted database
      const extractedDb = path.join(tempDir, 'sistem_pos.db')
      if (!fs.existsSync(extractedDb)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        return { success: false, message: 'Database tidak ditemukan di file ZIP' }
      }

      const dbValidation = validateSqliteDatabaseFile(extractedDb)
      if (!dbValidation.valid) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        return { success: false, message: `Database di ZIP tidak valid: ${dbValidation.message}` }
      }

      // Replace database
      const targetDb = dbPath()
      replaceLiveDatabase(extractedDb, targetDb)

      // Restore uploads folder
      const extractedUploads = path.join(tempDir, 'uploads')
      const targetUploads = uploadsDir()
      
      if (fs.existsSync(extractedUploads)) {
        // Backup current uploads
        const uploadsBackup = path.join(backupDir(), `uploads_before_restore_${Date.now()}`)
        if (fs.existsSync(targetUploads)) {
          fs.renameSync(targetUploads, uploadsBackup)
        }
        
        // Move extracted uploads to target
        fs.renameSync(extractedUploads, targetUploads)
      }

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true })

      scheduleRestart()

      return {
        success: true,
        message: 'Full backup berhasil di-restore. Aplikasi akan restart.',
      }
    } catch (error) {
      return { success: false, message: 'Gagal restore full backup: ' + (error as Error).message }
    }
  }

  static delete(kd_backup: number) {
    try {
      const backup = BackupModel.getById(kd_backup)
      if (!backup) {
        return { success: false, message: 'Backup tidak ditemukan' }
      }

      const backupPath = path.join(backupDir(), backup.nama_file)

      // Delete file
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath)
      }

      // Delete from database
      BackupModel.delete(kd_backup)

      return { success: true, message: 'Backup berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus backup: ' + (error as Error).message }
    }
  }
  
  static import(base64Data: string, fileName: string) {
    try {
      const targetDb = dbPath()
      const backupsDir = backupDir()
      
      // Backup current database before import
      const currentBackupPath = path.join(backupsDir, `before_import_${Date.now()}.db`)
      createConsistentDatabaseCopy(currentBackupPath)
      
      // Write imported file
      const buffer = Buffer.from(base64Data, 'base64')
      if (!isSqliteDatabase(buffer)) {
        return { success: false, message: 'File import bukan database SQLite yang valid' }
      }
      const importTempPath = path.join(backupsDir, `import_validation_${Date.now()}_${path.basename(fileName)}`)
      fs.writeFileSync(importTempPath, buffer)
      const importValidation = validateSqliteDatabaseFile(importTempPath)
      if (!importValidation.valid) {
        fs.rmSync(importTempPath, { force: true })
        return { success: false, message: `File import bukan database SQLite yang valid: ${importValidation.message}` }
      }
      replaceLiveDatabase(importTempPath, targetDb)
      fs.rmSync(importTempPath, { force: true })
      scheduleRestart()
      
      return {
        success: true,
        message: 'Database berhasil di-import. Aplikasi akan restart.',
      }
    } catch (error) {
      return { success: false, message: 'Gagal import database: ' + (error as Error).message }
    }
  }

  static download(kd_backup: number) {
    try {
      const backup = BackupModel.getById(kd_backup)
      if (!backup) {
        return { success: false, message: 'Backup tidak ditemukan' }
      }

      const backupPath = path.join(backupDir(), backup.nama_file)

      if (!fs.existsSync(backupPath)) {
        return { success: false, message: 'File backup tidak ditemukan' }
      }

      return { success: true, data: { path: backupPath, nama_file: backup.nama_file } }
    } catch (error) {
      return { success: false, message: 'Gagal download backup: ' + (error as Error).message }
    }
  }
}
