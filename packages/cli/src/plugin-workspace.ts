import fsExtra from 'fs-extra'
import { dirname, join } from 'path'

const { pathExists, readFile } = fsExtra

export type PluginKind = 'local' | 'remote'
export type RemoteBackend = 'python' | 'node'

export interface ToolkitPluginManifest {
  kind: PluginKind
  name?: string
  title?: string
  requiresSession?: boolean
  backend?: RemoteBackend
}

export interface PluginWorkspace {
  name: string
  kind: PluginKind
  dir: string
  manifest: ToolkitPluginManifest | null
}

export const TOOLKIT_PLUGIN_MANIFEST = 'd3-toolkit.plugin.json'

/** Walk up from cwd until we find the repo root. */
export async function findRepoRoot(from: string): Promise<string> {
  let dir = from
  while (true) {
    if (
      await pathExists(join(dir, 'packages', 'cli')) &&
      await pathExists(join(dir, 'packages', 'shared'))
    ) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error('Could not find repo root (no packages/cli + packages/shared ancestor)')
    dir = parent
  }
}

export function pluginRootForKind(repoRoot: string, kind: PluginKind): string {
  return join(repoRoot, 'packages', kind === 'remote' ? 'remote-plugins' : 'plugins')
}

export function pluginDirForKind(repoRoot: string, name: string, kind: PluginKind): string {
  return join(pluginRootForKind(repoRoot, kind), name)
}

export function validatePluginKind(value: string): PluginKind {
  if (value === 'local' || value === 'remote') return value
  throw new Error(`Invalid plugin type "${value}". Use "local" or "remote".`)
}

export function validateRemoteBackend(value: string): RemoteBackend {
  if (value === 'python' || value === 'node') return value
  throw new Error(`Invalid remote backend "${value}". Use "python" or "node".`)
}

async function readManifest(dir: string): Promise<ToolkitPluginManifest | null> {
  const manifestPath = join(dir, TOOLKIT_PLUGIN_MANIFEST)
  if (!(await pathExists(manifestPath))) return null

  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8')) as ToolkitPluginManifest
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not read ${manifestPath}: ${message}`)
  }
}

export async function findPluginWorkspace(repoRoot: string, name: string): Promise<PluginWorkspace | null> {
  const localDir = pluginDirForKind(repoRoot, name, 'local')
  const remoteDir = pluginDirForKind(repoRoot, name, 'remote')
  const localExists = await pathExists(localDir)
  const remoteExists = await pathExists(remoteDir)

  if (localExists && remoteExists) {
    throw new Error(`Plugin name exists in both local and remote workspaces: ${name}`)
  }

  if (remoteExists) {
    const manifest = await readManifest(remoteDir)
    return {
      name,
      kind: manifest?.kind ?? 'remote',
      dir: remoteDir,
      manifest,
    }
  }

  if (localExists) {
    const manifest = await readManifest(localDir)
    return {
      name,
      kind: manifest?.kind ?? 'local',
      dir: localDir,
      manifest,
    }
  }

  return null
}

