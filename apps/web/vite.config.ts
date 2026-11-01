import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // The shared package is rebuilt in place. A cached prebundle would keep the old exports and freeze the app on the loading screen.
    exclude: ['@toeic/shared'],
  },
  server: {
    // Windows often resolves localhost to ::1 only, so 127.0.0.1:5173 was refused.
    // Listen on every interface and proxy the API over IPv4, which Nest binds explicitly.
    host: true,
    port: 5173,
    strictPort: true,
    // Same-origin in dev: cookies are first-party. Production uses a Pages Function at /api.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: false },
    },
  },
})
