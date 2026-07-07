import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { AI_CLI, McpServerDef, McpServerResult, McpSetupResult } from '../types/index.js'
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

// ── Per-CLI engram MCP registration (replaces "engram setup <cli>") ────────

/**
 * Resolve the MCP config file path for a given CLI. Returns null for CLIs we
 * do not know how to wire (e.g. unsupported CLI → orchestrator skips with
 * a warning rather than failing).
 */
export function resolveEngramConfigPath(
  cli: AI_CLI,
  homeDir: string = os.homedir(),
): string | null {
  switch (cli) {
    case 'claude':
      return path.join(homeDir, '.claude.json')
    case 'opencode':
      return path.join(homeDir, '.config', 'opencode', 'opencode.json')
    case 'gemini':
      return path.join(homeDir, '.gemini', 'settings.json')
    case 'qwen':
      return path.join(homeDir, '.qwen', 'settings.json')
    case 'codex':
      return path.join(homeDir, '.codex', 'config.toml')
    case 'copilot':
      return path.join(homeDir, '.copilot', 'mcp.json')
    default:
      return null
  }
}

/**
 * Resolve the JSON key under which MCP servers are listed for a given CLI's
 * config file. opencode uses the `mcp` block; Claude Code uses `mcpServers`;
 * other CLIs follow Anthropic MCP convention.
 */
function resolveMcpServersKey(cli: AI_CLI): string {
  switch (cli) {
    case 'opencode':
      return 'mcp'
    case 'claude':
    case 'gemini':
    case 'qwen':
    case 'copilot':
    default:
      return 'mcpServers'
  }
}

/**
 * Register the `engram` MCP server in the per-CLI MCP config, deeply merging
 * into the existing config (preserves user keys). Atomic write via .tmp +
 * rename. Throws on error (does NOT swallow per spec — unlike the previous
 * `engram setup <cli>` call which silently caught-and-ignored failures).
 *
 * Codex uses TOML, not JSON — for codex we currently skip with a clear message
 * rather than approximate TOML round-tripping in this iteration.
 */
export async function registerEngramMcpForCli(
  cli: AI_CLI,
  homeDir: string = os.homedir(),
): Promise<{ configPath: string; action: 'created' | 'updated' | 'skipped' }> {
  const configPath = resolveEngramConfigPath(cli, homeDir)
  if (!configPath) {
    throw new Error(`registerEngramMcpForCli: unsupported CLI '${cli}'`)
  }
  if (cli === 'codex') {
    // Codex uses TOML — out of scope for this iteration's JSON-only writer.
    return { configPath, action: 'skipped' }
  }

  const engramEntry = {
    command: ['engram'],
    args: ['mcp'],
    type: 'local',
  }

  // Read existing
  let config: Record<string, unknown> = {}
  const existed = fs.existsSync(configPath)
  if (existed) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8')
      config = JSON.parse(raw) as Record<string, unknown>
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`registerEngramMcpForCli: failed to parse ${configPath}: ${msg}`)
    }
  }

  const key = resolveMcpServersKey(cli)
  if (!config[key] || typeof config[key] !== 'object') {
    config[key] = {}
  }
  const block = config[key] as Record<string, unknown>

  const action: 'created' | 'updated' = block['engram'] ? 'updated' : 'created'
  block['engram'] = engramEntry

  // Atomic write — .tmp + rename so a crash mid-write doesn't lose the user's
  // original config.
  const dir = path.dirname(configPath)
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  const tmpPath = `${configPath}.tmp`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
    fs.renameSync(tmpPath, configPath)
  } catch (e) {
    try { fs.unlinkSync(tmpPath) } catch {}
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`registerEngramMcpForCli: write to ${configPath} failed: ${msg}`)
  }

  return { configPath, action: existed ? 'updated' : 'created' }
}
