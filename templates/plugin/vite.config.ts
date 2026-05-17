import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { designerPythonLoader } from '@disguise-one/designer-pythonapi/vite-loader'
import { checkBuildReady } from '../../../scripts/check-build-ready.mjs'
import { resolve } from 'path'
import { d3DeployCopy } from '../../../scripts/vite/d3-deploy-copy.mjs'

export default defineConfig({
  plugins: [checkBuildReady(resolve(__dirname, 'src')), vue(), designerPythonLoader(), d3DeployCopy('{{pluginName}}', __dirname)],
  base: './', // Critical: relative paths for Designer's embedded server
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
        // Single-chunk output for CEF compatibility
        manualChunks: undefined,
      },
    },
  },
})
