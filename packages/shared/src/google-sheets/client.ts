import type { SheetConfig, SheetData, SheetsValuesResponse, SheetsUpdateResponse, SheetsAppendResponse } from './types.js'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

function defaultRange(config: SheetConfig): string {
  return config.sheetTab ?? 'Sheet1'
}

function authHeaders(config: SheetConfig): Record<string, string> {
  if (!config.accessToken) {
    throw new Error('Write operations require an accessToken in SheetConfig')
  }
  return {
    Authorization: `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  }
}

function keyParam(config: SheetConfig): string {
  if (!config.apiKey) {
    throw new Error('Read operations require an apiKey in SheetConfig')
  }
  return `key=${encodeURIComponent(config.apiKey)}`
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as { error?: { message?: string } }
      detail = body?.error?.message ?? JSON.stringify(body)
    } catch {
      detail = response.statusText
    }
    throw new Error(`Google Sheets API error (${response.status}): ${detail}`)
  }
  return response.json() as Promise<T>
}

export interface SheetsClient {
  readSheet(range?: string): Promise<SheetData>
  writeSheet(range: string, values: string[][]): Promise<SheetsUpdateResponse>
  appendRows(values: string[][]): Promise<SheetsAppendResponse>
  clearSheet(range?: string): Promise<void>
  getSpreadsheetId(): string
}

export function createSheetsClient(config: SheetConfig): SheetsClient {
  const { spreadsheetId } = config

  return {
    async readSheet(range?: string): Promise<SheetData> {
      const effectiveRange = range ?? defaultRange(config)
      let url = `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(effectiveRange)}`
      const fetchHeaders: Record<string, string> = {}

      if (config.accessToken) {
        fetchHeaders['Authorization'] = `Bearer ${config.accessToken}`
      } else {
        url += `?${keyParam(config)}`
      }

      const response = await fetch(url, { headers: fetchHeaders })
      const data = await handleResponse<SheetsValuesResponse>(response)

      const allRows = data.values ?? []
      const sheetHeaders = allRows.length > 0 ? allRows[0] : []
      const rows = allRows.length > 1 ? allRows.slice(1) : []

      return { headers: sheetHeaders, rows, lastRevision: null }
    },

    async writeSheet(range: string, values: string[][]): Promise<SheetsUpdateResponse> {
      const url = `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`

      const response = await fetch(url, {
        method: 'PUT',
        headers: authHeaders(config),
        body: JSON.stringify({
          range,
          majorDimension: 'ROWS',
          values,
        }),
      })

      return handleResponse<SheetsUpdateResponse>(response)
    },

    async appendRows(values: string[][]): Promise<SheetsAppendResponse> {
      const effectiveRange = defaultRange(config)
      const url = `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(effectiveRange)}:append?valueInputOption=USER_ENTERED`

      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(config),
        body: JSON.stringify({
          range: effectiveRange,
          majorDimension: 'ROWS',
          values,
        }),
      })

      return handleResponse<SheetsAppendResponse>(response)
    },

    async clearSheet(range?: string): Promise<void> {
      const effectiveRange = range ?? defaultRange(config)
      const url = `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(effectiveRange)}:clear`

      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(config),
        body: JSON.stringify({}),
      })

      await handleResponse<unknown>(response)
    },

    getSpreadsheetId(): string {
      return spreadsheetId
    },
  }
}
