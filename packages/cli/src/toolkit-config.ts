import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = resolve(__dirname, '../../..')
export const USER_CONFIG_PATH = join(homedir(), '.d3-plugin-toolkit', 'config.json')

export type KbContributionMode = 'maintainer' | 'community' | 'local-only' | 'off'
export type KbTelemetryConsent = 'on' | 'off'

interface ToolkitTelemetryConfig {
  default?: unknown
  promptOnFirstEligibleProbe?: unknown
  uploadEndpoint?: unknown
}

interface ToolkitConfig {
  kbContributionMode?: unknown
  kbTelemetry?: ToolkitTelemetryConfig
}

interface UserConfig {
  kbTelemetryConsent?: unknown
}

export interface KbContributionSettings {
  mode: KbContributionMode
  modeSource: 'env' | 'repo' | 'default'
  telemetryConsent: KbTelemetryConsent
  telemetryConsentSource: 'env' | 'user' | 'repo-default' | 'default'
  promptOnFirstEligibleProbe: boolean
  uploadEndpoint: string | null
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

function normalizeMode(value: unknown): KbContributionMode | null {
  if (value === 'maintainer' || value === 'community' || value === 'local-only' || value === 'off') {
    return value
  }
  return null
}

function normalizeConsent(value: unknown): KbTelemetryConsent | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return 'on'
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return 'off'
  }
  return null
}

function normalizeEndpoint(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function loadToolkitConfig(root: string = REPO_ROOT): Promise<ToolkitConfig> {
  return (await readJsonFile<ToolkitConfig>(join(root, '.d3-toolkit.json'))) || {}
}

export async function loadUserConfig(): Promise<UserConfig> {
  return (await readJsonFile<UserConfig>(USER_CONFIG_PATH)) || {}
}

export async function setKbTelemetryConsent(consent: KbTelemetryConsent): Promise<void> {
  const current = await loadUserConfig()
  const next = { ...current, kbTelemetryConsent: consent }
  await mkdir(dirname(USER_CONFIG_PATH), { recursive: true })
  await writeFile(USER_CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

export async function resolveKbContributionSettings(root: string = REPO_ROOT): Promise<KbContributionSettings> {
  const [repoConfig, userConfig] = await Promise.all([
    loadToolkitConfig(root),
    loadUserConfig(),
  ])

  const envMode = normalizeMode(process.env.D3TK_KB_MODE)
  const repoMode = normalizeMode(repoConfig.kbContributionMode)
  const mode = envMode || repoMode || 'community'
  const modeSource = envMode ? 'env' : repoMode ? 'repo' : 'default'

  const envConsent = normalizeConsent(process.env.D3TK_TELEMETRY)
  const userConsent = normalizeConsent(userConfig.kbTelemetryConsent)
  const repoDefaultConsent = normalizeConsent(repoConfig.kbTelemetry?.default)
  const telemetryConsent = envConsent || userConsent || repoDefaultConsent || 'off'
  const telemetryConsentSource = envConsent
    ? 'env'
    : userConsent
      ? 'user'
      : repoDefaultConsent
        ? 'repo-default'
        : 'default'

  const uploadEndpoint =
    normalizeEndpoint(process.env.D3TK_KB_UPLOAD_ENDPOINT) ||
    normalizeEndpoint(repoConfig.kbTelemetry?.uploadEndpoint)

  const promptOnFirstEligibleProbe =
    mode === 'community' &&
    Boolean(repoConfig.kbTelemetry?.promptOnFirstEligibleProbe) &&
    !envConsent &&
    !userConsent

  return {
    mode,
    modeSource,
    telemetryConsent,
    telemetryConsentSource,
    promptOnFirstEligibleProbe,
    uploadEndpoint,
  }
}

