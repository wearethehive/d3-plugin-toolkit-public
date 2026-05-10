export interface SheetConfig {
  apiKey?: string
  accessToken?: string
  spreadsheetId: string
  sheetTab?: string // defaults to 'Sheet1'
}

export interface SheetRevision {
  modifiedTime: string
  revisionId: string
}

/** Raw row from the spreadsheet — always string[] */
export type SheetRow = string[]

export interface SheetData {
  rows: SheetRow[]
  headers: SheetRow
  lastRevision: SheetRevision | null
}

/** Response shape from Sheets API v4 values.get */
export interface SheetsValuesResponse {
  range: string
  majorDimension: string
  values?: string[][]
}

/** Response shape from Sheets API v4 values.update */
export interface SheetsUpdateResponse {
  spreadsheetId: string
  updatedRange: string
  updatedRows: number
  updatedColumns: number
  updatedCells: number
}

/** Response shape from Sheets API v4 values.append */
export interface SheetsAppendResponse {
  spreadsheetId: string
  tableRange: string
  updates: SheetsUpdateResponse
}

/** Response shape from Drive API v3 files.get (fields=modifiedTime) */
export interface DriveFileMetadata {
  modifiedTime: string
}
