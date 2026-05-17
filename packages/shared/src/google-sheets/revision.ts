import type { DriveFileMetadata } from './types.js'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files'

export interface RevisionTracker {
  checkForChanges(): Promise<boolean>
  getLastModified(): string | null
  reset(): void
}

export function createRevisionTracker(spreadsheetId: string, credential: string, useBearer: boolean = false): RevisionTracker {
  let lastModified: string | null = null

  return {
    async checkForChanges(): Promise<boolean> {
      let url = `${DRIVE_BASE}/${encodeURIComponent(spreadsheetId)}?fields=modifiedTime`
      const headers: Record<string, string> = {}

      if (useBearer) {
        headers['Authorization'] = `Bearer ${credential}`
      } else {
        url += `&key=${encodeURIComponent(credential)}`
      }

      const response = await fetch(url, { headers })
      if (!response.ok) {
        let detail = ''
        try {
          const body = await response.json() as { error?: { message?: string } }
          detail = body?.error?.message ?? JSON.stringify(body)
        } catch {
          detail = response.statusText
        }
        throw new Error(`Google Drive API error (${response.status}): ${detail}`)
      }

      const data = (await response.json()) as DriveFileMetadata
      const currentModified = data.modifiedTime

      if (lastModified === null) {
        lastModified = currentModified
        return false // First check — no baseline to compare against
      }

      if (currentModified !== lastModified) {
        lastModified = currentModified
        return true
      }

      return false
    },

    getLastModified(): string | null {
      return lastModified
    },

    reset(): void {
      lastModified = null
    },
  }
}
