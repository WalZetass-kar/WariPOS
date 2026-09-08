import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wari.pos',
  appName: 'WariPOS',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
    loggingBehavior: 'none',
    backgroundColor: '#0f172a',
  },
  ios: {
    scheme: 'WariPOS',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
