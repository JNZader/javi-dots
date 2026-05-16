export type AI_CLI = 'claude' | 'opencode' | 'gemini' | 'qwen' | 'codex' | 'copilot'

export type HookProfileId = 'minimal' | 'standard' | 'strict' | null

export interface SetupOptions {
  clis: AI_CLI[]
  ghagga: boolean
  kiteguard: boolean
  hookProfile: HookProfileId
  agentWorkspace: boolean
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
  kiteguard: boolean
  rtk: boolean
}

// ── Portable Workstation Replication ───────────────────────────────────────

export type PortableReplicationFeature =
  | 'skills'
  | 'configs'
  | 'hooks'
  | 'plugins'
  | 'orchestrators'
  | 'engram'
  | 'sdd'

export type PortableReplicationTool =
  | 'engram'
  | 'agent-teams-lite'
  | 'ghagga'
  | 'kiteguard'
  | 'rtk'

export interface PortableReplicationProfile {
  version: number
  generatedAt: string
  source: 'javi-dots'
  clis: AI_CLI[]
  preset: 'minimal' | 'full' | 'custom'
  features: PortableReplicationFeature[]
  tools: PortableReplicationTool[]
  mcpServers: string[]
  excludedState: string[]
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

export interface SignalToNoiseResult {
  signalLines: number
  noiseLines: number
  totalLines: number
  ratio: number // 0-100
}

export interface TokenCostEntry {
  source: string
  tokens: number
  category: 'claude-md' | 'skill' | 'mcp' | 'settings'
}

export interface TokenCostBreakdown {
  entries: TokenCostEntry[]
  total: number
}

export interface HealthReport {
  findings: HealthFinding[]
  score: number // 0-100
  tokenCosts: TokenCostBreakdown
  signalToNoise: SignalToNoiseResult | null
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

// ── Nano Mode (SDD-lite) ─────────────────────────────────────────────────

export type NanoPhaseId = 'challenge' | 'plan' | 'build' | 'review'

export interface NanoPhase {
  id: NanoPhaseId
  label: string
  status: 'pending' | 'running' | 'done' | 'error' | 'escalated'
  detail?: string
}

export interface NanoResult {
  description: string
  slug: string
  risk: 'low' | 'medium' | 'high'
  filesModified: number
  filesCreated: number
  testsPassed: boolean
  escalated: boolean
  escalationReason?: string
  phases: NanoPhase[]
  skillPath: string | null
}

// ── Token Lifecycle Hooks ────────────────────────────────────────────────

export type TokenHookMode = 'warn' | 'block'

export interface TokenAnatomyEntry {
  file: string
  readCount: number
  totalTokens: number
  firstRead: number
  lastRead: number
}

export interface TokenWasteReport {
  totalRepeatedReads: number
  estimatedWastedTokens: number
  savingsPercent: number
}

export interface TokenHookStatus {
  installed: boolean
  mode: TokenHookMode | null
}

// ── Security Hooks ──────────────────────────────────────────────────────

// ── Telemetry ───────────────────────────────────────────────────────────

export type TelemetryMode = 'summary' | 'sessions' | 'daily' | 'weekly'

export interface TelemetrySession {
  sessionId: string
  projectDir: string
  startTime: number
  endTime: number
  durationMinutes: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalCost: number
  model: string
  toolCalls: Record<string, number>
  messageCount: number
}

export interface TelemetryCache {
  version: number
  lastScanAt: number
  sessions: Record<string, TelemetrySession>
}

export interface TelemetryPeriodSummary {
  period: string
  sessionCount: number
  totalTokens: number
  totalCost: number
  topModels: Array<{ model: string; count: number }>
  topTools: Array<{ tool: string; count: number }>
}

export interface TelemetryReport {
  sessions: TelemetrySession[]
  totals: {
    sessions: number
    tokens: number
    cost: number
    duration: number
  }
  byPeriod: TelemetryPeriodSummary[]
}

// ── Security Hooks ──────────────────────────────────────────────────────

export type SecurityCategory = 'destructive' | 'remote-exec' | 'reverse-shell' | 'credential-read' | 'package-unsafe' | 'git-dangerous' | 'custom'

export interface SecurityRule {
  id: string
  pattern: string
  category: SecurityCategory
  description: string
  enabled: boolean
}

export interface SecurityAuditResult {
  totalRules: number
  enabledRules: number
  categories: Array<{ category: string; count: number }>
  hookInstalled: boolean
  guardScriptExists: boolean
  missingCategories: string[]
}
