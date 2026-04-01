import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { SetupStep, TokenEvent, TokenEventType, SessionReport } from '../types/index.js'
import { WOLF_DIR, WOLF_SESSIONS_DIR, REPEATED_READ_THRESHOLD } from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── Directory & Session helpers ───────────────────────────────────────────

export function ensureWolfDir(): void {
  fs.mkdirSync(WOLF_SESSIONS_DIR, { recursive: true })
}

export function getCurrentSessionId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const hash = crypto.randomBytes(4).toString('hex')
  return `${date}-${hash}`
}

export function getSessionPath(sessionId: string): string {
  return path.join(WOLF_SESSIONS_DIR, `${sessionId}.jsonl`)
}

// ── Event Recording ───────────────────────────────────────────────────────

export function recordEvent(sessionId: string, event: Omit<TokenEvent, 'timestamp'>): TokenEvent {
  ensureWolfDir()
  const fullEvent: TokenEvent = { ...event, timestamp: Date.now() }
  const sessionPath = getSessionPath(sessionId)
  fs.appendFileSync(sessionPath, JSON.stringify(fullEvent) + '\n')
  return fullEvent
}

// ── Session Parsing ───────────────────────────────────────────────────────

export function parseSessionFile(sessionPath: string): TokenEvent[] {
  if (!fs.existsSync(sessionPath)) return []

  const content = fs.readFileSync(sessionPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const events: TokenEvent[] = []

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as TokenEvent)
    } catch { /* skip malformed lines */ }
  }

  return events
}

// ── Repeated Read Detection ───────────────────────────────────────────────

export function detectRepeatedReads(
  events: TokenEvent[],
  threshold: number = REPEATED_READ_THRESHOLD,
): string[] {
  const fileCounts: Record<string, number> = {}

  for (const event of events) {
    if (event.type === 'file-read' && event.file) {
      fileCounts[event.file] = (fileCounts[event.file] ?? 0) + 1
    }
  }

  return Object.entries(fileCounts)
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file)
}

// ── Session Report ────────────────────────────────────────────────────────

export function getSessionReport(sessionId: string): SessionReport {
  const sessionPath = getSessionPath(sessionId)
  const events = parseSessionFile(sessionPath)

  // Count by type
  const byType: Record<string, number> = {}
  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1
  }

  // Top files by read count
  const fileCounts: Record<string, number> = {}
  for (const event of events) {
    if (event.type === 'file-read' && event.file) {
      fileCounts[event.file] = (fileCounts[event.file] ?? 0) + 1
    }
  }

  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, reads]) => ({ file, reads }))

  // Repeated reads
  const repeatedReads = detectRepeatedReads(events)

  // Total tokens
  let totalTokens = 0
  for (const event of events) {
    if (event.tokens) totalTokens += event.tokens
  }

  return {
    sessionId,
    events: events.length,
    byType,
    topFiles,
    repeatedReads,
    totalTokens,
  }
}

// ── List Sessions ─────────────────────────────────────────────────────────

export function listSessions(): string[] {
  if (!fs.existsSync(WOLF_SESSIONS_DIR)) return []

  return fs.readdirSync(WOLF_SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''))
    .sort()
    .reverse()
}

// ── Orchestrator Entry Point ──────────────────────────────────────────────

export async function runTokenReport(onStep: StepCallback): Promise<void> {
  report(onStep, 'scan', 'Scanning token ledger', 'running')

  if (!fs.existsSync(WOLF_SESSIONS_DIR)) {
    report(onStep, 'scan', 'Scanning token ledger', 'skipped',
      'no .wolf/ directory found — no sessions recorded yet')
    return
  }

  const sessions = listSessions()
  if (sessions.length === 0) {
    report(onStep, 'scan', 'Scanning token ledger', 'skipped', 'no sessions found')
    return
  }

  report(onStep, 'scan', 'Scanning token ledger', 'done', `${sessions.length} sessions found`)

  // Show latest session report
  const latestId = sessions[0]!
  const sessionReport = getSessionReport(latestId)

  report(onStep, 'session', 'Latest session', 'done', latestId)
  report(onStep, 'events', 'Total events', 'done', String(sessionReport.events))

  // Breakdown by type
  const typeBreakdown = Object.entries(sessionReport.byType)
    .map(([type, count]) => `${type}(${count})`)
    .join(', ')
  if (typeBreakdown) {
    report(onStep, 'types', 'Event breakdown', 'done', typeBreakdown)
  }

  // Total tokens
  const tokenK = Math.round(sessionReport.totalTokens / 1000)
  report(onStep, 'tokens', 'Estimated tokens', 'done',
    tokenK > 1000 ? `${(tokenK / 1000).toFixed(1)}M` : `${tokenK}K`)

  // Top files
  if (sessionReport.topFiles.length > 0) {
    const topFilesStr = sessionReport.topFiles
      .slice(0, 5)
      .map(f => `${f.file}(${f.reads}x)`)
      .join(', ')
    report(onStep, 'files', 'Top read files', 'done', topFilesStr)
  }

  // Repeated reads warning
  if (sessionReport.repeatedReads.length > 0) {
    const warnStr = sessionReport.repeatedReads
      .map(f => f)
      .join(', ')
    report(onStep, 'repeated', 'Repeated reads detected', 'error',
      `${sessionReport.repeatedReads.length} files read ${REPEATED_READ_THRESHOLD}+ times: ${warnStr}`)
  } else {
    report(onStep, 'repeated', 'Repeated reads', 'done', 'none detected')
  }
}
