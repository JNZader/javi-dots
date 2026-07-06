import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { writeSnapshot, pruneBackups, restoreSnapshot } from './backup.js'

// Use a real tmpdir per test — backup.ts touches the real filesystem
// (mkdirSync, writeFileSync, renameSync) and we want integration-style
// assertions against actual tar behavior. The tests need `tar` on PATH.
const HAS_TAR = (() => {
  try {
    execSync('tar --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const itTar = HAS_TAR ? it : it.skip

let tmpRoot = ''
let backupsDir = ''

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'javidots-backup-test-'))
  backupsDir = path.join(tmpRoot, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })
})

afterEach(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
})

describe('writeSnapshot', () => {
  it('returns { skipped: true } and writes no tarball when paths list is empty or nothing exists', async () => {
    const result = await writeSnapshot(
      [path.join(tmpRoot, 'does-not-exist.txt')],
      backupsDir,
    )
    expect(result.skipped).toBe(true)
    expect(result.manifest).toBeUndefined()
    expect(fs.readdirSync(backupsDir)).toEqual([])
  })

  itTar('writes tarball + manifest with the entries when paths exist', async () => {
    const f1 = path.join(tmpRoot, 'a.txt')
    const f2 = path.join(tmpRoot, 'b.txt')
    fs.writeFileSync(f1, 'content-a')
    fs.writeFileSync(f2, 'content-b')

    const result = await writeSnapshot([f1, f2], backupsDir, 'snap-1')

    expect(result.skipped).toBe(false)
    expect(result.manifest?.id).toBe('snap-1')
    expect(result.manifest?.entries).toHaveLength(2)
    expect(result.manifest?.entries.map((e) => e.original_path)).toEqual([f1, f2])
    expect(result.manifest?.entries.every((e) => e.existed === true)).toBe(true)

    const snapDir = path.join(backupsDir, 'snap-1')
    expect(fs.existsSync(path.join(snapDir, 'snapshot.tar.gz'))).toBe(true)
    expect(fs.existsSync(path.join(snapDir, 'manifest.json'))).toBe(true)
  })

  itTar('records non-existent paths as existed:false in the manifest but skips them from the tarball', async () => {
    const f1 = path.join(tmpRoot, 'a.txt')
    fs.writeFileSync(f1, 'content-a')
    const missing = path.join(tmpRoot, 'missing.txt')

    const result = await writeSnapshot([f1, missing], backupsDir, 'snap-mixed')

    expect(result.manifest?.entries).toEqual([
      expect.objectContaining({ original_path: f1, existed: true }),
      expect.objectContaining({ original_path: missing, existed: false, snapshot_path: '' }),
    ])
  })

  itTar('defaults id to an ISO-shaped timestamp when not provided', async () => {
    const f1 = path.join(tmpRoot, 'a.txt')
    fs.writeFileSync(f1, 'content-a')

    const result = await writeSnapshot([f1], backupsDir)

    expect(result.manifest?.id).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(fs.existsSync(path.join(backupsDir, result.manifest!.id, 'snapshot.tar.gz'))).toBe(true)
  })
})

describe('restoreSnapshot', () => {
  itTar('round-trips: writeSnapshot then restoreSnapshot produces byte-identical file', async () => {
    const f = path.join(tmpRoot, 'original.txt')
    const original = 'line1\nline2\nline3\n'
    fs.writeFileSync(f, original)

    const snap = await writeSnapshot([f], backupsDir, 'snap-rt')
    expect(snap.skipped).toBe(false)

    // Clobber the original.
    fs.writeFileSync(f, 'clobbered')
    expect(fs.readFileSync(f, 'utf-8')).toBe('clobbered')

    // Restore.
    const result = await restoreSnapshot('snap-rt', backupsDir)
    expect(result.restored).toEqual([f])
    expect(result.failed).toEqual([])
    expect(fs.readFileSync(f, 'utf-8')).toBe(original)
  })

  it('throws when snapshot id does not exist', async () => {
    await expect(restoreSnapshot('nope', backupsDir)).rejects.toThrow(/Backup snapshot not found/)
  })
})

describe('pruneBackups', () => {
  it('returns empty result when backupsDir does not exist', async () => {
    const r = await pruneBackups(path.join(tmpRoot, 'never-created'), 5)
    expect(r.removed).toEqual([])
    expect(r.kept).toEqual([])
  })

  it('keeps the 5 most recent non-pinned and removes older ones', async () => {
    // Create 7 fake snapshot dirs with descending mtime. We adjust mtime with
    // fs.utimesSync so ordering is deterministic regardless of FS timing.
    const dirs: { name: string; pinned: boolean; mtimeSecs: number }[] = []
    for (let i = 0; i < 7; i++) {
      const name = `snap-${i}`
      const dir = path.join(backupsDir, name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: name, pinned: false }))
      const mtimeSecs = 1_000_000_000 + i * 1000
      fs.utimesSync(dir, mtimeSecs, mtimeSecs)
      dirs.push({ name, pinned: false, mtimeSecs })
    }

    const r = await pruneBackups(backupsDir, 5)

    expect(r.kept).toHaveLength(5)
    expect(r.removed).toHaveLength(2)
    // Removed are the two oldest (snap-0 and snap-1).
    expect(r.removed.map((d) => path.basename(d)).sort()).toEqual(['snap-0', 'snap-1'])
    // Kept are snap-2..snap-6 (newest).
    expect(r.kept.map((d) => path.basename(d)).sort()).toEqual(
      ['snap-2', 'snap-3', 'snap-4', 'snap-5', 'snap-6'],
    )
  })

  it('preserves pinned dirs regardless of age', async () => {
    // snap-0 oldest but pinned. snap-1..snap-6 unpinned.
    for (let i = 0; i < 7; i++) {
      const dir = path.join(backupsDir, `snap-${i}`)
      fs.mkdirSync(dir, { recursive: true })
      const pinned = i === 0
      fs.writeFileSync(
        path.join(dir, 'manifest.json'),
        JSON.stringify({ id: `snap-${i}`, pinned }),
      )
      const mtimeSecs = 1_000_000_000 + i * 1000
      fs.utimesSync(dir, mtimeSecs, mtimeSecs)
    }

    const r = await pruneBackups(backupsDir, 5)

    expect(r.kept).toHaveLength(6) // 5 most recent + 1 pinned
    expect(r.removed).toHaveLength(1)
    expect(path.basename(r.removed[0]!)).toBe('snap-1') // oldest non-pinned gets pruned
    expect(r.kept.map((d) => path.basename(d)).sort()).toEqual(
      ['snap-0', 'snap-2', 'snap-3', 'snap-4', 'snap-5', 'snap-6'],
    )
  })
})