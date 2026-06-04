import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // FinTrack backend (FastAPI + Redis) — new cached quote endpoints.
      // Additive: the legacy /api/finnhub|news|forex|okx rules below still proxy
      // straight to the external APIs until the frontend hooks are migrated to
      // /api/quotes (see backend/README.md "Миграция фронта").
      '/api/quotes': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Auth API (FastAPI). Proxying keeps requests same-origin (localhost:5173)
      // so the HttpOnly access_token cookie works without cross-site issues.
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Profile + subscription API and uploaded avatar static files. Same-origin
      // via the proxy so the auth cookie is sent with every request.
      '/users': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/subscription': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Dashboard layout persistence (GET/PUT /dashboard/config). Same-origin via
      // the proxy so the auth cookie is sent with every request.
      '/dashboard': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/finnhub': {
        target: 'https://finnhub.io/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finnhub/, ''),
      },
      // /api/news now proxied to our own backend (Блок D).
      // The backend handles NewsAPI fetching + AI enrichment internally.
      '/api/news': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/forex': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/forex/, ''),
      },
      '/api/okx': {
        target: 'https://www.okx.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/okx/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // [FIX] исключаем эталонный проект — он не часть FinTrack
    // Дефолтный vitest exclude + наш cryptocurrency-dashboard
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'cryptocurrency-dashboard/**',
    ],
  },
})
