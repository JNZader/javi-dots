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

// ── Wolf (Token Tracking) ─────────────────────────────────────────────────
export const WOLF_DIR = path.join(HOME, '.wolf')
export const WOLF_SESSIONS_DIR = path.join(WOLF_DIR, 'sessions')
export const REPEATED_READ_THRESHOLD = 3

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

// ── Health Scoring ────────────────────────────────────────────────────────
export const SCORE_WEIGHTS: Record<string, number> = {
  critical: 15,
  structural: 8,
  incremental: 3,
}

export const SNR_BONUS_THRESHOLD = 70
export const SNR_BONUS_POINTS = 5
export const SNR_PENALTY_THRESHOLD = 40
export const SNR_PENALTY_POINTS = 10

export const TOKEN_COST_WARN_THRESHOLD = 10_000

/**
 * Patterns that identify filler/noise lines in CLAUDE.md.
 * Lines matching these are NOT actionable signal.
 */
export const FILLER_PATTERNS: RegExp[] = [
  /^\s*$/,                    // blank lines
  /^\s*---+\s*$/,             // horizontal rules
  /^\s*#{1,6}\s*$/,           // empty headers (# with no text)
  /^\s*<!--.*-->\s*$/,        // HTML comments
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

// ── Telemetry ─────────────────────────────────────────────────────────
export const TELEMETRY_CACHE_PATH = path.join(MANIFEST_DIR, 'telemetry.json')
export const TELEMETRY_CACHE_VERSION = 1
export const CLAUDE_PROJECTS_DIR = path.join(HOME, '.claude', 'projects')
export const TELEMETRY_PERIODS = ['daily', 'weekly', 'monthly'] as const

// ── Kiteguard (Runtime Security) ──────────────────────────────────────
export const KITEGUARD_REPO_URL = 'https://github.com/DhivakaranRavi/kiteguard'
export const KITEGUARD_HOOKS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'] as const
export type KiteguardHookType = typeof KITEGUARD_HOOKS[number]

// ── Security Hooks ────────────────────────────────────────────────────
export const SECURITY_RULES_PATH = path.join(MANIFEST_DIR, 'security-rules.json')
export const SECURITY_GUARD_PATH = path.join(MANIFEST_DIR, 'security-guard.sh')

export const ALL_SECURITY_CATEGORIES = [
  'destructive',
  'remote-exec',
  'reverse-shell',
  'credential-read',
] as const

export const DEFAULT_SECURITY_RULES: Array<{
  id: string
  pattern: string
  category: typeof ALL_SECURITY_CATEGORIES[number]
  description: string
  enabled: boolean
}> = [
  // Destructive
  { id: 'rm-rf-root', pattern: 'rm\\s+-rf\\s+/', category: 'destructive', description: 'Block rm -rf on root paths', enabled: true },
  { id: 'rm-rf-home', pattern: 'rm\\s+-rf\\s+~', category: 'destructive', description: 'Block rm -rf on home directory', enabled: true },
  { id: 'mkfs', pattern: 'mkfs\\.', category: 'destructive', description: 'Block filesystem format commands', enabled: true },
  { id: 'dd-if', pattern: 'dd\\s+if=', category: 'destructive', description: 'Block dd disk write commands', enabled: true },
  { id: 'chmod-777', pattern: 'chmod\\s+777', category: 'destructive', description: 'Block chmod 777 (world-writable)', enabled: true },
  // Remote execution
  { id: 'curl-pipe-bash', pattern: 'curl.*\\|.*(?:bash|sh|zsh)', category: 'remote-exec', description: 'Block curl piped to shell', enabled: true },
  { id: 'wget-pipe-bash', pattern: 'wget.*\\|.*(?:bash|sh|zsh)', category: 'remote-exec', description: 'Block wget piped to shell', enabled: true },
  // Reverse shells
  { id: 'bash-dev-tcp', pattern: 'bash\\s+-i.*\\/dev\\/tcp', category: 'reverse-shell', description: 'Block bash reverse shell via /dev/tcp', enabled: true },
  { id: 'nc-exec', pattern: 'nc\\s+.*-e\\s+\\/bin', category: 'reverse-shell', description: 'Block netcat reverse shell', enabled: true },
  { id: 'python-socket', pattern: 'python.*socket.*connect', category: 'reverse-shell', description: 'Block python reverse shell', enabled: true },
  // Credential reads
  { id: 'cat-ssh-key', pattern: 'cat.*\\.ssh\\/id_', category: 'credential-read', description: 'Block reading SSH private keys', enabled: true },
  { id: 'cat-env-file', pattern: 'cat.*\\.env(?:\\s|$)', category: 'credential-read', description: 'Block reading .env files', enabled: true },
  { id: 'cat-aws-creds', pattern: 'cat.*\\.aws\\/credentials', category: 'credential-read', description: 'Block reading AWS credentials', enabled: true },
  { id: 'cat-netrc', pattern: 'cat.*\\.netrc', category: 'credential-read', description: 'Block reading .netrc file', enabled: true },
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
