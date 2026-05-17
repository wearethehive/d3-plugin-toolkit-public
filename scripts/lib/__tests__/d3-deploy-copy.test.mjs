import { describe, expect, it } from 'vitest'
import { deployRootsFromConfig, resolveDeployTargets } from '../../vite/d3-deploy-copy.mjs'

describe('d3 deploy config', () => {
  it('uses the top-level deployPath as the default root', () => {
    expect(deployRootsFromConfig({ deployPath: 'D:/Shows/Default/Plugins' }, 'smartGroups')).toEqual([
      'D:/Shows/Default/Plugins',
    ])
  })

  it('lets per-plugin deployPaths replace the default roots', () => {
    const roots = deployRootsFromConfig({
      deployPath: 'D:/Shows/Default/Plugins',
      plugins: {
        smartGroups: {
          deployPaths: ['D:/Shows/A/Plugins', 'D:/Shows/B/Plugins'],
        },
      },
    }, 'smartGroups')

    expect(roots).toEqual(['D:/Shows/A/Plugins', 'D:/Shows/B/Plugins'])
  })

  it('appends the plugin name for configured roots', () => {
    const targets = resolveDeployTargets({
      pluginName: 'smartGroups',
      pluginDir: 'C:/repo/packages/plugins/smartGroups',
      env: {},
      config: { deployPaths: ['D:/Shows/A/Plugins', 'D:/Shows/B/Plugins'] },
    })

    expect(targets.map((target) => target.replace(/\\/g, '/'))).toEqual([
      'D:/Shows/A/Plugins/smartGroups',
      'D:/Shows/B/Plugins/smartGroups',
    ])
  })

  it('treats D3_PLUGIN_OUT as a single exact output path', () => {
    const targets = resolveDeployTargets({
      pluginName: 'smartGroups',
      pluginDir: 'C:/repo/packages/plugins/smartGroups',
      env: { D3_PLUGIN_OUT: 'D:/Manual/smartGroups' },
      config: { deployPath: 'D:/Shows/Default/Plugins' },
    })

    expect(targets[0].replace(/\\/g, '/')).toBe('D:/Manual/smartGroups')
  })
})
