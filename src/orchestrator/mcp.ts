import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { McpServerDef, McpServerResult, McpSetupResult } from '../types/index.js'
import { DEFAULT_MCP_SERVERS, CLAUDE_JSON_PATH, MCP_CONFIG_PATHS } from '../constants.js'
import { which } from './utils.js'

const execFileAsync = promisify(execFile)

// ── Detection ─────────────────────────────────────────────────────────────

/**
 * Read all MCP config files and return the set of already-configured server names.
 */
export function detectConfigured(): Set<string> {
  const configured = new Set<string>()

  for (const configPath of MCP_CONFIG_PATHS) {
    let content: string
    try {
      content = fs.readFileSync(configPath, 'utf-8')
    } catch {
      continue
    }

    let config: Record<string, unknown>
    try {
      config = JSON.parse(content)
    } catch {
      continue
    }

    const mcpServers = (config['mcpServers'] ?? {}) as Record<string, unknown>
    for (const name of Object.keys(mcpServers)) {
      configured.add(name)
    }
  }

  return configured
}

// ── Installation ──────────────────────────────────────────────────────────

/**
 * Install a single MCP server: add config entry to ~/.claude.json.
 * Returns the result with status.
 */
export async function installServer(
  server: McpServerDef,
  configPath: string,
  dryRun: boolean,
): Promise<McpServerResult> {
  if (dryRun) {
    return { server, status: 'installed', detail: 'dry-run' }
  }

  try {
    // Read existing config or create empty
    let config: Record<string, unknown> = {}
    try {
      const raw = fs.readFileSync(configPath, 'utf-8')
      config = JSON.parse(raw)
    } catch {
      // File doesn't exist or invalid — start fresh
    }

    // Ensure mcpServers key exists
    if (!config['mcpServers'] || typeof config['mcpServers'] !== 'object') {
      config['mcpServers'] = {}
    }

    const mcpServers = config['mcpServers'] as Record<string, unknown>

    // Add the server entry
    mcpServers[server.name] = {
      command: server.command,
      args: server.args,
    }

    // Write back
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    return { server, status: 'installed', detail: `Added to ${configPath}` }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { server, status: 'failed', detail: msg }
  }
}

// ── Validation ────────────────────────────────────────────────────────────

/**
 * Validate a server by checking if its command binary exists in PATH.
 */
export async function validateServer(server: McpServerDef): Promise<boolean> {
  const bin = server.command.split(/\s+/)[0]!
  const resolved = await which(bin)
  return resolved !== null
}

// ── Aggregated Setup ──────────────────────────────────────────────────────

export async function runMcpSetup(dryRun: boolean): Promise<McpSetupResult> {
  const configured = detectConfigured()
  const results: McpServerResult[] = []

  for (const server of DEFAULT_MCP_SERVERS) {
    // Already configured — skip
    if (configured.has(server.name)) {
      results.push({ server, status: 'already-present' })
      continue
    }

    // Install
    const installResult = await installServer(server, CLAUDE_JSON_PATH, dryRun)

    // Validate if install succeeded (and not dry-run)
    if (installResult.status === 'installed' && !dryRun) {
      const valid = await validateServer(server)
      if (!valid) {
        installResult.detail = `Configured but command "${server.command}" not found in PATH`
      }
    }

    results.push(installResult)
  }

  return { results, configPath: CLAUDE_JSON_PATH }
}
