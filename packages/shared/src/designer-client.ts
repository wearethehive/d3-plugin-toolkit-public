export interface DesignerResponse {
  status: { code: number; message: string; details?: string[] }
  d3Log: string
  pythonLog: string | null
  returnValue: string | null
}

export interface ExecuteOptions {
  host?: string
  port?: number
  timeout?: number
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 80

export async function executePython(
  script: string,
  opts: ExecuteOptions = {}
): Promise<DesignerResponse> {
  const host = opts.host ?? DEFAULT_HOST
  const port = opts.port ?? DEFAULT_PORT
  const url = `http://${host}:${port}/api/session/python/execute`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeout ?? 30000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: controller.signal,
    })

    if (!res.ok) {
      return {
        status: { code: res.status, message: `HTTP ${res.status} ${res.statusText}` },
        d3Log: '',
        pythonLog: null,
        returnValue: null,
      }
    }

    return (await res.json()) as DesignerResponse
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : String(err)
    return {
      status: { code: -1, message },
      d3Log: '',
      pythonLog: null,
      returnValue: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Strip Designer's wrapping quotes, unescape inner quotes and newlines. */
export function cleanReturnValue(raw: string | null): string | null {
  if (raw === null || raw === 'None') return null
  let cleaned = raw
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
    cleaned = cleaned.replace(/\\"/g, '"')
  }
  cleaned = cleaned.replace(/\\n/g, '\n')
  return cleaned
}

/** Parse returnValue as JSON, falling back to the cleaned string. */
export function parseReturnValue(raw: string | null): unknown {
  const cleaned = cleanReturnValue(raw)
  if (cleaned === null) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return cleaned
  }
}

/**
 * Detect the Designer endpoint from the browser URL.
 * Plugins are served at http://{host}/projects/{name}/plugins/{name}?director={host}:{port}
 */
export function getDirectorEndpoint(): string {
  if (typeof window === 'undefined') return `${DEFAULT_HOST}:${DEFAULT_PORT}`

  const params = new URLSearchParams(window.location.search)
  const director = params.get('director')
  if (director) {
    return director.includes(':') ? director : `${director}:${params.get('port') || '80'}`
  }
  const host = window.location.host || 'localhost'
  return host.includes(':') ? host : `${host}:80`
}
