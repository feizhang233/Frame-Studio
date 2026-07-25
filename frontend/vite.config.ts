import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '')
  // Prefer process env (set by scripts/dev.mjs) over .env files.
  const apiTarget =
    process.env.FRAME2D_API_URL
    ?? environment.FRAME2D_API_URL
    ?? 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': apiTarget,
        '/health': apiTarget,
      },
    },
  }
})
