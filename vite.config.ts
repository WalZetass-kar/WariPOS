import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Pengujian end-to-end Playwright punya runner sendiri di folder e2e/.
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**', 'e2e/**', 'release/**'],
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/backend/**/*.ts',
        'src/shared/**/*.ts',
        'src/renderer/utils/**/*.ts',
        'src/renderer/contexts/**/*.tsx',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/backend/http/**',
        'src/backend/models/**',
        'src/renderer/utils/secureStorage.ts',
      ],
      thresholds: {
        // Lantai dasar, mencegah cakupan turun diam-diam.
        lines: 15,
        statements: 15,
        functions: 30,
        branches: 35,
        // Modul yang menyentuh uang dan stok punya lantai lebih tinggi.
        'src/backend/controllers/PenjualanController.ts': { lines: 70, statements: 70, functions: 80, branches: 45 },
        'src/backend/controllers/ShiftController.ts': { lines: 85, statements: 85, functions: 65, branches: 35 },
        'src/backend/utils/transaction.ts': { lines: 65, statements: 65, functions: 70, branches: 70 },
        'src/backend/utils/pagination.ts': { lines: 95, statements: 95, functions: 100, branches: 50 },
        'src/backend/services/validation.ts': { lines: 85, statements: 85, functions: 50, branches: 70 },
        'src/backend/services/crypto.ts': { lines: 80, statements: 80, functions: 85, branches: 75 },
        'src/backend/services/csvUtils.ts': { lines: 95, statements: 95, functions: 90, branches: 85 },
        'src/backend/services/loyaltyService.ts': { lines: 40, statements: 40, functions: 33, branches: 65 },
        'src/backend/services/promoService.ts': { lines: 50, statements: 50, functions: 16, branches: 60 },
        'src/backend/middleware/demoGuardV2.ts': { lines: 90, statements: 90, functions: 13, branches: 80 },
        'src/shared/validation.ts': { lines: 85, statements: 85, functions: 65, branches: 80 },
        'src/shared/config/rbac.ts': { lines: 85, statements: 85, functions: 55, branches: 90 },
        'src/shared/licenseSession.ts': { lines: 100, statements: 100, functions: 100, branches: 80 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Let Vite & Rollup handle chunking naturally to prevent circular chunk imports
    minify: 'terser',
    terserOptions: {
      compress: {
        pure_funcs: ['console.log', 'console.debug'],
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
