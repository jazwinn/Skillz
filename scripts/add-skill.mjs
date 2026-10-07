#!/usr/bin/env node
// Promote a standalone skill directory into a plugin in this marketplace.
//
//   node scripts/add-skill.mjs <path-to-skill-dir> [--into <plugin>]
//
// By default the skill becomes its own plugin (plugins/<skill>/skills/<skill>/).
// With --into it is added to an existing plugin instead, e.g.
//   node scripts/add-skill.mjs ~/.claude/skills/my-skill --into personal-toolkit
//
// The source directory is copied, never moved, and node_modules is excluded.

import { readFileSync, existsSync, mkdirSync, cpSync } from 'node:fs'
import { basename, join, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensurePluginManifest, registerInMarketplace } from './lib/marketplace.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const intoIdx = args.indexOf('--into')
const intoPlugin = intoIdx === -1 ? null : args[intoIdx + 1]
const srcArg = args.find((a, i) => !a.startsWith('--') && !(intoIdx !== -1 && i === intoIdx + 1))

if (!srcArg) {
  console.error('usage: node scripts/add-skill.mjs <path-to-skill-dir> [--into <plugin>]')
  process.exit(2)
}

const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
const expanded = srcArg === '~'
  ? home
  : (srcArg.startsWith('~/') || srcArg.startsWith('~' + sep)) ? join(home, srcArg.slice(2)) : srcArg
const src = resolve(expanded)
if (!existsSync(join(src, 'SKILL.md'))) {
  console.error(`! ${src} does not contain a SKILL.md`)
  process.exit(1)
}

const skillName = basename(src)
const pluginName = intoPlugin ?? skillName
const pluginDir = join(repoRoot, 'plugins', pluginName)
const destSkill = join(pluginDir, 'skills', skillName)

// Pull the description out of the SKILL.md frontmatter for the manifests.
const fm = readFileSync(join(src, 'SKILL.md'), 'utf8').split(/\r?\n/)
let description = `Skill: ${skillName}`
if (fm[0] === '---') {
  const close = fm.indexOf('---', 1)
  const body = close === -1 ? [] : fm.slice(1, close)
  const idx = body.findIndex((l) => l.startsWith('description:'))
  if (idx !== -1) {
    const value = body[idx].slice('description:'.length).trim()
    if (value && !['|', '>', '|-', '>-', '|+', '>+'].includes(value)) {
      description = value.replace(/^["']/, '').replace(/["']$/, '')
    } else {
      // Block scalar - use its first non-empty continuation line.
      const first = body.slice(idx + 1).map((l) => l.trim()).find(Boolean)
      if (first) description = first
    }
  }
}

if (existsSync(destSkill)) {
  console.log(`! plugins/${pluginName}/skills/${skillName} already exists - overwriting its contents`)
}
mkdirSync(destSkill, { recursive: true })
cpSync(src, destSkill, {
  recursive: true,
  filter: (p) => !p.split(sep).includes('node_modules'),
})
console.log(`copied ${src}`)
console.log(`    -> plugins/${pluginName}/skills/${skillName}`)

// A brand-new plugin needs a manifest and a marketplace entry.
ensurePluginManifest({ pluginDir, pluginName, description })
registerInMarketplace({ repoRoot, pluginName, description })

// Plugins are cached by version, so an unchanged version is a silent no-op.
console.log(`
Bump the version in plugins/${pluginName}/.claude-plugin/plugin.json whenever
you change its contents, or the edit never reaches the plugin cache.`)

console.log(`\nNext: claude plugin validate . && git add -A && git commit -m "Add ${skillName}"`)
