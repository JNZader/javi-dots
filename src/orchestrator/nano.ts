import fs from 'fs'
import path from 'path'
import { MANIFEST_DIR } from '../constants.js'
import type { NanoResult, NanoPhase } from '../types/index.js'

// ── Skill source path (installed by javi-ai) ─────────────────────────────
const NANO_SKILL_FILENAME = 'SKILL.md'
const NANO_SKILL_DIR = 'nano-mode'

// ── Skill resolution ─────────────────────────────────────────────────────

/** Search paths for the nano-mode SKILL.md (first match wins) */
function getSkillSearchPaths(home: string): string[] {
  return [
    path.join(home, '.claude', 'skills', NANO_SKILL_DIR, NANO_SKILL_FILENAME),
    path.join(home, '.opencode', 'skills', NANO_SKILL_DIR, NANO_SKILL_FILENAME),
    path.join(home, '.gemini', 'skills', NANO_SKILL_DIR, NANO_SKILL_FILENAME),
    path.join(MANIFEST_DIR, 'skills', NANO_SKILL_DIR, NANO_SKILL_FILENAME),
  ]
}

export function resolveSkillPath(home: string = process.env['HOME'] ?? ''): string | null {
  const paths = getSkillSearchPaths(home)
  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// ── Validation ───────────────────────────────────────────────────────────

const MAX_PLAN_STEPS = 7
const HIGH_RISK_KEYWORDS = ['breaking', 'migration', 'architecture', 'redesign']

export function validateDescription(description: string): { valid: boolean; error?: string } {
  const trimmed = description.trim()
  if (!trimmed) return { valid: false, error: 'Description cannot be empty' }
  if (trimmed.length < 5) return { valid: false, error: 'Description too short — be specific' }
  if (trimmed.length > 200) return { valid: false, error: 'Description too long (max 200 chars) — keep it concise' }
  return { valid: true }
}

export function shouldEscalate(risk: string, planSteps: number): { escalate: boolean; reason?: string } {
  if (risk.toLowerCase() === 'high') {
    return { escalate: true, reason: 'Risk is High — use /sdd-new instead' }
  }
  if (planSteps > MAX_PLAN_STEPS) {
    return { escalate: true, reason: `Plan exceeds ${MAX_PLAN_STEPS} steps — use /sdd-new instead` }
  }
  return { escalate: false }
}

export function detectHighRiskKeywords(description: string): string[] {
  const lower = description.toLowerCase()
  return HIGH_RISK_KEYWORDS.filter(kw => lower.includes(kw))
}

// ── Phase tracking ───────────────────────────────────────────────────────

export function createPhases(): NanoPhase[] {
  return [
    { id: 'challenge', label: 'Challenge', status: 'pending' },
    { id: 'plan', label: 'Plan', status: 'pending' },
    { id: 'build', label: 'Build', status: 'pending' },
    { id: 'review', label: 'Review', status: 'pending' },
  ]
}

export function advancePhase(phases: NanoPhase[], phaseId: string, status: NanoPhase['status'], detail?: string): NanoPhase[] {
  return phases.map(p =>
    p.id === phaseId ? { ...p, status, detail } : p
  )
}

// ── Result formatting ────────────────────────────────────────────────────

export function formatResult(result: NanoResult): string {
  const lines: string[] = [
    '## Nano Complete',
    '',
    `**Change**: ${result.description}`,
    `**Files**: ${result.filesModified} modified, ${result.filesCreated} created`,
    `**Tests**: ${result.testsPassed ? 'pass' : 'fail'}`,
    `**Risk**: ${result.risk}`,
  ]

  if (result.escalated) {
    lines.push(`**Escalated**: ${result.escalationReason ?? 'Scope exceeded nano limits'}`)
  }

  return lines.join('\n')
}

// ── Slug generation ──────────────────────────────────────────────────────

export function toSlug(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
}
