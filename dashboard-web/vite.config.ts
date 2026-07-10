import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/dashboard/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev-only convenience: proxy API calls to the FastAPI backend so
      // `npm run dev` doesn't need CORS. In production the built SPA is
      // served by the same backend, so /dashboard-api is same-origin.
      '/dashboard-api': 'http://localhost:8000',
    },
  },
})
