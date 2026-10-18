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
