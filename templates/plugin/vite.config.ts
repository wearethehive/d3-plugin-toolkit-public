import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { designerPythonLoader } from '@disguise-one/designer-pythonapi/vite-loader'
import { checkBuildReady } from '../../../scripts/check-build-ready.mjs'
import { resolve } from 'path'
import { readFileSync, cpSync, rmSync, mkdirSync } from 'fs'

function getDeployPath(pluginName: string): string | null {
  if (process.env.D3_PLUGIN_OUT) return process.env.D3_PLUGIN_OUT
  try {
    const configPath = resolve(__dirname, '../../../.d3-toolkit.json')
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (config.deployPath) return resolve(config.deployPath, pluginName)
  } catch {
    // No config or no deployPath
  }
  return null
}

function deployCopy(pluginName: string): Plugin {
  const deployPath = getDeployPath(pluginName)
  return {
    name: 'd3-deploy-copy',
    closeBundle() {
      if (!deployPath) return
      const distDir = resolve(__dirname, 'dist')
      mkdirSync(deployPath, { recursive: true })
      rmSync(deployPath, { recursive: true, force: true })
      cpSync(distDir, deployPath, { recursive: true })
      console.log(`\n  Deployed → ${deployPath}`)
    },
  }
}

export default defineConfig({
  plugins: [checkBuildReady(resolve(__dirname, 'src')), vue(), designerPythonLoader(), deployCopy('{{pluginName}}')],
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
