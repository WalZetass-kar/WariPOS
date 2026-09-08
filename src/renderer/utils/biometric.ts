import { Capacitor } from '@capacitor/core'
import { secureStorage } from './secureStorage'

const BIOMETRIC_ENABLED_KEY = 'zetass_biometric_enabled'
const BIOMETRIC_CREDENTIALS_KEY = 'zetass_biometric_credentials'

export interface BiometricAvailability {
  isAvailable: boolean
  biometryType?: string
  strongBiometry?: boolean
}

class BiometricService {
  /**
   * Check if Native Biometric authentication is supported on this device
   */
  async isAvailable(): Promise<BiometricAvailability> {
    if (!Capacitor.isNativePlatform()) {
      return { isAvailable: false }
    }

    try {
      const module = await import('@capgo/capacitor-native-biometric')
      const result = await module.NativeBiometric.isAvailable({ useFallback: true })
      return {
        isAvailable: result?.isAvailable !== false,
        biometryType: result?.biometryType ? String(result.biometryType) : 'fingerprint',
        strongBiometry: Boolean((result as any)?.strongBiometry),
      }
    } catch {
      // On native Android, biometrics are generally available
      return { isAvailable: Capacitor.isNativePlatform(), biometryType: 'fingerprint' }
    }
  }

  /**
   * Check if biometric login is enabled by the user in settings
   */
  isEnabled(): boolean {
    return secureStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
  }

  /**
   * Enable or disable biometric login
   */
  setEnabled(enabled: boolean) {
    if (!enabled) {
      secureStorage.removeItem(BIOMETRIC_ENABLED_KEY)
      secureStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY)
    } else {
      secureStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
    }
  }

  /**
   * Store user credentials securely for biometric login
   */
  async saveCredentials(username: string, tokenOrPassword: string) {
    if (!Capacitor.isNativePlatform()) return

    try {
      const module = await import('@capgo/capacitor-native-biometric')
      await module.NativeBiometric.setCredentials({
        server: 'com.zetass.pos',
        username,
        password: tokenOrPassword,
      })
    } catch (err) {
      console.warn('[Biometric] Native setCredentials failed, using secureStorage fallback:', err)
    }

    // Always keep encrypted fallback in secureStorage
    secureStorage.setJSON(BIOMETRIC_CREDENTIALS_KEY, { username, tokenOrPassword })
    this.setEnabled(true)
  }

  /**
   * Prompt biometric authentication and retrieve stored credentials
   */
  async authenticate(): Promise<{ success: boolean; username?: string; password?: string; message?: string }> {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, message: 'Autentikasi sidik jari hanya tersedia di aplikasi Android/iOS.' }
    }

    try {
      const module = await import('@capgo/capacitor-native-biometric')
      await module.NativeBiometric.verifyIdentity({
        reason: 'Pindai sidik jari Anda untuk masuk ke WariPOS',
        title: 'Verifikasi Sidik Jari',
        subtitle: 'Konfirmasi identitas kasir / pemilik',
        description: 'Sentuh sensor sidik jari perangkat Anda',
        useFallback: true,
        maxAttempts: 5,
      })

      // Try retrieve credentials from native keychain
      try {
        const creds = await module.NativeBiometric.getCredentials({ server: 'com.zetass.pos' })
        if (creds && creds.username && creds.password) {
          return { success: true, username: creds.username, password: creds.password }
        }
      } catch {}

      // Try retrieve credentials from secure storage fallback
      const fallback = secureStorage.getJSON<{ username: string; tokenOrPassword: string } | null>(BIOMETRIC_CREDENTIALS_KEY, null)
      if (fallback?.username && fallback?.tokenOrPassword) {
        return { success: true, username: fallback.username, password: fallback.tokenOrPassword }
      }

      return { success: true }
    } catch (error: any) {
      const msg = String(error?.message || '')
      if (msg.includes('cancel') || msg.includes('dibatalkan') || msg.includes('USER_CANCELED')) {
        return { success: false, message: 'Verifikasi sidik jari dibatalkan.' }
      }
      if (msg.includes('NOT_ENROLLED') || msg.includes('no biometric enrolled')) {
        return { success: false, message: 'Belum ada sidik jari yang terdaftar di pengaturan HP Anda.' }
      }
      return {
        success: false,
        message: error.message || 'Verifikasi sidik jari gagal atau tidak cocok.',
      }
    }
  }

  /**
   * Clear biometric credentials on logout or user switch
   */
  async clearCredentials() {
    this.setEnabled(false)
    if (Capacitor.isNativePlatform()) {
      try {
        const module = await import('@capgo/capacitor-native-biometric')
        await module.NativeBiometric.deleteCredentials({ server: 'com.zetass.pos' })
      } catch {}
    }
  }
}

export const biometric = new BiometricService()
