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
| Add a mod sitting in `~/.claude/dev-mods` | `node scripts/add-mod.mjs ~/.claude/dev-mods/<session>/<name>` |
| Check the manifests are valid | `claude plugin validate .` |

Both sync scripts take a flag to skip `git pull` and one to show the settings
merge without writing — `sync.sh` uses `--no-pull` / `--dry-run-settings`, and
`sync.ps1` uses the PowerShell forms `-NoPull` / `-DryRunSettings`.
`capture.mjs` accepts `--dry-run`.

## Automated sync

A scheduled agent runs this every morning. The procedure below is the whole
contract — it needs nothing beyond this file.

1. Fetch and compare against upstream:

   ```bash
   git fetch origin && git rev-list --left-right --count HEAD...@{u}
   ```

   The first number is commits ahead, the second is commits behind.

2. **Behind 0** — already current. Stop, and don't run the sync script.
3. **Behind > 0 and ahead > 0** — the branch has diverged. Stop and report both
   sides (`git log --oneline @{u}..HEAD` and `git log --oneline HEAD..@{u}`).
   Don't pull, merge, rebase or reset.
4. **Working tree dirty** (`git status --porcelain` prints anything) — stop and
   report the files. The sync script skips its pull in this state anyway.
5. Otherwise run the sync script for the platform, as in *Set up a new machine*
   above. It fast-forwards, registers marketplaces, installs **and updates**
   every plugin, merges settings, and installs npm dependencies. Allow it ten
   minutes; plugin installs are slow.
6. Report what arrived — `git log --oneline <sha before the pull>..HEAD` — plus
   any `!` warnings the script printed. One line is enough when nothing changed.

This is a read-and-fast-forward job. Never force-push, `reset --hard`, rebase,
stash, commit or push.

To go the other way — pull this machine's local changes back into the repo —
run `node scripts/capture.mjs`, review `git diff`, then commit and push. That is
a deliberate manual step, not part of the scheduled run.

## What's in here

| Plugin | What it gives you |
| --- | --- |
| `personal-toolkit` | Catch-all for standalone agents, slash commands and small skills |
| `pretty-mermaid` | Renders Mermaid diagrams as themed SVG or terminal ASCII |
| `ai-native-sdlc` | Six-stage SDLC skills plus hooks that enforce the gates |
| `linkedin-post-writer` | Drafts LinkedIn posts that read as written, not generated |
| `showcase-readme` | Portfolio-grade READMEs - recorded GIF demo, diagrams, badges |

Third-party plugins aren't vendored — they're pinned by reference in
`config/upstream.json` and reinstalled from their own marketplaces:

| Plugin | From |
| --- | --- |
| `clangd-lsp` | `anthropics/claude-plugins-official` |
| `skill-creator` | `anthropics/claude-plugins-official` |
| `frontend-design` | `anthropics/claude-code` |

## Adding things

**A new skill** — drop it in `~/.claude/skills/<name>/` and work on it there until
it's good, then promote it:

```bash
node scripts/add-skill.mjs ~/.claude/skills/<name>
```

That copies it in (minus `node_modules`), writes a `plugin.json`, and registers it
in `marketplace.json`. Add it to an existing plugin instead with
`--into personal-toolkit`.

**A new mod** — mods are plugins whose components are hooks modules, so they
sync like anything else once they are in here. You author one under
`~/.claude/dev-mods/<session-id>/<name>/`, which is session-scoped and never
synced, so promote it when it works:

```bash
node scripts/add-mod.mjs ~/.claude/dev-mods/<session-id>/<name>
```

That copies `hooks/` (and `types/`, if the mod declares a `$.state` contract),
carries the mod's own `plugin.json` across, and registers it in
`marketplace.json`. Re-running it bumps the patch version so the plugin cache
actually refreshes. `.claude-plugin/types/` is written by the engine after a mod
loads and is gitignored, like `node_modules`.

A mod always becomes its own plugin — there is no `--into`. A plugin has exactly
one `hooks/hooks.json`, so two mods cannot share one without merging their
module lists by hand.

**A new agent or slash command** — write it at `~/.claude/agents/<name>.md` or
`~/.claude/commands/<name>.md`, then `node scripts/capture.mjs` pulls it into
`personal-toolkit`.

**A third-party plugin** — install it normally, then run
`node scripts/capture.mjs`. It reads the installed plugin list and pins anything
user-scope from an outside marketplace into `config/upstream.json`, adding the
marketplace reference alongside it. Synced, project and inline plugins and local
directory marketplaces are skipped — none of them are reproducible from a pinned
reference. Nothing is ever unpinned, so removing a plugin everywhere stays a
deliberate edit to that file.

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

**Bump the version when you change a plugin.** `claude plugin install` is a
no-op once a plugin is installed, so sync follows it with `claude plugin update`
— and that only re-copies when `plugin.json` carries a version the cache hasn't
seen. Edit a plugin's contents without bumping its `version` and the change
silently never reaches `~/.claude/plugins/cache`, however many times you sync.

**The clone can live anywhere.** Sync registers the marketplace by the local path it
finds itself at, so each machine can put the repo wherever it likes. That path is
recorded in `~/.claude/settings.json` under `extraKnownMarketplaces` — a
machine-specific key, deliberately not tracked in `config/settings.json`.

**Don't keep a skill in both places.** A skill under `~/.claude/skills/<name>/` and
the same skill inside a plugin will both load. Once a skill is promoted into this
repo and syncing works, delete the loose copy in `~/.claude/skills/`.
