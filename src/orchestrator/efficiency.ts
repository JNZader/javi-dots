import fs from 'fs'
import path from 'path'
import type { SetupStep } from '../types/index.js'
import {
  EFFICIENCY_DIR,
  EFFICIENCY_STATE_PATH,
  EFFICIENCY_PROFILES,
  type EfficiencyProfileId,
} from '../constants.js'
import { EDITOR_CONFIGS } from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── State ──────────────────────────────────────────────────────────────────

export interface EfficiencyState {
  active: EfficiencyProfileId | null
  installedEditors: string[]
}

function readState(): EfficiencyState {
  try {
    if (fs.existsSync(EFFICIENCY_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(EFFICIENCY_STATE_PATH, 'utf-8')) as EfficiencyState
    }
  } catch { /* ignore */ }
  return { active: null, installedEditors: [] }
}

function writeState(state: EfficiencyState): void {
  fs.mkdirSync(EFFICIENCY_DIR, { recursive: true })
  fs.writeFileSync(EFFICIENCY_STATE_PATH, JSON.stringify(state, null, 2))
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getEfficiencyFilePath(editorGlobalDir: string, filename: string): string {
  return path.join(editorGlobalDir, filename)
}

function removeEfficiencyFile(editorGlobalDir: string, filename: string): boolean {
  const filePath = getEfficiencyFilePath(editorGlobalDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
}

// ── Commands ───────────────────────────────────────────────────────────────

/**
 * Activate an efficiency profile across all configured editors.
 */
export async function activateEfficiency(
  profileId: EfficiencyProfileId,
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  const stepId = 'efficiency-activate'
  report(onStep, stepId, `Activate efficiency: ${profileId}`, 'running')

  const profile = EFFICIENCY_PROFILES.find(p => p.id === profileId)
  if (!profile) {
    report(onStep, stepId, `Activate efficiency: ${profileId}`, 'error', 'unknown profile id')
    return
  }

  const editors: string[] = []

  if (!dryRun) {
    // Write the profile file to each editor's global dir
    for (const editor of EDITOR_CONFIGS) {
      if (!fs.existsSync(editor.globalDir)) continue
      const filePath = getEfficiencyFilePath(editor.globalDir, profile.filename)
      fs.writeFileSync(filePath, profile.content)
      editors.push(editor.id)
    }

    const state: EfficiencyState = { active: profileId, installedEditors: editors }
    writeState(state)
  }

  report(onStep, stepId, `Activate efficiency: ${profileId}`, 'done',
    dryRun
      ? `dry-run: would write ${profile.filename} to configured editors`
      : `${profile.filename} written to ${editors.length} editor(s): ${editors.join(', ')}`)
}

/**
 * Deactivate the current efficiency profile (remove files from editors).
 */
export async function deactivateEfficiency(
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  const stepId = 'efficiency-deactivate'
  report(onStep, stepId, 'Deactivate efficiency profile', 'running')

  const state = readState()

  if (!state.active) {
    report(onStep, stepId, 'Deactivate efficiency profile', 'done', 'no active profile')
    return
  }

  const profile = EFFICIENCY_PROFILES.find(p => p.id === state.active)
  if (!profile) {
    report(onStep, stepId, 'Deactivate efficiency profile', 'error', 'active profile not found in registry')
    return
  }

  let removed = 0

  if (!dryRun) {
    for (const editor of EDITOR_CONFIGS) {
      if (removeEfficiencyFile(editor.globalDir, profile.filename)) {
        removed++
      }
    }

    writeState({ active: null, installedEditors: [] })
  }

  report(onStep, stepId, 'Deactivate efficiency profile', 'done',
    dryRun
      ? `dry-run: would remove ${profile.filename} from editors`
      : `removed ${profile.filename} from ${removed} editor(s)`)
}

/**
 * Show current efficiency profile status.
 */
export async function efficiencyStatus(
  onStep: StepCallback
): Promise<void> {
  const state = readState()

  if (!state.active) {
    report(onStep, 'efficiency-status', 'Efficiency profile', 'done', 'none active (exploratory mode)')
    return
  }

  const profile = EFFICIENCY_PROFILES.find(p => p.id === state.active)
  if (!profile) {
    report(onStep, 'efficiency-status', 'Efficiency profile', 'error', `unknown active profile: ${state.active}`)
    return
  }

  report(onStep, 'efficiency-status', `Active: ${profile.label}`, 'done',
    `${profile.description} — editors: ${state.installedEditors.join(', ') || 'none'}`)
}

/**
 * List all available efficiency profiles.
 */
export async function listEfficiencyProfiles(
  onStep: StepCallback
): Promise<void> {
  const state = readState()

  for (const profile of EFFICIENCY_PROFILES) {
    const isActive = state.active === profile.id
    const label = isActive ? `${profile.label} (active)` : profile.label
    report(onStep, `efficiency-${profile.id}`, label, 'done', profile.description)
  }
}
