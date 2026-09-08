import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    obfuscatorPlugin({
      apply: 'build',
      exclude: [/node_modules/],
      options: {
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        ignoreImports: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.6,
        rotateStringArray: true,
        deadCodeInjection: false,
        controlFlowFlattening: false,
        selfDefending: false,
      },
    }),
  ],
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('recharts')) return 'vendor-charts'
          if (id.includes('@tanstack')) return 'vendor-table'
          if (id.includes('jspdf') || id.includes('xlsx') || id.includes('exceljs')) return 'vendor-export'
          if (id.includes('@capacitor')) return 'vendor-capacitor'
          if (id.includes('i18next')) return 'vendor-i18n'
          if (id.includes('react')) return 'vendor-react'
          if (id.includes('drizzle-orm')) return 'vendor-database'
          if (id.includes('better-sqlite3')) return 'vendor-database'
          if (id.includes('crypto-js') || id.includes('crypto')) return 'vendor-crypto'
          if (id.includes('axios') || id.includes('node-fetch')) return 'vendor-http'
          if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) return 'vendor-dates'
          if (id.includes('dompurify') || id.includes('sanitize')) return 'vendor-security'
          const parts = id.split('node_modules/')
          if (parts.length > 1) {
            const scopeMatch = parts[1].match(/^(@[^/]+\/[^/]+)/)
            if (scopeMatch) {
              return `vendor-${scopeMatch[1].replace('/', '-')}`
            }
            const pkg = parts[1].split('/')[0]
            if (pkg && pkg !== '.pnpm') return `vendor-${pkg}`
          }
          return undefined
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/dist-electron/**', '**/release/**', '**/packages/**'],
    },
  },
  optimizeDeps: {
    entries: ['./index.html', './src/renderer/**/*.tsx', './src/renderer/**/*.ts'],
  },
})
