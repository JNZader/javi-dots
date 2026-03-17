import fs from 'fs'
import path from 'path'
import os from 'os'
import type { SetupStep } from '../types/index.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

const HOME = os.homedir()
const CLAUDE_PROJECTS_DIR = path.join(HOME, '.claude', 'projects')

interface SessionSummary {
  totalSessions: number
  totalTokens: number
  totalCost: number
  toolUsage: Record<string, number>
  topModels: Record<string, number>
  avgSessionDuration: number
  peakHour: number
}

/**
 * Parse Claude Code session JSONL files for analytics.
 */
function parseSessionFiles(dir: string): SessionSummary {
  const summary: SessionSummary = {
    totalSessions: 0,
    totalTokens: 0,
    totalCost: 0,
    toolUsage: {},
    topModels: {},
    avgSessionDuration: 0,
    peakHour: 0,
  }

  if (!fs.existsSync(dir)) return summary

  const hourCounts: Record<number, number> = {}
  let totalDurationMs = 0

  try {
    const projectDirs = fs.readdirSync(dir).filter(e => !e.startsWith('.'))

    for (const projectDir of projectDirs) {
      const projectPath = path.join(dir, projectDir)
      if (!fs.statSync(projectPath).isDirectory()) continue

      const sessionFiles = fs.readdirSync(projectPath)
        .filter(f => f.endsWith('.jsonl'))

      for (const sessionFile of sessionFiles) {
        summary.totalSessions++
        const filePath = path.join(projectPath, sessionFile)
        let firstTs = 0
        let lastTs = 0

        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter(l => l.trim())

          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as Record<string, unknown>

              // Track timestamps
              const ts = entry['timestamp'] as number | undefined
              if (ts) {
                if (!firstTs) firstTs = ts
                lastTs = ts
                const hour = new Date(ts).getHours()
                hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
              }

              // Track token usage
              const tokens = entry['usage'] as Record<string, number> | undefined
              if (tokens) {
                summary.totalTokens += (tokens['input_tokens'] ?? 0) + (tokens['output_tokens'] ?? 0)
              }

              // Track cost
              const cost = entry['costUSD'] as number | undefined
              if (cost) summary.totalCost += cost

              // Track tool usage
              const toolName = entry['tool_name'] as string | undefined
              if (toolName) {
                summary.toolUsage[toolName] = (summary.toolUsage[toolName] ?? 0) + 1
              }

              // Track models
              const model = entry['model'] as string | undefined
              if (model) {
                summary.topModels[model] = (summary.topModels[model] ?? 0) + 1
              }
            } catch { /* skip malformed lines */ }
          }

          if (firstTs && lastTs) {
            totalDurationMs += (lastTs - firstTs)
          }
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* dir read error */ }

  // Calculate peak hour
  let maxCount = 0
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count
      summary.peakHour = Number(hour)
    }
  }

  // Average duration
  if (summary.totalSessions > 0) {
    summary.avgSessionDuration = Math.round(totalDurationMs / summary.totalSessions / 60000)
  }

  return summary
}

/**
 * Show session analytics.
 */
export async function runAnalytics(onStep: StepCallback): Promise<void> {
  report(onStep, 'scan', 'Scanning session data', 'running')

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    report(onStep, 'scan', 'Scanning session data', 'skipped',
      'no Claude Code session data found (~/.claude/projects/)')
    return
  }

  const stats = parseSessionFiles(CLAUDE_PROJECTS_DIR)
  report(onStep, 'scan', 'Scanning session data', 'done',
    `${stats.totalSessions} sessions found`)

  // Sessions
  report(onStep, 'sessions', 'Total sessions', 'done', String(stats.totalSessions))

  // Tokens
  const tokenK = Math.round(stats.totalTokens / 1000)
  report(onStep, 'tokens', 'Total tokens', 'done',
    tokenK > 1000 ? `${(tokenK / 1000).toFixed(1)}M` : `${tokenK}K`)

  // Cost
  report(onStep, 'cost', 'Estimated cost', 'done', `$${stats.totalCost.toFixed(2)}`)

  // Avg duration
  report(onStep, 'duration', 'Avg session duration', 'done', `${stats.avgSessionDuration} min`)

  // Peak hour
  report(onStep, 'peak', 'Peak coding hour', 'done', `${stats.peakHour}:00`)

  // Top tools
  const topTools = Object.entries(stats.toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ')
  if (topTools) {
    report(onStep, 'tools', 'Top tools', 'done', topTools)
  }

  // Top models
  const topModels = Object.entries(stats.topModels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ')
  if (topModels) {
    report(onStep, 'models', 'Top models', 'done', topModels)
  }
}

/**
 * Check installed agent versions.
 */
export async function runVersionCheck(onStep: StepCallback): Promise<void> {
  report(onStep, 'versions', 'Checking agent versions', 'running')

  const agents = [
    { name: 'Claude Code', cmd: 'claude', args: ['--version'] },
    { name: 'Codex CLI', cmd: 'codex', args: ['--version'] },
    { name: 'Gemini CLI', cmd: 'gemini', args: ['--version'] },
    { name: 'OpenCode', cmd: 'opencode', args: ['version'] },
  ]

  const { execFileSync } = await import('child_process')

  for (const agent of agents) {
    try {
      const version = execFileSync(agent.cmd, agent.args, { timeout: 5000 })
        .toString().trim().split('\n')[0]
      report(onStep, `ver-${agent.cmd}`, agent.name, 'done', version ?? 'installed')
    } catch {
      report(onStep, `ver-${agent.cmd}`, agent.name, 'skipped', 'not found')
    }
  }
}
