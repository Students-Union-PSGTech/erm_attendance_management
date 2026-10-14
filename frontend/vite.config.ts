import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl =
    env.BACKEND_URL ||
    env.API_URL ||
    env.VITE_BACKEND_URL ||
    env.VITE_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    'http://localhost:4000'

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'BACKEND_', 'API_'],
    define: {
      'import.meta.env.BACKEND_URL': JSON.stringify(backendUrl),
      'import.meta.env.API_URL': JSON.stringify(backendUrl),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
    },
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        }
      }
    }
  }
})
