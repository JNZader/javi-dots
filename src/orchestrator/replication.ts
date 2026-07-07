import fs from 'fs'
import path from 'path'
import {
  MANIFEST_PATH,
  REPLICATION_PROFILE_PATH,
  DEFAULT_MCP_SERVERS,
} from '../constants.js'
import type {
  AI_CLI,
  Manifest,
  PortableReplicationProfile,
  PortableReplicationTool,
  PortableReplicationFeature,
} from '../types/index.js'

export const PORTABLE_PROFILE_VERSION = 1

export const PORTABLE_FEATURES: PortableReplicationFeature[] = [
  'skills',
  'configs',
  'hooks',
  'plugins',
  'orchestrators',
  'engram',
  'sdd',
]

export const DEFAULT_PORTABLE_TOOLS: PortableReplicationTool[] = [
  'engram',
  'gentle-ai',
]

const SENSITIVE_PATH_SEGMENTS = [
  '.env',
  'auth.json',
  'credentials',
  'credential',
  'secret',
  'secrets',
  'token',
  'tokens',
  'oauth',
  'sessions',
  'session',
  'history',
  'logs',
  'log',
  'cache',
  'generated_images',
  'shell_snapshots',
  'shell-snapshots',
  'paste-cache',
  'state.sqlite',
  'state_5.sqlite',
  'logs_2.sqlite',
]

const RUNTIME_EXTENSIONS = [
  '.sqlite',
  '.sqlite-shm',
  '.sqlite-wal',
  '.log',
  '.jsonl',
]

function readManifest(): Manifest | null {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest
  } catch {
    return null
  }
}

export function isPortableReplicationPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase().replaceAll('\\', '/')
  const basename = path.basename(normalized)

  if (basename.startsWith('.env')) return false
  if (RUNTIME_EXTENSIONS.some(ext => normalized.endsWith(ext))) return false

  return !SENSITIVE_PATH_SEGMENTS.some(segment => {
    if (segment.startsWith('.')) return normalized.includes(`/${segment}`) || basename.startsWith(segment)
    return normalized.split('/').some(part => part === segment || part.includes(segment))
  })
}

export function createPortableReplicationProfile(now = new Date()): PortableReplicationProfile {
  const manifest = readManifest()
  const clis: AI_CLI[] = manifest?.clis?.length ? manifest.clis : ['claude']
  const tools = new Set<PortableReplicationTool>(DEFAULT_PORTABLE_TOOLS)

  if (manifest?.ghagga) tools.add('ghagga')
  if (manifest?.kiteguard) tools.add('kiteguard')
  if (manifest?.rtk) tools.add('rtk')

  return {
    version: PORTABLE_PROFILE_VERSION,
    generatedAt: now.toISOString(),
    source: 'javi-dots',
    clis,
    preset: clis.length === 1 && clis[0] === 'claude' ? 'minimal' : 'full',
    features: PORTABLE_FEATURES,
    tools: [...tools],
    mcpServers: DEFAULT_MCP_SERVERS.map(server => server.name),
    excludedState: [
      'secrets',
      'credentials',
      'auth tokens',
      'oauth files',
      'session histories',
      'logs',
      'caches',
      'generated images',
      'runtime databases',
      'shell snapshots',
    ],
  }
}

export function writePortableReplicationProfile(
  profile: PortableReplicationProfile,
  targetPath = REPLICATION_PROFILE_PATH,
): string {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, JSON.stringify(profile, null, 2), 'utf-8')
  return targetPath
}

export function exportPortableReplicationProfile(targetPath?: string): PortableReplicationProfile {
  const profile = createPortableReplicationProfile()
  writePortableReplicationProfile(profile, targetPath)
  return profile
}
