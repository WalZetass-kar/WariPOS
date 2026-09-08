import { secureStorage } from './secureStorage'

export interface RendererAuthDeviceInfo {
  deviceId: string
  deviceName: string
  userAgent: string
  platform: string
  osName: string
  appVersion: string
}

const DEVICE_ID_KEY = 'auth_device_id'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

export function getAuthDeviceId(): string {
  const existing = secureStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing

  const next = randomId()
  secureStorage.setItem(DEVICE_ID_KEY, next)
  return next
}

export function collectAuthDeviceInfo(): RendererAuthDeviceInfo {
  const userAgent = navigator.userAgent || 'unknown'
  const osName = /iPhone|iPad/i.test(userAgent)
    ? 'iOS'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS|Macintosh/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Unknown'

  return {
    deviceId: getAuthDeviceId(),
    deviceName: navigator.platform || 'unknown',
    userAgent,
    platform: osName,
    osName,
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) || '2.1.0',
  }
}
