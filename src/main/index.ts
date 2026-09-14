import './env.js'
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipcHandlers.js'
import { SchedulerService } from '../backend/services/scheduler.js'
import { demoSession } from '../backend/services/demoSessionManager.js'
import { initDatabase } from '../backend/utils/dbInit.js'
import { SyncServerService } from './syncServer.js'
import { SyncClientService } from './syncClient.js'
import { registerSecureStorageHandlers } from './secureStorage.js'
import { PenggunaModel } from '../backend/models/PenggunaModel.js'
import {
  attachWindowSecurity,
  configureElectronSecurity,
  flushPendingDeepLink,
  registerDesktopDeepLinks,
} from './platformSecurity.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

registerDesktopDeepLinks(isDev)

if (process.platform === 'win32') {
  app.setAppUserModelId('com.wari.pos')
}

function getAppIconPath() {
  return isDev
    ? path.join(process.cwd(), 'build', 'icon.png')
    : path.join(process.resourcesPath, 'app-icon.png')
}

function createWindow() {
  const preloadPath = isDev 
    ? path.join(process.cwd(), 'src', 'main', 'preload.cjs')
    : path.join(app.getAppPath(), 'dist-electron', 'main', 'preload.cjs')

  const iconPath = getAppIconPath()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#f8fafc',
    icon: existsSync(iconPath) ? iconPath : undefined,
  })

  mainWindow = win
  attachWindowSecurity(win, isDev)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    const rendererIndexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    win.loadFile(rendererIndexPath)
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  win.webContents.on('did-finish-load', () => {
    flushPendingDeepLink(win)
  })

  win.webContents.on('devtools-opened', () => {
    if (!isDev || demoSession.isDemoMode()) {
      win.webContents.closeDevTools()
    }
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (!isDev || demoSession.isDemoMode()) {
      if (
        input.key === 'F12' ||
        (input.control && input.shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(input.key))
      ) {
        event.preventDefault()
      }
    }
  })

  win.once('ready-to-show', () => win.show())
}

app.whenReady().then(() => {
  configureElectronSecurity(isDev)

  // Initialize database tables first
  initDatabase()
  
  // Force non-bcrypt users to change password on next login
  try {
    const flagged = PenggunaModel.forceNonBcryptUsersToChangePassword()
    if (flagged > 0) {
      console.log(`[Password Migration] ${flagged} user(s) flagged for password migration to bcrypt`)
    }
  } catch (e) {
    console.error('Password migration flag failed:', e)
  }
  
  registerSecureStorageHandlers(ipcMain)
  registerIpcHandlers(ipcMain)
  SyncClientService.init()
  SyncServerService.init()
  
  // Start scheduler service
  SchedulerService.start()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Stop scheduler before quit
  SchedulerService.stop()
  void SyncServerService.stop()
  
  // Clear demo session
  demoSession.clearSession()
  
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  // Stop scheduler before quit
  SchedulerService.stop()
  void SyncServerService.stop()
  
  // Clear demo session
  demoSession.clearSession()
})
