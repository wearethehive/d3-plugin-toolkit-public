import { appendFile, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KB_ROOT = join(__dirname, '../../knowledge-base')

export interface TestResult {
  expression: string
  result: unknown
  statusCode: number
  d3Log: string
  pythonLog: string | null
  timestamp: string
  tag?: string
}

export interface ProbeResult {
  target: string
  typeName: string
  attributes: Array<{
    name: string
    type: string
    callable: boolean
    value?: string
    error?: string
  }>
  timestamp: string
}

/** Append a test result to the append-only log. */
export async function recordTestResult(result: TestResult): Promise<void> {
  const logPath = join(KB_ROOT, 'test-log.jsonl')
  await ensureDir(dirname(logPath))
  await appendFile(logPath, JSON.stringify(result) + '\n', 'utf-8')
}

/** Append a probe result to the append-only log. */
export async function recordProbeResult(result: ProbeResult): Promise<void> {
  const logPath = join(KB_ROOT, 'test-log.jsonl')
  await ensureDir(dirname(logPath))
  await appendFile(logPath, JSON.stringify({ type: 'probe', ...result }) + '\n', 'utf-8')
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // already exists
  }
}
