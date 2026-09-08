# Skillz

My personal Claude Code marketplace — skills, plugins, agents, slash commands and
settings, synced across every machine I work on.

## Set up a new machine

```bash
git clone https://github.com/jazwinn/Skillz
cd Skillz
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync.ps1
```

**macOS / Linux / WSL:**
```bash
./scripts/sync.sh
```

Then restart Claude Code. That's it — the script registers the marketplaces,
installs and enables every plugin, merges the shared settings, and installs any
npm dependencies the skills need. It's idempotent, so re-run it any time.

## Day-to-day

| I want to... | Run |
| --- | --- |
| Pull down changes made on another PC | `./scripts/sync.sh` (or `sync.ps1`) |
| Push local tweaks up to the repo | `node scripts/capture.mjs` then commit & push |
| Add a skill sitting in `~/.claude/skills` | `node scripts/add-skill.mjs ~/.claude/skills/<name>` |
| Check the manifests are valid | `claude plugin validate .` |

Both sync scripts accept `--no-pull` (skip `git pull`) and `--dry-run-settings`
(show the settings merge without writing). `capture.mjs` accepts `--dry-run`.

## What's in here

| Plugin | What it gives you |
| --- | --- |
| `personal-toolkit` | Catch-all for standalone agents, slash commands and small skills |
| `pretty-mermaid` | Renders Mermaid diagrams as themed SVG or terminal ASCII |
| `ai-native-sdlc` | Six-stage SDLC skills plus hooks that enforce the gates |

Third-party plugins aren't vendored — they're pinned by reference in
`config/upstream.json` and reinstalled from their own marketplaces:

| Plugin | From |
| --- | --- |
| `clangd-lsp` | `anthropics/claude-plugins-official` |
| `skill-creator` | `anthropics/claude-plugins-official` |

## Adding things

**A new skill** — drop it in `~/.claude/skills/<name>/` and work on it there until
it's good, then promote it:

```bash
node scripts/add-skill.mjs ~/.claude/skills/<name>
```

That copies it in (minus `node_modules`), writes a `plugin.json`, and registers it
in `marketplace.json`. Add it to an existing plugin instead with
`--into personal-toolkit`.

**A new agent or slash command** — write it at `~/.claude/agents/<name>.md` or
`~/.claude/commands/<name>.md`, then `node scripts/capture.mjs` pulls it into
`personal-toolkit`.

**A third-party plugin** — install it normally, then add its id and marketplace to
`config/upstream.json` so other machines pick it up.

**A setting worth sharing** — add the key to `config/settings.json`. From then on
`capture.mjs` keeps it in step with your local value, and `sync` pushes it to your
other machines. Keys *not* listed there are left alone on every machine.

## How the settings merge works

`config/settings.json` is the shared subset, not a replacement:

- objects merge recursively; arrays (like `permissions.allow`) are unioned
- a key present in both — the repo's value wins
- a key only in `~/.claude/settings.json` is left untouched

The previous file is backed up to `~/.claude/settings.json.bak-<timestamp>` before
anything is written.

## Notes

**Plugins are copied, not linked.** `claude plugin install` copies each plugin into
`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. Editing the repo does
**not** change what Claude loads until you re-run sync. That also means a plugin
update wipes the cached copy's `node_modules`, which is why sync runs
`scripts/install-deps.mjs` against the *installed* paths rather than the repo.

**The clone can live anywhere.** Sync registers the marketplace by the local path it
finds itself at, so each machine can put the repo wherever it likes. That path is
recorded in `~/.claude/settings.json` under `extraKnownMarketplaces` — a
machine-specific key, deliberately not tracked in `config/settings.json`.

**Don't keep a skill in both places.** A skill under `~/.claude/skills/<name>/` and
the same skill inside a plugin will both load. Once a skill is promoted into this
repo and syncing works, delete the loose copy in `~/.claude/skills/`.
