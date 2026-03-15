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
