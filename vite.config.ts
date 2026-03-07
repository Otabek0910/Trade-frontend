import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth':      { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/protected': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/products':  { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/receipts':  { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/suppliers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sales':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/customers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/dashboard': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/export':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/users':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/expenses': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/returns': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/audit': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    
    }
  }
})