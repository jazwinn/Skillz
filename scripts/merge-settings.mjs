#!/usr/bin/env node
// Merge the repo's shared settings (config/settings.json) into ~/.claude/settings.json.
//
// Rules:
//   - objects       -> merged recursively
//   - arrays        -> union, local entries first, shared extras appended
//   - scalars       -> shared value wins
//   - local-only keys are always preserved (machine-specific settings survive)
//
// Usage: node merge-settings.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dryRun = process.argv.includes('--dry-run')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sharedPath = join(repoRoot, 'config', 'settings.json')
const localPath = join(homedir(), '.claude', 'settings.json')

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  const raw = readFileSync(path, 'utf8').trim()
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch (err) {
    console.error(`  ! ${path} is not valid JSON: ${err.message}`)
    process.exit(1)
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function merge(local, shared) {
  if (Array.isArray(shared)) {
    const base = Array.isArray(local) ? local : []
    const seen = new Set(base.map((v) => JSON.stringify(v)))
    return [...base, ...shared.filter((v) => !seen.has(JSON.stringify(v)))]
  }
  if (isPlainObject(shared)) {
    const out = isPlainObject(local) ? { ...local } : {}
    for (const [key, value] of Object.entries(shared)) {
      if (key.startsWith('_')) continue // comment keys
      out[key] = merge(out[key], value)
    }
    return out
  }
  return shared
}

const shared = readJson(sharedPath, null)
if (shared === null) {
  console.error(`  ! missing ${sharedPath}`)
  process.exit(1)
}
const local = readJson(localPath, {})
const merged = merge(local, shared)

const before = JSON.stringify(local, null, 2)
const after = JSON.stringify(merged, null, 2)

if (before === after) {
  console.log('  settings already up to date')
  process.exit(0)
}
if (dryRun) {
  console.log('  settings would change (dry run):')
  console.log(after.split('\n').map((l) => '    ' + l).join('\n'))
  process.exit(0)
}

mkdirSync(dirname(localPath), { recursive: true })
if (existsSync(localPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${localPath}.bak-${stamp}`
  copyFileSync(localPath, backup)
  console.log(`  backed up existing settings -> ${backup}`)
}
writeFileSync(localPath, after + '\n', 'utf8')
console.log(`  merged shared settings -> ${localPath}`)
