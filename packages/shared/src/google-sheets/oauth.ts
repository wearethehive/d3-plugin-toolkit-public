/**
 * Google OAuth 2.0 Device Authorization Grant (RFC 8628)
 *
 * Designed for environments without popup/redirect support (e.g. CEF panels).
 * User gets a code, authorizes on any browser, plugin polls for the token.
 */

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const DEFAULT_STORAGE_KEY = 'd3-google-oauth'
const DEVICE_STATE_KEY = 'd3-google-device-state'

// ── Types ──────────────────────────────────────────────────────────

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  scopes: string[]
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_url: string
  expires_in: number
  interval: number
}

export interface TokenData {
  access_token: string
  refresh_token: string
  expires_at: number // epoch ms
  email?: string
}

export interface DeviceFlowState {
  device_code: string
  user_code: string
  verification_url: string
  interval: number
  expires_at: number // epoch ms — device_code stops being valid after this
}

// ── Device Code Request ────────────────────────────────────────────

export async function requestDeviceCode(config: OAuthConfig): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(' '),
  })

  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error_description?: string }
    throw new Error(`Device code request failed: ${err.error_description || response.statusText}`)
  }

  return response.json() as Promise<DeviceCodeResponse>
}

// ── Poll for Token ─────────────────────────────────────────────────

// One-shot poll. Returns:
//   { status: 'pending' }   → authorization_pending; try again later
//   { status: 'slow_down' } → Google asked us to back off; increase interval
//   { status: 'token', tokens } → success
//   throws Error for terminal failures (expired_token, access_denied, invalid_grant, etc.)
export async function pollTokenOnce(
  config: OAuthConfig,
  deviceCode: string,
): Promise<
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'token'; tokens: TokenData }
> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (data.access_token) {
    // Accept access_token even without refresh_token — for re-authorization
    // Google sometimes omits refresh_token. We preserve any previously-saved
    // refresh_token via callers (useGoogleAuth) when this happens.
    const tokens: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? '',
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    }

    try {
      const userResp = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      if (userResp.ok) {
        const userInfo = await userResp.json() as { email?: string }
        tokens.email = userInfo.email
      }
    } catch {
      // Non-fatal
    }

    return { status: 'token', tokens }
  }

  if (data.error === 'authorization_pending') return { status: 'pending' }
  if (data.error === 'slow_down') return { status: 'slow_down' }

  throw new Error(data.error_description || data.error || 'Token polling failed')
}

export async function pollForToken(
  config: OAuthConfig,
  deviceCode: string,
  interval: number,
  signal?: AbortSignal,
): Promise<TokenData> {
  let pollInterval = interval * 1000

  while (true) {
    if (signal?.aborted) throw new Error('Authorization cancelled')
    await sleep(pollInterval, signal)
    if (signal?.aborted) throw new Error('Authorization cancelled')

    const result = await pollTokenOnce(config, deviceCode)
    if (result.status === 'token') return result.tokens
    if (result.status === 'slow_down') pollInterval += 5000
    // 'pending' → keep looping
  }
}

// ── Refresh Token ──────────────────────────────────────────────────

export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
): Promise<TokenData> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error_description?: string; error?: string }
    throw new Error(`Token refresh failed: ${err.error_description || err.error || response.statusText}`)
  }

  const data = await response.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken, // Google may not return a new one
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

// ── Token Storage (localStorage) ───────────────────────────────────

export function loadTokens(storageKey: string = DEFAULT_STORAGE_KEY): TokenData | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenData
    if (!parsed.access_token || !parsed.refresh_token) return null
    return parsed
  } catch {
    return null
  }
}

export function saveTokens(tokens: TokenData, storageKey: string = DEFAULT_STORAGE_KEY): void {
  localStorage.setItem(storageKey, JSON.stringify(tokens))
}

export function clearTokens(storageKey: string = DEFAULT_STORAGE_KEY): void {
  localStorage.removeItem(storageKey)
}

// ── Device Flow State Storage ──────────────────────────────────────
// Persisted so a CEF reopen mid-flow can resume polling on the SAME
// device_code, rather than generating a new code and orphaning any
// authorization the user already gave in their browser.

export function saveDeviceState(state: DeviceFlowState, storageKey: string = DEVICE_STATE_KEY): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

export function loadDeviceState(storageKey: string = DEVICE_STATE_KEY): DeviceFlowState | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DeviceFlowState
    if (!parsed.device_code) return null
    if (Date.now() >= parsed.expires_at) {
      localStorage.removeItem(storageKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearDeviceState(storageKey: string = DEVICE_STATE_KEY): void {
  localStorage.removeItem(storageKey)
}

// ── Token Expiry Check ─────────────────────────────────────────────

export function isTokenExpired(tokens: TokenData, bufferMs: number = 300000): boolean {
  return Date.now() >= tokens.expires_at - bufferMs
}

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Authorization cancelled'))
    }, { once: true })
  })
}
