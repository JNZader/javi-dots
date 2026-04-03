import fs from 'fs'
import path from 'path'
import os from 'os'
import type {
  SetupStep,
  TelemetryMode,
  TelemetrySession,
  TelemetryCache,
  TelemetryPeriodSummary,
  TelemetryReport,
} from '../types/index.js'
import {
  TELEMETRY_CACHE_PATH,
  TELEMETRY_CACHE_VERSION,
  CLAUDE_PROJECTS_DIR,
  MANIFEST_DIR,
} from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── Cache Operations ────────────────────────────────────────────────────

export function loadCache(): TelemetryCache {
  try {
    if (!fs.existsSync(TELEMETRY_CACHE_PATH)) {
      return { version: TELEMETRY_CACHE_VERSION, lastScanAt: 0, sessions: {} }
    }
    const raw = fs.readFileSync(TELEMETRY_CACHE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as TelemetryCache
    if (!parsed.sessions || typeof parsed.sessions !== 'object') {
      return { version: TELEMETRY_CACHE_VERSION, lastScanAt: 0, sessions: {} }
    }
    return parsed
  } catch {
    return { version: TELEMETRY_CACHE_VERSION, lastScanAt: 0, sessions: {} }
  }
}

export function saveCache(cache: TelemetryCache): void {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })
  const tmpPath = TELEMETRY_CACHE_PATH + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(cache, null, 2))
  fs.renameSync(tmpPath, TELEMETRY_CACHE_PATH)
}

// ── Session Parsing ─────────────────────────────────────────────────────

export function parseSessionFile(filePath: string): TelemetrySession | null {
  try {
    if (!fs.existsSync(filePath)) return null

    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length === 0) return null

    const sessionId = path.basename(filePath, '.jsonl')
    const projectDir = path.basename(path.dirname(filePath))
    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let cacheWriteTokens = 0
    let totalCost = 0
    let firstTs = 0
    let lastTs = 0
    const toolCalls: Record<string, number> = {}
    const modelCounts: Record<string, number> = {}
    let messageCount = 0

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>

        // Track timestamps
        const ts = entry['timestamp'] as number | undefined
        if (ts) {
          if (!firstTs) firstTs = ts
          lastTs = ts
        }

        // Track token usage
        const usage = entry['usage'] as Record<string, number> | undefined
        if (usage) {
          inputTokens += (usage['input_tokens'] ?? 0)
          outputTokens += (usage['output_tokens'] ?? 0)
          cacheReadTokens += (usage['cache_read_input_tokens'] ?? 0)
          cacheWriteTokens += (usage['cache_creation_input_tokens'] ?? 0)
          messageCount++
        }

        // Track cost
        const cost = entry['costUSD'] as number | undefined
        if (cost) totalCost += cost

        // Track tool usage
        const toolName = entry['tool_name'] as string | undefined
        if (toolName) {
          toolCalls[toolName] = (toolCalls[toolName] ?? 0) + 1
        }

        // Track models
        const model = entry['model'] as string | undefined
        if (model) {
          modelCounts[model] = (modelCounts[model] ?? 0) + 1
        }
      } catch { /* skip malformed lines */ }
    }

    // Determine primary model (most messages)
    let primaryModel = 'unknown'
    let maxModelCount = 0
    for (const [model, count] of Object.entries(modelCounts)) {
      if (count > maxModelCount) {
        maxModelCount = count
        primaryModel = model
      }
    }

    const durationMinutes = firstTs && lastTs
      ? Math.round((lastTs - firstTs) / 60000)
      : 0

    return {
      sessionId,
      projectDir,
      startTime: firstTs,
      endTime: lastTs,
      durationMinutes,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalCost,
      model: primaryModel,
      toolCalls,
      messageCount,
    }
  } catch {
    return null
  }
}

// ── Session Scanning ────────────────────────────────────────────────────

export function scanSessions(cache: TelemetryCache): TelemetryCache {
  const updated: TelemetryCache = {
    version: TELEMETRY_CACHE_VERSION,
    lastScanAt: Date.now(),
    sessions: { ...cache.sessions },
  }

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return updated

  try {
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR).filter(e => !e.startsWith('.'))

    for (const projectDir of projectDirs) {
      const projectPath = path.join(CLAUDE_PROJECTS_DIR, projectDir)
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue
      } catch { continue }

      let sessionFiles: string[]
      try {
        sessionFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))
      } catch { continue }

      for (const sessionFile of sessionFiles) {
        const sessionId = sessionFile.replace('.jsonl', '')
        // Skip already cached sessions
        if (updated.sessions[sessionId]) continue

        const filePath = path.join(projectPath, sessionFile)
        const session = parseSessionFile(filePath)
        if (session) {
          updated.sessions[sessionId] = session
        }
      }
    }
  } catch { /* dir read error */ }

  return updated
}

// ── Period Aggregation ──────────────────────────────────────────────────

function getDateKey(ts: number, period: 'daily' | 'weekly' | 'monthly'): string {
  const d = new Date(ts)
  if (period === 'daily') {
    return d.toISOString().slice(0, 10) // YYYY-MM-DD
  }
  if (period === 'weekly') {
    // ISO week: get Thursday of the week to determine week number
    const thursday = new Date(d)
    thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
    const yearStart = new Date(thursday.getFullYear(), 0, 1)
    const weekNum = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }
  // monthly
  return d.toISOString().slice(0, 7) // YYYY-MM
}

export function aggregateByPeriod(
  sessions: TelemetrySession[],
  period: 'daily' | 'weekly' | 'monthly',
): TelemetryPeriodSummary[] {
  const groups: Record<string, {
    sessions: TelemetrySession[]
    tokens: number
    cost: number
    models: Record<string, number>
    tools: Record<string, number>
  }> = {}

  for (const session of sessions) {
    if (!session.startTime) continue
    const key = getDateKey(session.startTime, period)
    if (!groups[key]) {
      groups[key] = { sessions: [], tokens: 0, cost: 0, models: {}, tools: {} }
    }
    const g = groups[key]!
    g.sessions.push(session)
    g.tokens += session.inputTokens + session.outputTokens
    g.cost += session.totalCost
    g.models[session.model] = (g.models[session.model] ?? 0) + 1
    for (const [tool, count] of Object.entries(session.toolCalls)) {
      g.tools[tool] = (g.tools[tool] ?? 0) + count
    }
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([periodLabel, g]) => ({
      period: periodLabel,
      sessionCount: g.sessions.length,
      totalTokens: g.tokens,
      totalCost: g.cost,
      topModels: Object.entries(g.models)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([model, count]) => ({ model, count })),
      topTools: Object.entries(g.tools)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tool, count]) => ({ tool, count })),
    }))
}

// ── Orchestrator Entry Point ────────────────────────────────────────────

export async function runTelemetry(mode: TelemetryMode, onStep: StepCallback): Promise<void> {
  report(onStep, 'scan', 'Scanning session data', 'running')

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    report(onStep, 'scan', 'Scanning session data', 'skipped',
      'no Claude Code session data found (~/.claude/projects/)')
    return
  }

  const cache = loadCache()
  const updated = scanSessions(cache)
  saveCache(updated)

  const allSessions = Object.values(updated.sessions)
  const sessionCount = allSessions.length

  if (sessionCount === 0) {
    report(onStep, 'scan', 'Scanning session data', 'skipped', 'no sessions found')
    return
  }

  report(onStep, 'scan', 'Scanning session data', 'done', `${sessionCount} sessions`)

  // Totals
  let totalTokens = 0
  let totalCost = 0
  let totalDuration = 0
  for (const s of allSessions) {
    totalTokens += s.inputTokens + s.outputTokens
    totalCost += s.totalCost
    totalDuration += s.durationMinutes
  }

  report(onStep, 'sessions', 'Total sessions', 'done', String(sessionCount))

  const tokenK = Math.round(totalTokens / 1000)
  report(onStep, 'tokens', 'Total tokens', 'done',
    tokenK > 1000 ? `${(tokenK / 1000).toFixed(1)}M` : `${tokenK}K`)

  report(onStep, 'cost', 'Total cost', 'done', `$${totalCost.toFixed(2)}`)

  const avgDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0
  report(onStep, 'duration', 'Avg session duration', 'done', `${avgDuration} min`)

  if (mode === 'sessions') {
    // Show most recent 10 sessions
    const recent = [...allSessions]
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 10)
    for (const s of recent) {
      const date = s.startTime ? new Date(s.startTime).toISOString().slice(0, 16) : 'unknown'
      report(onStep, `s-${s.sessionId}`, s.sessionId.slice(0, 12), 'done',
        `${date} | ${s.durationMinutes}min | $${s.totalCost.toFixed(2)} | ${s.model}`)
    }
  } else if (mode === 'daily' || mode === 'weekly') {
    const periodSummaries = aggregateByPeriod(allSessions, mode === 'daily' ? 'daily' : 'weekly')
    for (const p of periodSummaries.slice(0, 10)) {
      report(onStep, `p-${p.period}`, p.period, 'done',
        `${p.sessionCount} sessions | ${Math.round(p.totalTokens / 1000)}K tokens | $${p.totalCost.toFixed(2)}`)
    }
  } else {
    // summary mode — show top tools and models
    const allTools: Record<string, number> = {}
    const allModels: Record<string, number> = {}
    for (const s of allSessions) {
      for (const [tool, count] of Object.entries(s.toolCalls)) {
        allTools[tool] = (allTools[tool] ?? 0) + count
      }
      allModels[s.model] = (allModels[s.model] ?? 0) + 1
    }

    const topTools = Object.entries(allTools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}(${count})`)
      .join(', ')
    if (topTools) {
      report(onStep, 'tools', 'Top tools', 'done', topTools)
    }

    const topModels = Object.entries(allModels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name}(${count})`)
      .join(', ')
    if (topModels) {
      report(onStep, 'models', 'Top models', 'done', topModels)
    }
  }
}
