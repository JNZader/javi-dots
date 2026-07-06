import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface BackupManifestEntry {
  original_path: string
  snapshot_path: string
  existed: boolean
  mode: number
}

export interface BackupManifest {
  id: string
  created_at: string
  root_dir: string
  entries: BackupManifestEntry[]
  pinned?: boolean
}

export interface BackupRecord {
  skipped: boolean
  manifest?: BackupManifest
}

const DEFAULT_KEEP = 5

/**
 * Write a tar.gz snapshot of the given paths to `<backupsDir>/<id>/snapshot.tar.gz`
 * with a sibling `manifest.json`. Layout matches gentle-ai's `~/.gentle-ai/backups/`,
 * so users can restore via either tool's familiar shape.
 *
 * - If no `paths` exist on disk, no tarball is written and `{ skipped: true }` is returned.
 * - Each existing file is archived at `files<absolute-path>` inside the tarball.
 * - Write is atomic per file write (writes tarball to `.tmp` then renames into place).
 */
export async function writeSnapshot(
  paths: string[],
  backupsDir: string,
  id?: string,
): Promise<BackupRecord> {
  const entries: BackupManifestEntry[] = []
  for (const p of paths) {
    let stat: fs.Stats | null = null
    try {
      stat = fs.statSync(p)
    } catch {
      entries.push({ original_path: p, snapshot_path: '', existed: false, mode: 0 })
      continue
    }
    entries.push({
      original_path: p,
      snapshot_path: `files${p}`,
      existed: true,
      mode: stat.mode,
    })
  }

  const existing = entries.filter((e) => e.existed)
  if (existing.length === 0) {
    return { skipped: true }
  }

  const timestamp = id ?? new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(backupsDir, timestamp)
  fs.mkdirSync(dir, { recursive: true })

  const tarballPath = path.join(dir, 'snapshot.tar.gz')
  const tarballTmp = `${tarballPath}.tmp`

  // Stage copies to a layout that produces the desired archive entries
  // `files/<stripped-absolute-path>` for parity with gentle-ai's backup
  // convention. This approach avoids GNU-vs-BSD tar transform syntax
  // differences (`--transform` vs `-s`) and keeps write/restore symmetric.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'javidots-snapshot-'))
  try {
    for (const e of existing) {
      const stripped = e.original_path.replace(/^\/+/, '')
      const staged = path.join(staging, 'files', stripped)
      fs.mkdirSync(path.dirname(staged), { recursive: true })
      fs.copyFileSync(e.original_path, staged)
      try { fs.chmodSync(staged, e.mode) } catch {}
    }

    // Create the archive from the staging dir so the archive's internal
    // layout is `files/<stripped-path>` (matches gentle-ai's convention).
    await execFileAsync('tar', ['-czf', tarballTmp, '-C', staging, 'files'], {
      timeout: 30_000,
    })
    fs.renameSync(tarballTmp, tarballPath)
  } catch (e) {
    try { fs.unlinkSync(tarballTmp) } catch {}
    throw e
  } finally {
    try { fs.rmSync(staging, { recursive: true, force: true }) } catch {}
  }

  const manifest: BackupManifest = {
    id: timestamp,
    created_at: new Date().toISOString(),
    root_dir: dir,
    entries,
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  return { skipped: false, manifest }
}

/**
 * Auto-prune backup snapshot directories, keeping the `keep` most recent AND
 * any directory whose `manifest.json` contains `pinned: true`.
 *
 * "Most recent" is determined by directory mtime — names are ISO timestamps
 * so lexical sort coincides with chronological, but we use mtime to support
 * externally-placed snapshots with arbitrary names.
 */
export async function pruneBackups(
  backupsDir: string,
  keep: number = DEFAULT_KEEP,
): Promise<{ removed: string[]; kept: string[] }> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(backupsDir, { withFileTypes: true })
  } catch {
    return { removed: [], kept: [] }
  }

  const dirs = entries.filter((e) => e.isDirectory())
  const stamped = dirs.map((d) => {
    const dir = path.join(backupsDir, d.name)
    let mtime = 0
    let pinned = false
    try {
      mtime = fs.statSync(dir).mtimeMs
      const manifestPath = path.join(dir, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, 'utf-8')
        const parsed = JSON.parse(raw) as BackupManifest
        pinned = parsed.pinned === true
      }
    } catch {}
    return { name: d.name, dir, mtime, pinned }
  })

  // Sort newest first.
  stamped.sort((a, b) => b.mtime - a.mtime)

  const kept: string[] = []
  const removed: string[] = []
  let nonPinnedSeen = 0
  for (const e of stamped) {
    if (e.pinned) {
      kept.push(e.dir)
      continue
    }
    if (nonPinnedSeen < keep) {
      nonPinnedSeen++
      kept.push(e.dir)
    } else {
      try {
        fs.rmSync(e.dir, { recursive: true, force: true })
        removed.push(e.dir)
      } catch {
        // If removal fails, leave it and keep tracking.
        kept.push(e.dir)
      }
    }
  }

  return { removed, kept }
}

/**
 * Restore files from a snapshot tarball back to their original paths.
 * Returns the list of restored paths and any that failed during extraction.
 */
export async function restoreSnapshot(
  id: string,
  backupsDir: string,
): Promise<{ restored: string[]; failed: string[] }> {
  const dir = path.join(backupsDir, id)
  const tarballPath = path.join(dir, 'snapshot.tar.gz')
  const manifestPath = path.join(dir, 'manifest.json')

  if (!fs.existsSync(tarballPath) || !fs.existsSync(manifestPath)) {
    throw new Error(`Backup snapshot not found: ${dir}`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BackupManifest
  const existing = manifest.entries.filter((e) => e.existed)
  if (existing.length === 0) {
    return { restored: [], failed: [] }
  }

  // Ensure parent dirs exist before extraction.
  for (const e of existing) {
    const parent = path.dirname(e.original_path)
    try { fs.mkdirSync(parent, { recursive: true }) } catch {}
  }

  try {
    // Extract with -C / so the archive's `files/home/.../x` paths restore to
    // /files/home/.../x — wait, that's not right. The archive layout is
    // `files/<original-absolute-stripped>` so extraction with `-C /` would
    // write to `/files/<path>` not the original `<path>`.
    // We instead extract into a staging dir and copy entries back into place.
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'javidots-restore-'))
    try {
      await execFileAsync('tar', ['-xzf', tarballPath, '-C', staging], { timeout: 30_000 })

      const restored: string[] = []
      const failed: string[] = []
      for (const e of existing) {
        const stripped = e.original_path.replace(/^\/+/, '')
        const staged = path.join(staging, 'files', stripped)
        try {
          fs.copyFileSync(staged, e.original_path)
          try { fs.chmodSync(e.original_path, e.mode) } catch {}
          restored.push(e.original_path)
        } catch {
          failed.push(e.original_path)
        }
      }
      return { restored, failed }
    } finally {
      try { fs.rmSync(staging, { recursive: true, force: true }) } catch {}
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`restoreSnapshot failed: ${msg}`)
  }
}