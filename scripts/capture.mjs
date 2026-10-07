#!/usr/bin/env node
// Pull local Claude Code customisations from ~/.claude into this repo so they
// can be committed and synced to your other machines. The inverse of sync.
//
//   ~/.claude/agents/*.md    -> plugins/personal-toolkit/agents/
//   ~/.claude/commands/**    -> plugins/personal-toolkit/commands/
//   ~/.claude/settings.json  -> config/settings.json  (tracked keys only)
//   ~/.claude/skills/*       -> reported, promote with scripts/add-skill.mjs
//   installed plugins        -> config/upstream.json  (third-party, by reference)
//
// Nothing is deleted. Usage: node scripts/capture.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
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

// Third-party plugins installed on this machine, pinned by reference so the
// other machines reinstall them. Plugins from this repo's own marketplace are
// already covered by .claude-plugin/marketplace.json. Nothing is unpinned here:
// removing a plugin everywhere stays a deliberate edit to upstream.json.
console.log('\n==> Capturing third-party plugins')
const upstreamPath = join(repoRoot, 'config', 'upstream.json')
try {
  // claude is a .cmd shim on Windows, which node cannot spawn without a shell.
  // These commands are fixed literals - nothing is interpolated into them.
  const claudeJson = (cmd) => JSON.parse(
    execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  )
  const installed = claudeJson('claude plugin list --json')
  const configured = new Map(claudeJson('claude plugin marketplace list --json').map((m) => [m.name, m]))
  const upstream = JSON.parse(readFileSync(upstreamPath, 'utf8'))
  const ownName = JSON.parse(readFileSync(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8')).name

  upstream.marketplaces ??= []
  upstream.plugins ??= []
  const pinnedMarkets = new Set(upstream.marketplaces.map((m) => m.name))
  const pinnedPlugins = new Set(upstream.plugins)
  let pinned = 0

  for (const plugin of installed) {
    // Only user-scope installs are reproducible from a marketplace reference;
    // synced, project and inline plugins come from somewhere else entirely.
    if (plugin.scope !== 'user') continue
    const at = plugin.id.lastIndexOf('@')
    const marketName = at === -1 ? null : plugin.id.slice(at + 1)
    if (!marketName || marketName === ownName) continue

    const market = configured.get(marketName)
    if (!market) {
      note(`skipped ${plugin.id} - marketplace '${marketName}' is not configured`)
      continue
    }
    if (market.source === 'directory') {
      note(`skipped ${plugin.id} - '${marketName}' is a local directory, not portable`)
      continue
    }
    const source = market.repo ?? market.url
    if (!source) {
      note(`skipped ${plugin.id} - no portable source for '${marketName}'`)
      continue
    }

    if (!pinnedMarkets.has(marketName)) {
      upstream.marketplaces.push({ name: marketName, source })
      pinnedMarkets.add(marketName)
      note(`pinned marketplace ${marketName} (${source})`)
      pinned++
    }
    if (!pinnedPlugins.has(plugin.id)) {
      upstream.plugins.push(plugin.id)
      pinnedPlugins.add(plugin.id)
      note(`pinned ${plugin.id}`)
      pinned++
    }
  }

  if (pinned === 0) {
    note('all third-party plugins are already pinned')
  } else {
    upstream.marketplaces.sort((a, b) => a.name.localeCompare(b.name))
    upstream.plugins.sort()
    if (!dryRun) writeFileSync(upstreamPath, JSON.stringify(upstream, null, 2) + '\n', 'utf8')
    changes.push('config/upstream.json')
  }
} catch (err) {
  note(`could not read installed plugins (${err.message.split('\n')[0]}) - skipping`)
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
