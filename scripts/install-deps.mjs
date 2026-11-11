#!/usr/bin/env node
// Install dependencies for skills belonging to this marketplace: npm where a
// package.json sits, pip where a requirements.txt does.
//
// Plugins are COPIED into ~/.claude/plugins/cache/ at install time, so running
// npm install in the repo does nothing for the copy Claude actually loads.
// This walks the real install paths instead. Re-run after any plugin update,
// which replaces the cached copy and discards its node_modules.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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

const MANIFESTS = { 'package.json': 'npm', 'requirements.txt': 'pip' }

function findManifests(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findManifests(full, out)
    else if (MANIFESTS[entry.name]) out.push({ path: full, kind: MANIFESTS[entry.name] })
  }
  return out
}

// Resolve a python once, lazily: most syncs have no requirements.txt at all.
let pythonCmd
function findPython() {
  if (pythonCmd !== undefined) return pythonCmd
  const candidates = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]]
  for (const [bin, prefix] of candidates) {
    // --version only: a -c script needs spaces, which the shell would mangle.
    const probe = spawnSync(bin, [...prefix, '--version'], { encoding: 'utf8', shell: true })
    if (probe.status === 0) {
      // --user is rejected inside a virtualenv, where it is also pointless.
      pythonCmd = { bin, prefix, userFlag: process.env.VIRTUAL_ENV ? [] : ['--user'] }
      return pythonCmd
    }
  }
  pythonCmd = null
  return pythonCmd
}

// pip installs into the interpreter, not the plugin folder, so there is no
// node_modules to look for. Stamp the hash of the file we satisfied instead;
// a plugin update replaces the whole cached folder and takes the stamp with it.
function pipStampIsCurrent(stampPath, requirements) {
  if (!existsSync(stampPath)) return false
  return readFileSync(stampPath, 'utf8').trim() === requirements
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
    for (const manifest of findManifests(root)) {
      found++
      const dir = dirname(manifest.path)
      const label = `${id}/${relative(root, dir).split(sep).join("/")}`

      if (manifest.kind === 'npm') {
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
        continue
      }

      // pip
      const requirements = createHash('sha256').update(readFileSync(manifest.path)).digest('hex')
      const stampPath = join(dir, '.requirements-installed')
      if (pipStampIsCurrent(stampPath, requirements)) {
        console.log(`  already installed: ${label}`)
        continue
      }
      const py = findPython()
      if (!py) {
        console.log(`  ! python not found - skipping ${label}/requirements.txt`)
        failed++
        continue
      }
      const pip = (flags) => spawnSync(
        py.bin,
        [...py.prefix, '-m', 'pip', 'install', '--quiet', ...flags, '-r', manifest.path],
        { cwd: dir, stdio: 'inherit', shell: true },
      )
      let res = pip(py.userFlag)
      // Some system pythons refuse --user outright; a plain install still works.
      if (res.status !== 0 && py.userFlag.length) res = pip([])
      if (res.status === 0) {
        writeFileSync(stampPath, requirements + '\n', 'utf8')
        console.log(`  pip install: ${label}`)
        installed++
      } else {
        console.log(`  ! pip install failed: ${label}`)
        failed++
      }
    }
  }
}

if (found === 0 && failed === 0) console.log('  no skill dependencies to install')
process.exit(failed > 0 ? 1 : 0)
