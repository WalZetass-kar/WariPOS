import { useEffect, useState } from 'react'
import { Network } from '@capacitor/network'

/**
 * Reliable connectivity signal for the hybrid online/offline flow.
 *
 * `navigator.onLine` alone is unreliable inside an Android WebView (it can stay
 * `true` after the radio drops). `@capacitor/network` gives a real native signal
 * on device and transparently falls back to `navigator.onLine` +
 * `online`/`offline` window events on web/Electron, so we use it everywhere and
 * layer the window events on top as an extra nudge.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    try {
      return typeof navigator !== 'undefined' ? navigator.onLine : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => void) | undefined

    const apply = (value: boolean) => {
      if (!cancelled) setIsOnline(value)
    }

    void Network.getStatus()
      .then(status => apply(status.connected))
      .catch(() => {})

    Network.addListener('networkStatusChange', status => apply(status.connected))
      .then(handle => {
        if (cancelled) {
          void handle.remove()
          return
        }
        removeListener = () => void handle.remove()
      })
      .catch(() => {})

    const onOnline = () => apply(true)
    const onOffline = () => apply(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      cancelled = true
      removeListener?.()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { isOnline }
}
