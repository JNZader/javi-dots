import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// NO vi.mock('child_process') — these tests use real tar via backup.ts which
// is called from migrateSkillDir AND migrateFromAtl. They prove file movement
// and backup semantics actually work as integration.

import { migrateFromAtl, migrateSkillDir } from './migration.js'

const HAS_TAR = (() => {
  try {
    execSync('tar --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const itTar = HAS_TAR ? it : it.skip

let tmpHome = ''
let tmpManifest = ''

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-tar-home-'))
  tmpManifest = path.join(tmpHome, '.javidots')
  fs.mkdirSync(tmpManifest, { recursive: true })
})

afterEach(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch {}
})

describe('migrateSkillDir (real tar backup)', () => {
  itTar('moves entries from skill/ to skills/, existing canonical wins on conflict', async () => {
    const opencodeConfig = path.join(tmpHome, '.config', 'opencode')
    const legacy = path.join(opencodeConfig, 'skill')
    const canonical = path.join(opencodeConfig, 'skills')

    fs.mkdirSync(path.join(legacy, 'sdd-init'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'sdd-init', 'SKILL.md'), 'legacy sdd-init')
    fs.mkdirSync(path.join(legacy, 'sdd-apply'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'sdd-apply', 'SKILL.md'), 'legacy sdd-apply')
    fs.mkdirSync(path.join(legacy, 'react-19'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'react-19', 'SKILL.md'), 'legacy react-19')

    fs.mkdirSync(path.join(canonical, 'sdd-apply'), { recursive: true })
    fs.writeFileSync(path.join(canonical, 'sdd-apply', 'SKILL.md'), 'canonical sdd-apply')

    const result = await migrateSkillDir(false, () => {}, tmpHome)

    expect(result.success).toBe(true)
    // readdirSync order is not guaranteed across platforms — assert as a set
    // (contains exactly the 3 entries, with the canonical sdd-apply preserved).
    expect(result.moved).toEqual(expect.arrayContaining(['sdd-init', 'sdd-apply', 'react-19']))
    expect(result.moved).toHaveLength(3)

    expect(fs.readFileSync(path.join(canonical, 'sdd-init', 'SKILL.md'), 'utf-8')).toBe('legacy sdd-init')
    expect(fs.readFileSync(path.join(canonical, 'sdd-apply', 'SKILL.md'), 'utf-8')).toBe('canonical sdd-apply')
    expect(fs.readFileSync(path.join(canonical, 'react-19', 'SKILL.md'), 'utf-8')).toBe('legacy react-19')
    expect(fs.existsSync(legacy)).toBe(false)
  })

  itTar('writes a backup snapshot (tar.gz + manifest) before moving', async () => {
    const opencodeConfig = path.join(tmpHome, '.config', 'opencode')
    const legacy = path.join(opencodeConfig, 'skill')
    fs.mkdirSync(path.join(legacy, 'solo'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'solo', 'SKILL.md'), 'solo-skill')

    const result = await migrateSkillDir(false, () => {}, tmpHome)

    expect(result.success).toBe(true)
    expect(result.backupId).toMatch(/^skill-dir-migration-/)
    const backupDir = path.join(tmpHome, '.javidots', 'backups', result.backupId!)
    expect(fs.existsSync(path.join(backupDir, 'snapshot.tar.gz'))).toBe(true)
    expect(fs.existsSync(path.join(backupDir, 'manifest.json'))).toBe(true)
  })
})

describe('migrateFromAtl (real tar backup)', () => {
  itTar('backs up ATL dir to tar.gz BEFORE removing it (dir present during tar)', async () => {
    const atlDir = path.join(tmpManifest, 'agent-teams-lite')
    fs.mkdirSync(path.join(atlDir, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(atlDir, 'scripts', 'setup.sh'), 'echo fake')
    fs.writeFileSync(path.join(atlDir, 'README.md'), 'fake ATL')

    // We use a tiny spy on fs.rmSync to detect that it's called AFTER tar
    // has finished. We can't easily mock execFile here (no vi.mock), but we
    // can intercept rmSync and assert the tarball already exists.
    const origRmSync = fs.rmSync
    let tarballExistedAtRemoveTime = false
    vi.spyOn(fs, 'rmSync').mockImplementation(((target: fs.PathLike, opts?: fs.RmDirOptions) => {
      // Detect the ATL-dir removal call (path match on atlDir, recursive true).
      if (typeof target === 'string' && target === atlDir) {
        const backupsDir = path.join(tmpManifest, 'backups')
        if (fs.existsSync(backupsDir)) {
          for (const sub of fs.readdirSync(backupsDir)) {
            const cand = path.join(backupsDir, sub, 'atl.tar.gz')
            // Use the original rmSync to read state without recursion.
            if (origRmSync !== fs.rmSync && fs.existsSync(cand)) {
              tarballExistedAtRemoveTime = true
              break
            }
          }
        }
      }
      // Always delegate to the real impl so the dir is actually removed.
      return origRmSync.call(fs, target, opts)
    }) as typeof fs.rmSync)

    try {
      // Do NOT invoke gentle-ai install (no real binary in test env).
      const result = await migrateFromAtl(false, () => {}, tmpManifest, false)
      expect(result.success).toBe(true)
      expect(tarballExistedAtRemoveTime).toBe(true)
      expect(fs.existsSync(atlDir)).toBe(false)
    } finally {
      ;(fs.rmSync as unknown as ReturnType<typeof vi.spyOn>).mockRestore()
    }
  })
})