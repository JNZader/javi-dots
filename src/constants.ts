import os from 'os'
import path from 'path'
import type { AI_CLI, EditorConfig } from './types/index.js'

export const HOME = os.homedir()
export const MANIFEST_DIR = path.join(HOME, '.javidots')
export const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')

/** Central config repository for multi-editor sync */
export const CONFIG_REPO_DIR = path.join(MANIFEST_DIR, 'config')
export const CONFIG_SKILLS_DIR = path.join(CONFIG_REPO_DIR, 'skills')
export const CONFIG_HOOKS_DIR = path.join(CONFIG_REPO_DIR, 'hooks')
export const CONFIG_PROMPTS_DIR = path.join(CONFIG_REPO_DIR, 'prompts')
export const SYNC_STATE_PATH = path.join(MANIFEST_DIR, 'sync-state.json')
export const PROFILES_DIR = path.join(MANIFEST_DIR, 'profiles')
export const PROFILES_STATE_PATH = path.join(MANIFEST_DIR, 'profiles-state.json')

export const CLI_OPTIONS: Array<{ id: AI_CLI; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'gemini', label: 'Gemini CLI' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'codex', label: 'Codex CLI' },
  { id: 'copilot', label: 'GitHub Copilot' },
]

/** Per-editor path mapping for config sync */
export const EDITOR_CONFIGS: EditorConfig[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    globalDir: path.join(HOME, '.claude'),
    skillsDir: path.join(HOME, '.claude', 'skills'),
    hooksDir: path.join(HOME, '.claude', 'hooks'),
    instructionFile: 'CLAUDE.md',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    globalDir: path.join(HOME, '.opencode'),
    skillsDir: path.join(HOME, '.opencode', 'skills'),
    hooksDir: path.join(HOME, '.opencode', 'hooks'),
    instructionFile: 'AGENTS.md',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    globalDir: path.join(HOME, '.gemini'),
    skillsDir: path.join(HOME, '.gemini', 'skills'),
    instructionFile: 'GEMINI.md',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    globalDir: path.join(HOME, '.qwen'),
    skillsDir: path.join(HOME, '.qwen', 'skills'),
    instructionFile: 'QWEN.md',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    globalDir: path.join(HOME, '.codex'),
    skillsDir: path.join(HOME, '.codex', 'skills'),
    instructionFile: 'AGENTS.md',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    globalDir: path.join(HOME, '.github'),
    skillsDir: path.join(HOME, '.github', 'skills'),
    instructionFile: 'copilot-instructions.md',
  },
]
