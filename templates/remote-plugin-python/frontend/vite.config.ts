import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const frontendPort = Number(process.env.D3_REMOTE_FRONTEND_PORT || 5173)

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: __dirname,
  server: {
    host: '0.0.0.0',
    port: frontendPort,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
