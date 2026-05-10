/**
 * Parse a Google Sheets URL to extract the spreadsheet ID and optional gid.
 *
 * Handles:
 *   https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing
 *   https://docs.google.com/spreadsheets/d/{ID}
 */
export function parseSheetUrl(url: string): { spreadsheetId: string; gid?: string } | null {
  const pattern = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  const match = url.match(pattern)
  if (!match) return null

  const spreadsheetId = match[1]

  // Extract gid from fragment (#gid=0) or query param (?gid=0)
  let gid: string | undefined
  const gidFragmentMatch = url.match(/#gid=(\d+)/)
  if (gidFragmentMatch) {
    gid = gidFragmentMatch[1]
  } else {
    const gidParamMatch = url.match(/[?&]gid=(\d+)/)
    if (gidParamMatch) {
      gid = gidParamMatch[1]
    }
  }

  return { spreadsheetId, gid }
}
