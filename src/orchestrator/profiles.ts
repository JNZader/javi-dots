import fs from 'fs'
import path from 'path'
import type { Profile, ProfilesState, SetupStep } from '../types/index.js'
import {
  PROFILES_DIR,
  PROFILES_STATE_PATH,
  CONFIG_SKILLS_DIR,
  CONFIG_HOOKS_DIR,
} from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── State management ────────────────────────────────────────────────────────

function readState(): ProfilesState {
  try {
    if (fs.existsSync(PROFILES_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(PROFILES_STATE_PATH, 'utf-8')) as ProfilesState
    }
  } catch { /* ignore */ }
  return { active: null, profiles: {} }
}

function writeState(state: ProfilesState): void {
  const dir = path.dirname(PROFILES_STATE_PATH)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PROFILES_STATE_PATH, JSON.stringify(state, null, 2))
}

// ── Profile directory helpers ───────────────────────────────────────────────

function getProfileDir(name: string): string {
  return path.join(PROFILES_DIR, name)
}

function getProfileSkillsDir(name: string): string {
  return path.join(getProfileDir(name), 'skills')
}

function getProfileHooksDir(name: string): string {
  return path.join(getProfileDir(name), 'hooks')
}

function listDirEntries(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(e => !e.startsWith('.'))
}

function clearDir(dir: string): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir)
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = path.join(dir, entry)
    fs.rmSync(fullPath, { recursive: true, force: true })
  }
}

function copyDirContents(src: string, dest: string): void {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src).filter(e => !e.startsWith('.'))
  for (const entry of entries) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true })
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ── Commands ────────────────────────────────────────────────────────────────

/**
 * Create a new profile from the current central config state.
 */
export async function createProfile(
  name: string,
  description: string,
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  const stepId = 'profile-create'
  report(onStep, stepId, `Create profile: ${name}`, 'running')

  const state = readState()

  if (state.profiles[name]) {
    report(onStep, stepId, `Create profile: ${name}`, 'error', 'profile already exists')
    return
  }

  // Validate name
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    report(onStep, stepId, `Create profile: ${name}`, 'error', 'name must be kebab-case')
    return
  }

  const now = new Date().toISOString()
  const skills = listDirEntries(CONFIG_SKILLS_DIR)
  const hooks = listDirEntries(CONFIG_HOOKS_DIR)

  if (!dryRun) {
    // Save current config state as a profile snapshot
    const profileDir = getProfileDir(name)
    fs.mkdirSync(getProfileSkillsDir(name), { recursive: true })
    fs.mkdirSync(getProfileHooksDir(name), { recursive: true })

    copyDirContents(CONFIG_SKILLS_DIR, getProfileSkillsDir(name))
    copyDirContents(CONFIG_HOOKS_DIR, getProfileHooksDir(name))

    const profile: Profile = {
      name,
      description,
      skills,
      hooks,
      createdAt: now,
      updatedAt: now,
    }

    state.profiles[name] = profile
    writeState(state)
  }

  report(onStep, stepId, `Create profile: ${name}`, 'done',
    dryRun ? `dry-run: would save ${skills.length} skills, ${hooks.length} hooks`
           : `${skills.length} skills, ${hooks.length} hooks`)
}

/**
 * Switch to a named profile by replacing central config with profile contents.
 */
export async function switchProfile(
  name: string,
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  const stepId = 'profile-switch'
  report(onStep, stepId, `Switch to profile: ${name}`, 'running')

  const state = readState()

  if (!state.profiles[name]) {
    report(onStep, stepId, `Switch to profile: ${name}`, 'error',
      `profile "${name}" not found. Available: ${Object.keys(state.profiles).join(', ') || 'none'}`)
    return
  }

  if (!dryRun) {
    // Replace central config with profile snapshot
    clearDir(CONFIG_SKILLS_DIR)
    clearDir(CONFIG_HOOKS_DIR)

    copyDirContents(getProfileSkillsDir(name), CONFIG_SKILLS_DIR)
    copyDirContents(getProfileHooksDir(name), CONFIG_HOOKS_DIR)

    state.active = name
    writeState(state)
  }

  const profile = state.profiles[name]!
  report(onStep, stepId, `Switch to profile: ${name}`, 'done',
    dryRun ? `dry-run: would load ${profile.skills.length} skills, ${profile.hooks.length} hooks`
           : `loaded ${profile.skills.length} skills, ${profile.hooks.length} hooks`)
}

/**
 * List all available profiles.
 */
export async function listProfiles(
  onStep: StepCallback
): Promise<void> {
  const state = readState()
  const names = Object.keys(state.profiles)

  if (names.length === 0) {
    report(onStep, 'profile-list', 'No profiles found', 'done',
      'create one with: javi-dots profile create <name>')
    return
  }

  for (const name of names) {
    const profile = state.profiles[name]!
    const isActive = state.active === name
    const label = isActive ? `${name} (active)` : name
    report(onStep, `profile-${name}`, label, 'done',
      `${profile.description} — ${profile.skills.length} skills, ${profile.hooks.length} hooks`)
  }
}

/**
 * Delete a profile by name.
 */
export async function deleteProfile(
  name: string,
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  const stepId = 'profile-delete'
  report(onStep, stepId, `Delete profile: ${name}`, 'running')

  const state = readState()

  if (!state.profiles[name]) {
    report(onStep, stepId, `Delete profile: ${name}`, 'error', 'profile not found')
    return
  }

  if (!dryRun) {
    const profileDir = getProfileDir(name)
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }

    delete state.profiles[name]
    if (state.active === name) {
      state.active = null
    }
    writeState(state)
  }

  report(onStep, stepId, `Delete profile: ${name}`, 'done',
    dryRun ? 'dry-run: would delete' : 'deleted')
}
