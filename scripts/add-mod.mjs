#!/usr/bin/env node
// Promote a mod - a plugin whose components are hooks modules - into this
// marketplace, so it syncs to every machine like any other plugin.
//
//   node scripts/add-mod.mjs <path-to-mod-dir>
//
// Mods are authored under ~/.claude/dev-mods/<session-id>/<mod-name>/, which is
// session-scoped and never synced. This copies one into plugins/<mod-name>/ and
// registers it in marketplace.json.
//
// A mod always becomes its own plugin: a plugin has exactly one
// hooks/hooks.json, so two mods cannot share one without merging their module
// lists by hand. There is deliberately no --into.

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { basename, join, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensurePluginManifest, registerInMarketplace, bumpPatch } from './lib/marketplace.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const srcArg = args.find((a) => !a.startsWith('--'))

if (!srcArg) {
  console.error('usage: node scripts/add-mod.mjs <path-to-mod-dir>')
  process.exit(2)
}

const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
const expanded = srcArg === '~'
  ? home
  : (srcArg.startsWith('~/') || srcArg.startsWith('~' + sep)) ? join(home, srcArg.slice(2)) : srcArg
const src = resolve(expanded)

// A mod is identified by its hooks manifest, not by a SKILL.md.
const srcHooks = join(src, 'hooks', 'hooks.json')
const srcManifest = join(src, '.claude-plugin', 'plugin.json')
if (!existsSync(srcHooks)) {
  console.error(`! ${src} has no hooks/hooks.json - not a mod`)
  console.error('  (a skill belongs in scripts/add-skill.mjs instead)')
  process.exit(1)
}
if (!existsSync(srcManifest)) {
  console.error(`! ${src} has no .claude-plugin/plugin.json`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(srcManifest, 'utf8'))
const modName = manifest.name || basename(src)
const description = manifest.description ?? `Mod: ${modName}`
const pluginDir = join(repoRoot, 'plugins', modName)

// Warn rather than fail: the engine loads by the manifest name, so a mismatched
// folder name is confusing but harmless.
if (manifest.name && manifest.name !== basename(src)) {
  console.log(`! plugin.json names '${manifest.name}' but the folder is '${basename(src)}' - using '${manifest.name}'`)
}

const hooks = JSON.parse(readFileSync(srcHooks, 'utf8'))
if (!Array.isArray(hooks.modules) || hooks.modules.length === 0) {
  console.log("! hooks.json has no 'modules' array - copying anyway, but the engine loads nothing")
}

const replacing = existsSync(pluginDir)
if (replacing) console.log(`! plugins/${modName} already exists - replacing its hooks and manifest`)

// Copy only what the engine needs. .claude-plugin/types/ is written by the
// engine after the mod loads, like node_modules - it is never committed.
mkdirSync(pluginDir, { recursive: true })
const skip = (p) => {
  const parts = p.split(sep)
  return parts.includes('node_modules') || parts.includes('.claude-plugin') && parts.includes('types')
}

rmSync(join(pluginDir, 'hooks'), { recursive: true, force: true })
cpSync(join(src, 'hooks'), join(pluginDir, 'hooks'), { recursive: true, filter: (p) => !skip(p) })
console.log(`copied ${src}`)
console.log(`    -> plugins/${modName}/hooks`)

// A $.state contract, when the mod declares one.
if (manifest.types) {
  const typesDir = join(src, dirname(manifest.types))
  if (existsSync(typesDir)) {
    rmSync(join(pluginDir, 'types'), { recursive: true, force: true })
    cpSync(typesDir, join(pluginDir, 'types'), { recursive: true, filter: (p) => !skip(p) })
    console.log(`    -> plugins/${modName}/types`)
  } else {
    console.log(`! plugin.json names types '${manifest.types}' but ${typesDir} is missing`)
  }
}

// Carry the mod's own manifest across, bumping the patch version on a replace so
// the install cache actually picks the change up.
const destManifestPath = join(pluginDir, '.claude-plugin', 'plugin.json')
const previous = existsSync(destManifestPath) ? JSON.parse(readFileSync(destManifestPath, 'utf8')) : null
const outgoing = { ...manifest, name: modName }
outgoing.author ??= { name: 'jazwinn' }

if (previous) {
  const bumped = bumpPatch(previous.version)
  if (manifest.version && manifest.version !== previous.version) {
    console.log(`version ${previous.version} -> ${outgoing.version} (from the mod's plugin.json)`)
  } else if (bumped) {
    outgoing.version = bumped
    console.log(`version ${previous.version} -> ${bumped} (bumped so the plugin cache refreshes)`)
  }
}

mkdirSync(dirname(destManifestPath), { recursive: true })
writeFileSync(destManifestPath, JSON.stringify(outgoing, null, 2) + '\n', 'utf8')
if (!previous) console.log(`created plugins/${modName}/.claude-plugin/plugin.json`)

ensurePluginManifest({ pluginDir, pluginName: modName, description, version: outgoing.version })
registerInMarketplace({ repoRoot, pluginName: modName, description })

console.log(`\nNext: claude plugin validate . && git add -A && git commit -m "Add the ${modName} mod"`)
