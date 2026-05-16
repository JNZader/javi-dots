#!/usr/bin/env node
import fs from 'node:fs'

const REQUIRED_FILES = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/constants.js',
  'dist/constants.d.ts',
  'dist/orchestrator/index.js',
  'dist/orchestrator/index.d.ts',
  'dist/orchestrator/replication.js',
  'dist/orchestrator/replication.d.ts',
  'dist/ui/App.js',
  'dist/ui/App.d.ts',
  'dist/types/index.js',
  'dist/types/index.d.ts',
  'README.md',
  'package.json',
]

const REQUIRED_PREFIXES = [
  'dist/orchestrator/',
  'dist/ui/',
  'dist/types/',
]

const FORBIDDEN_PREFIXES = [
  'src/',
  'coverage/',
  'reports/',
  'node_modules/',
  '.github/',
  '.vscode/',
  '.idea/',
  'docs/',
  'dist/__integration__/',
  'dist/e2e/',
  '.stryker-tmp/',
]

const FORBIDDEN_FILES = [
  '.releaserc',
  'tsconfig.json',
  'vitest.config.ts',
  'stryker.config.json',
]

const FORBIDDEN_PATTERNS = [
  /(^|\/)\.env($|\.)/,
  /(^|\/)credentials?(\.|\/|$)/i,
  /(^|\/)secrets?(\/|$)/i,
  /(^|\/)oauth(\.|\/|$)/i,
  /(^|\/)npm-debug\.log$/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.map$/,
  /\.log$/,
  /\.jsonl$/,
  /\.(sqlite|sqlite3|db|db-wal|db-shm)$/,
]

function readPackedFiles(manifestPath) {
  if (!manifestPath) {
    throw new Error('Usage: node scripts/verify-package-contents.mjs <npm-pack-json-output>')
  }

  const output = fs.readFileSync(manifestPath, 'utf-8').trim()
  if (!output) {
    throw new Error(`Package manifest is empty: ${manifestPath}`)
  }

  const parsed = JSON.parse(output)
  const [packument] = parsed
  if (!packument || !Array.isArray(packument.files)) {
    throw new Error('npm pack did not return a file manifest')
  }
  return packument.files.map(file => file.path).sort()
}

function fail(messages) {
  console.error('Package content verification failed:')
  for (const message of messages) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

const files = readPackedFiles(process.argv[2])
const fileSet = new Set(files)
const errors = []

for (const requiredFile of REQUIRED_FILES) {
  if (!fileSet.has(requiredFile)) {
    errors.push(`missing required file: ${requiredFile}`)
  }
}

for (const requiredPrefix of REQUIRED_PREFIXES) {
  if (!files.some(file => file.startsWith(requiredPrefix))) {
    errors.push(`missing required asset tree: ${requiredPrefix}`)
  }
}

for (const forbiddenFile of FORBIDDEN_FILES) {
  if (fileSet.has(forbiddenFile)) {
    errors.push(`forbidden file included: ${forbiddenFile}`)
  }
}

for (const forbiddenPrefix of FORBIDDEN_PREFIXES) {
  const match = files.find(file => file.startsWith(forbiddenPrefix))
  if (match) {
    errors.push(`forbidden asset included from ${forbiddenPrefix}: ${match}`)
  }
}

for (const forbiddenPattern of FORBIDDEN_PATTERNS) {
  const match = files.find(file => forbiddenPattern.test(file))
  if (match) {
    errors.push(`forbidden asset included: ${match}`)
  }
}

if (errors.length > 0) {
  fail(errors)
}

const jsCount = files.filter(file => file.endsWith('.js')).length
const dtsCount = files.filter(file => file.endsWith('.d.ts')).length
console.log(`Package content verification passed: ${files.length} files, ${jsCount} js, ${dtsCount} declarations.`)
