import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl =
    env.BACKEND_URL ||
    env.API_URL ||
    env.VITE_BACKEND_URL ||
    env.VITE_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'BACKEND_', 'API_'],
    define: {
      'import.meta.env.BACKEND_URL': JSON.stringify(backendUrl),
      'import.meta.env.API_URL': JSON.stringify(backendUrl),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
        '@frontend': path.resolve('./frontend/src'),
        '@backend': path.resolve('./backend'),
        '@credentials': path.resolve('./credentials'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
