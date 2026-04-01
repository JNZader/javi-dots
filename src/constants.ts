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

// ── ESP (Claude ESP Tmux Integration) ─────────────────────────────────────
export const TMUX_CONF_PATH = path.join(HOME, '.tmux.conf')
export const ESP_TOGGLE_SCRIPT_PATH = path.join(MANIFEST_DIR, 'esp-toggle.sh')
export const ESP_BINDING_LINE = `bind-key C-e run-shell "${ESP_TOGGLE_SCRIPT_PATH}"`

// ── Health Check Paths ─────────────────────────────────────────────────────
export const CLAUDE_MD_PATH = path.join(HOME, '.claude', 'CLAUDE.md')
export const SKILLS_DIR = path.join(HOME, '.claude', 'skills')
export const MCP_CONFIG_PATHS = [
  path.join(HOME, '.claude.json'),
  path.join(HOME, '.config', 'Claude', 'claude_desktop_config.json'),
]
export const SETTINGS_PATH = path.join(HOME, '.claude', 'settings.json')

// ── Health Check Thresholds ────────────────────────────────────────────────
export const CLAUDE_MD_TOKEN_LIMIT = 5000
export const MAX_SKILL_SIZE = 50_000 // bytes
export const DANGEROUS_COMMANDS = [
  'rm -rf',
  'git push --force',
  'git push -f',
  'git reset --hard',
  'git checkout .',
  'git clean -f',
  'git restore .',
  'rm -r /',
  'dd if=',
  'mkfs.',
  ':(){',
]

// ── MCP Auto-Setup ────────────────────────────────────────────────────────
export const CLAUDE_JSON_PATH = path.join(HOME, '.claude.json')

export const DEFAULT_MCP_SERVERS: Array<{
  name: string
  npmPackage: string
  command: string
  args: string[]
}> = [
  {
    name: 'engram',
    npmPackage: '@anthropic/engram-mcp',
    command: 'engram',
    args: ['mcp'],
  },
  {
    name: 'filesystem',
    npmPackage: '@anthropic/filesystem-mcp',
    command: 'npx',
    args: ['-y', '@anthropic/filesystem-mcp'],
  },
  {
    name: 'glance',
    npmPackage: '@anthropic/glance-mcp',
    command: 'npx',
    args: ['-y', '@anthropic/glance-mcp'],
  },
]

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
