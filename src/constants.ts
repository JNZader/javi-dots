import os from 'os'
import path from 'path'
import type { AI_CLI } from './types/index.js'

export const HOME = os.homedir()
export const MANIFEST_DIR = path.join(HOME, '.javidots')
export const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')

export const CLI_OPTIONS: Array<{ id: AI_CLI; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'gemini', label: 'Gemini CLI' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'codex', label: 'Codex CLI' },
  { id: 'copilot', label: 'GitHub Copilot' },
]
