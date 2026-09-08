#!/usr/bin/env node
// Install npm dependencies for skills belonging to this marketplace.
//
// Plugins are COPIED into ~/.claude/plugins/cache/ at install time, so running
// npm install in the repo does nothing for the copy Claude actually loads.
// This walks the real install paths instead. Re-run after any plugin update,
// which replaces the cached copy and discards its node_modules.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const marketplace = JSON.parse(readFileSync(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'))
const registryPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json')

if (!existsSync(registryPath)) {
  console.log('  no plugins installed yet - nothing to do')
  process.exit(0)
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const ourIds = new Set((marketplace.plugins ?? []).map((p) => `${p.name}@${marketplace.name}`))

function findPackageJsons(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findPackageJsons(full, out)
    else if (entry.name === 'package.json') out.push(full)
  }
  return out
}

let installed = 0
let failed = 0
let found = 0

for (const [id, entries] of Object.entries(registry.plugins ?? {})) {
  if (!ourIds.has(id)) continue
  for (const entry of entries) {
    const root = entry.installPath
    if (!root || !existsSync(root)) {
      console.log(`  ! ${id}: install path missing (${root}) - re-run claude plugin install`)
      failed++
      continue
    }
    for (const pkg of findPackageJsons(root)) {
      found++
      const dir = dirname(pkg)
      const label = `${id}/${relative(root, dir).split(sep).join("/")}`
      if (existsSync(join(dir, 'node_modules'))) {
        console.log(`  already installed: ${label}`)
        continue
      }
      const res = spawnSync('npm', ['install', '--silent', '--no-audit', '--no-fund'], {
        cwd: dir,
        stdio: 'inherit',
        shell: true, // npm is a .cmd shim on Windows
      })
      if (res.status === 0) {
        console.log(`  npm install: ${label}`)
        installed++
      } else {
        console.log(`  ! npm install failed: ${label}`)
        failed++
      }
    }
  }
}

if (found === 0 && failed === 0) console.log('  no skill dependencies to install')
process.exit(failed > 0 ? 1 : 0)
