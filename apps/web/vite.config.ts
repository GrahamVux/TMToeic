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
  server: {
    // Same-origin in dev: cookies are first-party. Production uses a Pages Function at /api.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: false },
    },
  },
})
