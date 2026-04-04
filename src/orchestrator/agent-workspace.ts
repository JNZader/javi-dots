import fs from 'fs'
import path from 'path'
import type { SetupStep } from '../types/index.js'
import {
  AGENT_WORKTREE_CONFIG_PATH,
  AGENTS_MD_PATH,
  CLAUDE_MD_PATH,
  DEFAULT_WORKTREE_CONFIG,
  CLAUDE_MD_AGENT_SECTION,
  AGENTS_MD_STARTER,
  MANIFEST_DIR,
} from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

/**
 * Set up the workstation for multi-agent parallel development.
 *
 * 1. Writes worktree-config.json to ~/.javidots/
 * 2. Appends agent identity section to ~/.claude/CLAUDE.md (if it exists and section is absent)
 * 3. Creates ~/.claude/AGENTS.md (if it doesn't exist)
 */
export async function runAgentWorkspaceSetup(
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  // Step A: Write worktree-config.json
  report(onStep, 'agent-worktree-config', 'Configure worktree orchestration', 'running')
  try {
    if (!dryRun) {
      fs.mkdirSync(MANIFEST_DIR, { recursive: true })
      fs.writeFileSync(
        AGENT_WORKTREE_CONFIG_PATH,
        JSON.stringify(DEFAULT_WORKTREE_CONFIG, null, 2)
      )
    }
    report(
      onStep,
      'agent-worktree-config',
      'Configure worktree orchestration',
      'done',
      dryRun
        ? `dry-run: would write ${AGENT_WORKTREE_CONFIG_PATH}`
        : `wrote ${AGENT_WORKTREE_CONFIG_PATH}`
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'agent-worktree-config', 'Configure worktree orchestration', 'error', msg)
  }

  // Step B: Append agent identity section to CLAUDE.md
  report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'running')
  try {
    const marker = '## Agent Identity Conventions'
    if (!dryRun) {
      if (fs.existsSync(CLAUDE_MD_PATH)) {
        const existing = fs.readFileSync(CLAUDE_MD_PATH, 'utf-8')
        if (!existing.includes(marker)) {
          fs.appendFileSync(CLAUDE_MD_PATH, CLAUDE_MD_AGENT_SECTION)
          report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'done', 'section appended')
        } else {
          report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'done', 'section already present — skipped')
        }
      } else {
        report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'skipped', 'CLAUDE.md not found — install javi-ai first')
      }
    } else {
      report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'done', `dry-run: would append "${marker}" section`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'agent-claude-md', 'Add agent identity to CLAUDE.md', 'error', msg)
  }

  // Step C: Create AGENTS.md if absent
  report(onStep, 'agent-agents-md', 'Create AGENTS.md conventions file', 'running')
  try {
    if (!dryRun) {
      const claudeDir = path.dirname(AGENTS_MD_PATH)
      fs.mkdirSync(claudeDir, { recursive: true })

      if (!fs.existsSync(AGENTS_MD_PATH)) {
        fs.writeFileSync(AGENTS_MD_PATH, AGENTS_MD_STARTER)
        report(onStep, 'agent-agents-md', 'Create AGENTS.md conventions file', 'done', `wrote ${AGENTS_MD_PATH}`)
      } else {
        report(onStep, 'agent-agents-md', 'Create AGENTS.md conventions file', 'done', 'already exists — not overwritten')
      }
    } else {
      report(onStep, 'agent-agents-md', 'Create AGENTS.md conventions file', 'done', `dry-run: would create ${AGENTS_MD_PATH}`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'agent-agents-md', 'Create AGENTS.md conventions file', 'error', msg)
  }
}
