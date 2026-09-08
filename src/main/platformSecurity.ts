import { app, BrowserWindow, session, shell, type BrowserWindow as ElectronBrowserWindow } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const DEEP_LINK_SCHEME = 'waripos'
const LEGACY_DEEP_LINK_SCHEME = 'zetasspos'
const DEFAULT_CERT_PIN_SHA256 = 'ZcJbApTb7wyllleAjHw2vYAskqdT+DhMY9aPDFwAtf4='
const TRUSTED_DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

let pendingDeepLink: string | null = null

function uniqueExistingFiles(files: string[]) {
  return Array.from(new Set(files)).filter(file => fs.existsSync(file))
}

export function loadDesktopEnv() {
  const roots = [
    process.cwd(),
    app.getAppPath(),
    process.resourcesPath,
  ].filter(Boolean)

  const files = uniqueExistingFiles(roots.flatMap(root => [
    path.join(root, '.env.production'),
    path.join(root, '.env'),
  ]))

  for (const file of files) {
    dotenv.config({ path: file, override: false })
  }
}

function isTrustedRendererOrigin(rawUrl: string, isDev: boolean) {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol === 'file:') {
      const filePath = fileURLToPath(parsed)
      const appPath = app.getAppPath()
      return filePath === appPath || filePath.startsWith(`${appPath}${path.sep}`)
    }
    if (isDev && TRUSTED_DEV_ORIGINS.has(parsed.origin)) return true
    return false
  } catch {
    return false
  }
}

function spkiPinFromPem(pem: string) {
  const cert = new crypto.X509Certificate(pem)
  const spkiDer = cert.publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  return crypto.createHash('sha256').update(spkiDer).digest('base64')
}

function endpointHost(value: string | undefined) {
  if (!value?.trim()) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

function pinnedHosts() {
  const pin = (process.env.ZETASS_POS_CERT_PIN_SHA256 || process.env.VITE_CERT_PIN_SHA256 || DEFAULT_CERT_PIN_SHA256).trim()
  const hosts = [
    endpointHost(process.env.ZETASS_POS_PINNED_DOMAIN ? `https://${process.env.ZETASS_POS_PINNED_DOMAIN}` : undefined),
  ].filter(Boolean) as string[]

  return new Map(Array.from(new Set(hosts)).map(host => [host, new Set([pin])]))
}

export function configureElectronSecurity(isDev: boolean) {
  const defaultSession = session.defaultSession

  const CSP = [
    "default-src 'self'",
    `script-src 'self'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' ws://localhost:* http://localhost:* https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.fonnte.com https://quickchart.io https://script.google.com",
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    })
  })

  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const origin = requestingOrigin || webContents?.getURL() || ''
    if (!isTrustedRendererOrigin(origin, isDev)) return false
    return permission === 'media' || permission === 'notifications' || permission === 'fullscreen'
  })

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details: any) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL()
    if (!isTrustedRendererOrigin(requestingUrl, isDev)) {
      callback(false)
      return
    }

    if (permission === 'media') {
      const mediaTypes = Array.isArray(details?.mediaTypes) ? details.mediaTypes : []
      callback(mediaTypes.length === 0 || mediaTypes.includes('video') || mediaTypes.includes('audio'))
      return
    }

    callback(permission === 'notifications' || permission === 'fullscreen')
  })

  const pins = pinnedHosts()
  defaultSession.setCertificateVerifyProc((request, callback) => {
    const host = request.hostname.toLowerCase()
    const hostPins = pins.get(host)
    if (!hostPins) {
      if (host.endsWith('.supabase.co') || host.endsWith('.supabaseapp.com') || host.includes('unsplash.com') || host.includes('github.com')) {
        callback(0)
        return
      }
      callback(request.verificationResult === 'OK' || isDev ? 0 : -2)
      return
    }

    if (request.verificationResult !== 'OK') {
      callback(-2)
      return
    }

    try {
      const pin = spkiPinFromPem(request.certificate.data)
      callback(hostPins.has(pin) ? 0 : -2)
    } catch {
      callback(-2)
    }
  })
}

export function attachWindowSecurity(win: ElectronBrowserWindow, isDev: boolean) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('customer-display') || isTrustedRendererOrigin(url, isDev)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1024,
          height: 700,
          minWidth: 800,
          minHeight: 500,
          title: 'WariPOS - Customer Display',
          autoHideMenuBar: true,
        },
      }
    }
    void openExternalHttps(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererOrigin(url, isDev)) return
    event.preventDefault()
    void openExternalHttps(url)
  })
}

export async function openExternalHttps(rawUrl: string) {
  const url = String(rawUrl ?? '').trim()
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { success: false, message: 'URL eksternal tidak valid' }
  }

  if (parsed.protocol !== 'https:') {
    return { success: false, message: 'URL eksternal harus menggunakan HTTPS' }
  }

  await shell.openExternal(parsed.toString())
  return { success: true }
}

export function registerDesktopDeepLinks(isDev: boolean) {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])])
    app.setAsDefaultProtocolClient(LEGACY_DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
    app.setAsDefaultProtocolClient(LEGACY_DEEP_LINK_SCHEME)
  }

  pendingDeepLink = extractDeepLink(process.argv)

  app.on('open-url', (event, url) => {
    event.preventDefault()
    pendingDeepLink = url
  })

  const gotSingleInstanceLock = app.requestSingleInstanceLock()
  if (!gotSingleInstanceLock && !isDev) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, argv) => {
    const url = extractDeepLink(argv)
    if (url) pendingDeepLink = url
    const focusedWindow = BrowserWindow.getAllWindows()[0]
    if (focusedWindow) {
      if (focusedWindow.isMinimized()) focusedWindow.restore()
      focusedWindow.focus()
      flushPendingDeepLink(focusedWindow)
    }
  })

  return true
}

function extractDeepLink(argv: string[]) {
  return argv.find(arg => arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}:`) || arg.toLowerCase().startsWith(`${LEGACY_DEEP_LINK_SCHEME}:`)) ?? null
}

function sendDeepLink(win: ElectronBrowserWindow, url: string) {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('app:deepLink', url)
    })
    return
  }

  win.webContents.send('app:deepLink', url)
}

export function flushPendingDeepLink(win: ElectronBrowserWindow) {
  if (!pendingDeepLink) return
  const url = pendingDeepLink
  pendingDeepLink = null
  sendDeepLink(win, url)
}

export function dispatchDeepLink(win: ElectronBrowserWindow, url: string) {
  pendingDeepLink = url
  flushPendingDeepLink(win)
}
