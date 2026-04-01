import fs from 'fs'
import path from 'path'
import type { HealthFinding, HealthSeverity } from '../types/index.js'
import {
  CLAUDE_MD_PATH,
  SKILLS_DIR,
  MCP_CONFIG_PATHS,
  SETTINGS_PATH,
  CLAUDE_MD_TOKEN_LIMIT,
  DANGEROUS_COMMANDS,
} from '../constants.js'
import { readFileIfExists, tokenEstimate, which } from './utils.js'

// ── Severity ordering (lower = more critical) ──────────────────────────────
const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  structural: 1,
  incremental: 2,
}

// ── checkClaudeMd ──────────────────────────────────────────────────────────

export function checkClaudeMd(): HealthFinding[] {
  const findings: HealthFinding[] = []
  const content = readFileIfExists(CLAUDE_MD_PATH)

  if (!content) return findings

  // Token count warning
  const tokens = tokenEstimate(content)
  if (tokens > CLAUDE_MD_TOKEN_LIMIT) {
    findings.push({
      category: 'claude-md',
      severity: 'structural',
      message: `CLAUDE.md is ${tokens} tokens (limit: ${CLAUDE_MD_TOKEN_LIMIT})`,
      fix: 'Split large sections into skills or remove unused rules',
    })
  }

  // Dead file references
  const fileRefPattern = /[`~]([~]?[/.][^\s`'",)>\]]+)/g
  const lines = content.split('\n')
  const seen = new Set<string>()

  for (const line of lines) {
    let match: RegExpExecArray | null
    fileRefPattern.lastIndex = 0
    while ((match = fileRefPattern.exec(line)) !== null) {
      const ref = match[1]!
      // Only check paths that look like actual file references
      if (!ref.includes('.') && !ref.endsWith('/')) continue
      // Skip URLs
      if (ref.includes('://') || ref.startsWith('//')) continue
      // Skip common non-path patterns
      if (ref.startsWith('.claude/') || ref.startsWith('./')) {
        // These are relative — skip
        continue
      }

      const resolved = ref.startsWith('~')
        ? ref.replace(/^~/, process.env['HOME'] ?? '')
        : ref

      if (seen.has(resolved)) continue
      seen.add(resolved)

      if (!fs.existsSync(resolved)) {
        findings.push({
          category: 'claude-md',
          severity: 'critical',
          message: `Dead file reference: ${ref}`,
          fix: `Remove the reference or create the file at ${ref}`,
        })
      }
    }
  }

  // Duplicate rules detection (exact line duplicates, ignoring blanks/headers)
  const ruleLines = lines
    .map((l, i) => ({ text: l.trim(), line: i + 1 }))
    .filter(({ text }) =>
      text.length > 10 &&
      !text.startsWith('#') &&
      !text.startsWith('|') &&
      !text.startsWith('```') &&
      !text.startsWith('---')
    )

  const duplicateMap = new Map<string, number[]>()
  for (const { text, line } of ruleLines) {
    const existing = duplicateMap.get(text)
    if (existing) {
      existing.push(line)
    } else {
      duplicateMap.set(text, [line])
    }
  }

  for (const [text, lineNums] of duplicateMap) {
    if (lineNums.length > 1) {
      findings.push({
        category: 'claude-md',
        severity: 'incremental',
        message: `Duplicate rule on lines ${lineNums.join(', ')}: "${text.slice(0, 60)}..."`,
        fix: 'Remove the duplicate line — keep only one instance',
      })
    }
  }

  return findings
}

// ── checkSkills ────────────────────────────────────────────────────────────

export function checkSkills(): HealthFinding[] {
  const findings: HealthFinding[] = []

  if (!fs.existsSync(SKILLS_DIR)) return findings

  let entries: string[]
  try {
    entries = fs.readdirSync(SKILLS_DIR)
  } catch {
    return findings
  }

  for (const entry of entries) {
    const skillDir = path.join(SKILLS_DIR, entry)

    // Only check directories
    let stat: fs.Stats
    try {
      stat = fs.statSync(skillDir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    // Skip _shared and hidden directories
    if (entry.startsWith('_') || entry.startsWith('.')) continue

    const skillFile = path.join(skillDir, 'SKILL.md')

    if (!fs.existsSync(skillFile)) {
      findings.push({
        category: 'skills',
        severity: 'structural',
        message: `Skill directory "${entry}" has no SKILL.md`,
        fix: `Create ${skillFile} with YAML frontmatter (name, description)`,
      })
      continue
    }

    // Check frontmatter
    const content = readFileIfExists(skillFile)
    if (!content) continue

    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
      findings.push({
        category: 'skills',
        severity: 'incremental',
        message: `Skill "${entry}": SKILL.md missing YAML frontmatter`,
        fix: `Add --- frontmatter with name and description to ${skillFile}`,
      })
      continue
    }

    const frontmatter = frontmatterMatch[1]!
    const missingFields: string[] = []
    if (!frontmatter.includes('name:')) missingFields.push('name')
    if (!frontmatter.includes('description')) missingFields.push('description')

    if (missingFields.length > 0) {
      findings.push({
        category: 'skills',
        severity: 'incremental',
        message: `Skill "${entry}": frontmatter missing ${missingFields.join(', ')}`,
        fix: `Add ${missingFields.join(' and ')} to the YAML frontmatter in ${skillFile}`,
      })
    }
  }

  return findings
}

// ── checkMcpConfig ─────────────────────────────────────────────────────────

export async function checkMcpConfig(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = []

  for (const configPath of MCP_CONFIG_PATHS) {
    const content = readFileIfExists(configPath)
    if (!content) continue

    let config: Record<string, unknown>
    try {
      config = JSON.parse(content)
    } catch {
      findings.push({
        category: 'mcp',
        severity: 'critical',
        message: `Invalid JSON in ${configPath}`,
        fix: 'Fix the JSON syntax errors in the MCP config file',
      })
      continue
    }

    // Extract mcpServers — could be at root or nested
    const mcpServers = (config['mcpServers'] ?? config['mcp_servers'] ?? {}) as Record<string, unknown>

    const allToolNames: Array<{ server: string; tool: string }> = []

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      if (!serverConfig || typeof serverConfig !== 'object') continue
      const server = serverConfig as Record<string, unknown>
      const command = server['command'] as string | undefined

      // Check if command binary exists
      if (command) {
        const bin = command.split(/\s+/)[0]!
        const resolved = await which(bin)
        if (!resolved) {
          findings.push({
            category: 'mcp',
            severity: 'critical',
            message: `MCP server "${serverName}": command "${bin}" not found in PATH`,
            fix: `Install ${bin} or update the command in ${configPath}`,
          })
        }
      }

      // Collect tool names for duplicate detection
      const tools = server['tools'] as string[] | undefined
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          allToolNames.push({ server: serverName, tool })
        }
      }
    }

    // Detect duplicate tool names across servers
    const toolMap = new Map<string, string[]>()
    for (const { server, tool } of allToolNames) {
      const existing = toolMap.get(tool)
      if (existing) {
        existing.push(server)
      } else {
        toolMap.set(tool, [server])
      }
    }

    for (const [tool, servers] of toolMap) {
      if (servers.length > 1) {
        findings.push({
          category: 'mcp',
          severity: 'structural',
          message: `Duplicate tool "${tool}" in servers: ${servers.join(', ')}`,
          fix: `Remove the duplicate tool definition from one of the servers in ${configPath}`,
        })
      }
    }
  }

  return findings
}

// ── checkHooks ─────────────────────────────────────────────────────────────

export function checkHooks(): HealthFinding[] {
  const findings: HealthFinding[] = []
  const content = readFileIfExists(SETTINGS_PATH)

  if (!content) return findings

  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(content)
  } catch {
    findings.push({
      category: 'hooks',
      severity: 'critical',
      message: 'Invalid JSON in settings.json',
      fix: 'Fix the JSON syntax errors in ~/.claude/settings.json',
    })
    return findings
  }

  const hooks = settings['hooks'] as Record<string, unknown> | undefined
  if (!hooks || typeof hooks !== 'object') return findings

  // Hooks can be structured as { event: [...commands] } or { event: { command: "..." } }
  for (const [hookName, hookValue] of Object.entries(hooks)) {
    const commands: string[] = []

    if (Array.isArray(hookValue)) {
      for (const entry of hookValue) {
        if (typeof entry === 'string') {
          commands.push(entry)
        } else if (entry && typeof entry === 'object') {
          const cmd = (entry as Record<string, unknown>)['command']
          if (typeof cmd === 'string') commands.push(cmd)
        }
      }
    } else if (hookValue && typeof hookValue === 'object') {
      const cmd = (hookValue as Record<string, unknown>)['command']
      if (typeof cmd === 'string') commands.push(cmd)
    }

    for (const cmd of commands) {
      // Check for dangerous commands
      for (const dangerous of DANGEROUS_COMMANDS) {
        if (cmd.includes(dangerous)) {
          findings.push({
            category: 'hooks',
            severity: 'critical',
            message: `Hook "${hookName}" contains dangerous command: ${dangerous}`,
            fix: `Review and remove or safeguard "${dangerous}" in the ${hookName} hook`,
          })
        }
      }

      // Check for missing script references
      const scriptMatch = cmd.match(/(?:bash|sh|zsh|node|python)\s+([^\s;|&]+)/)
      if (scriptMatch) {
        const scriptPath = scriptMatch[1]!
        const resolved = scriptPath.startsWith('~')
          ? scriptPath.replace(/^~/, process.env['HOME'] ?? '')
          : scriptPath

        if (!fs.existsSync(resolved)) {
          findings.push({
            category: 'hooks',
            severity: 'structural',
            message: `Hook "${hookName}" references missing script: ${scriptPath}`,
            fix: `Create the script at ${scriptPath} or update the hook command`,
          })
        }
      }
    }
  }

  return findings
}

// ── runHealth (aggregator) ─────────────────────────────────────────────────

export async function runHealth(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [
    ...checkClaudeMd(),
    ...checkSkills(),
    ...(await checkMcpConfig()),
    ...checkHooks(),
  ]

  // Sort by severity: critical → structural → incremental
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return findings
}
