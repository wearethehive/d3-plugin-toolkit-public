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
      // Try to read error details from response body
      try {
        const body = await res.json() as DesignerResponse
        return body
      } catch {
        return {
          status: { code: res.status, message: `HTTP ${res.status} ${res.statusText}` },
          d3Log: '',
          pythonLog: null,
          returnValue: null,
        }
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
  // Designer wraps return values in quotes and escapes inner quotes
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
