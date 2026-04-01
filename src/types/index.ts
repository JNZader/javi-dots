export type AI_CLI = 'claude' | 'opencode' | 'gemini' | 'qwen' | 'codex' | 'copilot'

export interface SetupOptions {
  clis: AI_CLI[]
  ghagga: boolean
  dryRun: boolean
}

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface SetupStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
}

export interface DoctorCheck {
  name: string
  status: 'ok' | 'fail' | 'skip'
  detail?: string
}

export interface Manifest {
  version: string
  installedAt: string
  updatedAt: string
  clis: AI_CLI[]
  engram: boolean
  sdd: boolean
  ghagga: boolean
}

// ── Multi-Editor Config Sync ────────────────────────────────────────────────

export interface EditorConfig {
  id: AI_CLI
  label: string
  /** Global config directory (e.g. ~/.claude/) */
  globalDir: string
  /** Skills subdirectory (e.g. ~/.claude/skills/) */
  skillsDir: string
  /** Hooks subdirectory if supported */
  hooksDir?: string
  /** Main instruction file (e.g. CLAUDE.md, AGENTS.md) */
  instructionFile?: string
}

export interface SyncStatus {
  editor: AI_CLI
  label: string
  synced: boolean
  skillCount: number
  hookCount: number
  lastSync?: string
}

export interface SyncResult {
  editor: AI_CLI
  skillsCopied: number
  hooksCopied: number
  configsCopied: number
  errors: string[]
}

// ── Profiles ────────────────────────────────────────────────────────────────

export interface Profile {
  name: string
  description: string
  skills: string[]
  hooks: string[]
  createdAt: string
  updatedAt: string
}

export interface ProfilesState {
  active: string | null
  profiles: Record<string, Profile>
}

// ── Health Check ───────────────────────────────────────────────────────────

export type HealthSeverity = 'critical' | 'structural' | 'incremental'

export interface HealthFinding {
  category: 'claude-md' | 'skills' | 'mcp' | 'hooks'
  severity: HealthSeverity
  message: string
  fix: string
}

// ── MCP Auto-Setup ────────────────────────────────────────────────────────

export interface McpServerDef {
  name: string
  npmPackage: string
  command: string
  args: string[]
}

export type McpServerStatus = 'installed' | 'already-present' | 'failed'

// ── Token Tracking (Wolf) ─────────────────────────────────────────────────

export type TokenEventType =
  | 'session-start'
  | 'file-read'
  | 'tool-call'
  | 'thinking'
  | 'output'
  | 'session-end'

export interface TokenEvent {
  type: TokenEventType
  timestamp: number
  file?: string
  tokens?: number
  tool?: string
  detail?: string
  repeatedRead?: boolean
}

export interface SessionReport {
  sessionId: string
  events: number
  byType: Record<string, number>
  topFiles: Array<{ file: string; reads: number }>
  repeatedReads: string[]
  totalTokens: number
}

export interface McpServerResult {
  server: McpServerDef
  status: McpServerStatus
  detail?: string
}

export interface McpSetupResult {
  results: McpServerResult[]
  configPath: string
}
