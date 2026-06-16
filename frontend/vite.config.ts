import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API-Calls werden im Dev an das Backend (Port 9615) weitergereicht.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:9615', changeOrigin: true },
      '/uploads': { target: 'http://localhost:9615', changeOrigin: true },
    },
  },
})
