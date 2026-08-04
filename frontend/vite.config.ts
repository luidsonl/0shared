import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss()
    ],
    server: {
      proxy: {
        // Forward /api/* to the backend. Defaults to a local SAM API
        // (`sam local start-api`); override with VITE_API_BASE (see .env.local).
        '/api': env.VITE_API_BASE || 'http://127.0.0.1:3000'
      }
    },
  }
})
