import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const createPolymarketProxy = () => ({
  '/api/polymarket': {
    target: 'https://polymarket.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api\/polymarket/, '/api'),
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: createPolymarketProxy(),
  },
  preview: {
    proxy: createPolymarketProxy(),
  },
})
