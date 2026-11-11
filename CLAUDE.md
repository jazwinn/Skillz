# Skillz

Personal Claude Code marketplace. Everything here is designed to be installed on
any machine by running `scripts/sync.ps1` (Windows) or `scripts/sync.sh` (macOS/Linux/WSL).

## Layout

- `.claude-plugin/marketplace.json` — the marketplace manifest; every plugin must be listed here.
- `plugins/<name>/.claude-plugin/plugin.json` — per-plugin manifest.
- `plugins/<name>/{skills,agents,commands,hooks}/` — the plugin's components.
- `config/settings.json` — the subset of `~/.claude/settings.json` shared across machines.
- `config/upstream.json` — third-party marketplaces and plugins to reinstall (references only, no vendored code).

## Rules when editing

- Adding a plugin means editing **two** files: its `plugin.json` and the `plugins` array in
  `marketplace.json`. `scripts/add-skill.mjs` (skills) and `scripts/add-mod.mjs` (mods —
  plugins whose components are hooks modules) do both — prefer them over hand-editing.
  Both share `scripts/lib/marketplace.mjs`.
- Bump a plugin's `version` whenever its contents change. Sync runs `claude plugin update`,
  which only re-copies into `~/.claude/plugins/cache` when the version is new; without a bump
  the edit silently never loads.
- `plugins/personal-toolkit/` is the catch-all for loose agents, slash commands and small skills.
  A skill big enough to have its own dependencies should be its own plugin.
- Never commit `node_modules/`. `scripts/sync` runs `npm install` where a `package.json`
  exists and `pip install -r` where a `requirements.txt` does — declare a skill's Python
  dependencies in a `requirements.txt` beside its scripts rather than documenting them in prose.
- `config/settings.json` holds only portable settings. Machine-specific values belong in
  `~/.claude/settings.json` directly — the merge preserves any key not tracked here.
- After changing any manifest, run `claude plugin validate .` before committing.
- Plugins are copied into `~/.claude/plugins/cache/` on install, so repo edits need a
  re-run of `scripts/sync` to take effect. Dependencies are installed into those cached
  paths by `scripts/install-deps.mjs`, never into the repo.
