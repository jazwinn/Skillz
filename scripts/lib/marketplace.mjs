// Shared by add-skill.mjs and add-mod.mjs: a plugin is only installable once it
// exists in BOTH its own plugin.json and the plugins array in marketplace.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

// Write plugins/<name>/.claude-plugin/plugin.json unless the plugin brought its
// own. Returns the manifest that is now on disk.
export function ensurePluginManifest({ pluginDir, pluginName, description, version = '1.0.0' }) {
  const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json')
  if (existsSync(manifestPath)) return JSON.parse(readFileSync(manifestPath, 'utf8'))

  const manifest = { name: pluginName, description, version, author: { name: 'jazwinn' } }
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`created plugins/${pluginName}/.claude-plugin/plugin.json`)
  return manifest
}

// Add the plugin to the marketplace manifest. No-op if it is already listed.
export function registerInMarketplace({ repoRoot, pluginName, description, category = 'productivity' }) {
  const marketplacePath = join(repoRoot, '.claude-plugin', 'marketplace.json')
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'))
  marketplace.plugins ??= []
  if (marketplace.plugins.some((p) => p.name === pluginName)) return false

  marketplace.plugins.push({
    name: pluginName,
    description,
    author: { name: marketplace.owner?.name ?? 'jazwinn' },
    category,
    source: `./plugins/${pluginName}`,
    homepage: `https://github.com/jazwinn/Skillz/tree/main/plugins/${pluginName}`,
  })
  marketplace.plugins.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n', 'utf8')
  console.log(`registered ${pluginName} in .claude-plugin/marketplace.json`)
  return true
}

// Plugins are cached by version, so an unchanged version number means an edited
// plugin never reaches ~/.claude/plugins/cache. Bump on every content change.
export function bumpPatch(version) {
  const parts = String(version ?? '0.0.0').split('.')
  if (parts.length !== 3 || parts.some((n) => !/^\d+$/.test(n))) return null
  return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`
}
