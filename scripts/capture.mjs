#!/usr/bin/env node
// Pull local Claude Code customisations from ~/.claude into this repo so they
// can be committed and synced to your other machines. The inverse of sync.
//
//   ~/.claude/agents/*.md    -> plugins/personal-toolkit/agents/
//   ~/.claude/commands/**    -> plugins/personal-toolkit/commands/
//   ~/.claude/settings.json  -> config/settings.json  (tracked keys only)
//   ~/.claude/skills/*       -> reported, promote with scripts/add-skill.mjs
//
// Nothing is deleted. Usage: node scripts/capture.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const dryRun = process.argv.includes('--dry-run')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const claudeDir = join(homedir(), '.claude')
const toolkit = join(repoRoot, 'plugins', 'personal-toolkit')

const changes = []
const note = (msg) => console.log(`  ${msg}`)

function copyTree(from, to, label) {
  if (!existsSync(from)) {
    note(`no ${label} directory at ${from} - skipping`)
    return
  }
  const entries = readdirSync(from).filter((e) => !e.startsWith('.'))
  if (entries.length === 0) {
    note(`${label}: empty`)
    return
  }
  for (const entry of entries) {
    const src = join(from, entry)
    const dest = join(to, entry)
    const same = existsSync(dest) && !statSync(src).isDirectory() &&
      readFileSync(src, 'utf8') === readFileSync(dest, 'utf8')
    if (same) continue
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(src, dest, { recursive: true })
    }
    changes.push(`${label}/${entry}`)
    note(`${existsSync(dest) ? 'updated' : 'added'} ${label}/${entry}`)
  }
}

console.log('\n==> Capturing agents')
copyTree(join(claudeDir, 'agents'), join(toolkit, 'agents'), 'agents')

console.log('\n==> Capturing slash commands')
copyTree(join(claudeDir, 'commands'), join(toolkit, 'commands'), 'commands')

// Settings: refresh only the keys this repo already tracks, so machine-specific
// settings never leak into the shared file.
console.log('\n==> Capturing settings (tracked keys only)')
const sharedPath = join(repoRoot, 'config', 'settings.json')
const localPath = join(claudeDir, 'settings.json')
if (!existsSync(localPath)) {
  note('no local settings.json - skipping')
} else {
  const shared = JSON.parse(readFileSync(sharedPath, 'utf8'))
  const local = JSON.parse(readFileSync(localPath, 'utf8'))
  const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

  // Walk the shared shape; take the local value wherever one exists.
  function refresh(sharedNode, localNode) {
    if (localNode === undefined) return sharedNode
    if (isPlainObject(sharedNode) && isPlainObject(localNode)) {
      const out = {}
      for (const [key, value] of Object.entries(sharedNode)) {
        out[key] = key.startsWith('_') ? value : refresh(value, localNode[key])
      }
      return out
    }
    return localNode
  }

  const updated = refresh(shared, local)
  const before = JSON.stringify(shared, null, 2)
  const after = JSON.stringify(updated, null, 2)
  if (before === after) {
    note('settings unchanged')
  } else {
    if (!dryRun) writeFileSync(sharedPath, after + '\n', 'utf8')
    changes.push('config/settings.json')
    note('updated config/settings.json')
    note('(new keys are never added automatically - edit config/settings.json to track more)')
  }
}

// Skills living loose in ~/.claude/skills are not synced until promoted.
console.log('\n==> Checking for un-promoted skills')
const skillsDir = join(claudeDir, 'skills')
if (existsSync(skillsDir)) {
  const marketplace = JSON.parse(readFileSync(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'))
  const known = new Set()
  for (const p of marketplace.plugins ?? []) {
    known.add(p.name)
    const pluginSkills = join(repoRoot, 'plugins', p.name, 'skills')
    if (existsSync(pluginSkills)) readdirSync(pluginSkills).forEach((s) => known.add(s))
  }
  const loose = readdirSync(skillsDir).filter((s) => !s.startsWith('.') && !known.has(s))
  if (loose.length === 0) {
    note('all local skills are in the marketplace')
  } else {
    for (const s of loose) note(`not in marketplace: ${s}  ->  node scripts/add-skill.mjs "${join(skillsDir, s)}"`)
  }
} else {
  note('no ~/.claude/skills directory')
}

console.log('')
if (changes.length === 0) {
  console.log('Nothing to capture - repo already matches this machine.')
} else if (dryRun) {
  console.log(`${changes.length} change(s) would be captured (dry run).`)
} else {
  console.log(`Captured ${changes.length} change(s). Review with 'git diff', then commit and push.`)
}
