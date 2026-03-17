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
