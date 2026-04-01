import fs from 'fs'
import path from 'path'
import { TMUX_CONF_PATH, ESP_TOGGLE_SCRIPT_PATH, ESP_BINDING_LINE, MANIFEST_DIR } from '../constants.js'
import { which } from './utils.js'

// ── ESP Toggle Script Content ─────────────────────────────────────────────
const TOGGLE_SCRIPT = `#!/usr/bin/env bash
# ESP toggle — created by javi-dots
# Toggles a claude-esp watch pane in tmux

ESP_MARK="JAVI_ESP"

# Check if an ESP pane already exists
PANE_ID=$(tmux list-panes -F "#{pane_id} #{pane_title}" 2>/dev/null | grep "$ESP_MARK" | awk '{print $1}')

if [ -n "$PANE_ID" ]; then
  # Kill existing ESP pane (toggle off)
  tmux kill-pane -t "$PANE_ID"
else
  # Create a 30% width right split running claude-esp watch
  tmux split-window -h -l 30% "printf '\\033]2;'$ESP_MARK'\\033\\\\'; claude-esp watch; read"
fi
`

// ── Prerequisite checks ───────────────────────────────────────────────────

export async function checkEspInstalled(): Promise<boolean> {
  const espPath = await which('claude-esp')
  return espPath !== null
}

export async function checkTmuxAvailable(): Promise<boolean> {
  const tmuxPath = await which('tmux')
  return tmuxPath !== null
}

// ── Tmux binding installation ─────────────────────────────────────────────

export function installEspBinding(tmuxConfPath: string = TMUX_CONF_PATH): { added: boolean; alreadyExists: boolean } {
  let content = ''

  try {
    content = fs.readFileSync(tmuxConfPath, 'utf-8')
  } catch {
    // File doesn't exist — we'll create it
  }

  // Check if binding already exists (look for the esp-toggle reference)
  if (content.includes('esp-toggle.sh')) {
    return { added: false, alreadyExists: true }
  }

  // Append binding
  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  const comment = '\n# Claude ESP toggle (javi-dots)\n'
  fs.writeFileSync(tmuxConfPath, content + newline + comment + ESP_BINDING_LINE + '\n', 'utf-8')

  return { added: true, alreadyExists: false }
}

// ── Toggle script generation ──────────────────────────────────────────────

export function writeToggleScript(targetDir: string = MANIFEST_DIR): string {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const scriptPath = path.join(targetDir, 'esp-toggle.sh')
  fs.writeFileSync(scriptPath, TOGGLE_SCRIPT, { mode: 0o755, encoding: 'utf-8' })

  return scriptPath
}

// ── Aggregated setup ──────────────────────────────────────────────────────

export interface EspSetupResult {
  tmuxAvailable: boolean
  espInstalled: boolean
  bindingResult: { added: boolean; alreadyExists: boolean } | null
  scriptPath: string | null
}

export async function runEspSetup(): Promise<EspSetupResult> {
  const tmuxAvailable = await checkTmuxAvailable()
  const espInstalled = await checkEspInstalled()

  // If prerequisites are missing, bail early
  if (!tmuxAvailable || !espInstalled) {
    return { tmuxAvailable, espInstalled, bindingResult: null, scriptPath: null }
  }

  const scriptPath = writeToggleScript()
  const bindingResult = installEspBinding()

  return { tmuxAvailable, espInstalled, bindingResult, scriptPath }
}
