import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { resolve } from 'path'

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim())
  }
  if (typeof value === 'string' && value.trim()) {
    return [value]
  }
  return []
}

function unique(values) {
  return Array.from(new Set(values))
}

export function deployRootsFromConfig(config, pluginName) {
  const pluginConfig = config?.plugins?.[pluginName]
  const pluginRoots = [
    ...asStringArray(pluginConfig?.deployPaths),
    ...asStringArray(pluginConfig?.deployPath),
  ]
  if (pluginRoots.length > 0) return unique(pluginRoots)

  return unique([
    ...asStringArray(config?.deployPaths),
    ...asStringArray(config?.deployPath),
  ])
}

export function resolveDeployTargets({ pluginName, pluginDir, env = process.env, config = null }) {
  if (env.D3_PLUGIN_OUT) return [resolve(env.D3_PLUGIN_OUT)]

  const roots = deployRootsFromConfig(config, pluginName)
  return unique(roots.map((root) => resolve(root, pluginName)))
}

function readToolkitConfig(pluginDir) {
  try {
    const configPath = resolve(pluginDir, '../../../.d3-toolkit.json')
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return null
  }
}

function copyBuildArtifacts(distDir, deployPath) {
  mkdirSync(deployPath, { recursive: true })

  for (const entry of readdirSync(distDir)) {
    const target = resolve(deployPath, entry)
    try {
      if (statSync(target).isDirectory()) {
        rmSync(target, { recursive: true, force: true })
      } else {
        rmSync(target, { force: true })
      }
    } catch {
      // Missing target is fine; the following copy creates it.
    }
  }

  cpSync(distDir, deployPath, { recursive: true })
}

export function d3DeployCopy(pluginName, pluginDir) {
  return {
    name: 'd3-deploy-copy',
    closeBundle() {
      const config = readToolkitConfig(pluginDir)
      const deployTargets = resolveDeployTargets({ pluginName, pluginDir, config })
      if (deployTargets.length === 0) return

      const distDir = resolve(pluginDir, 'dist')
      if (!existsSync(distDir)) return

      for (const deployPath of deployTargets) {
        copyBuildArtifacts(distDir, deployPath)
        console.log(`\n  Deployed -> ${deployPath}`)
      }
    },
  }
}
