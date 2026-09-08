# ai-native-sdlc

Seven skills that run the six-stage AI-native SDLC, plus the hooks that enforce its
gates. Based on Anthropic's [AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook).

The design in one line: **each stage ends by writing one artifact to version control,
and the next stage begins by reading it.**

```
intent.md  ->  spec.md  ->  plan.md  ->  diff + tests  ->  PR review  ->  incident record
  plan        design        build           test             deploy         maintain
```

## Skills

| Skill | Stage | Produces |
| --- | --- | --- |
| `sdlc` | — | Router: the chain, the control model, where work lives |
| `sdlc-plan` | 1. Plan | `intent.md` in the originator's own words |
| `sdlc-design` | 2. Design | `spec.md` with policy findings mapped to owners |
| `sdlc-build` | 3. Build | `plan.md`, and `CLAUDE.md` upkeep |
| `sdlc-test` | 4. Test | Self-verification, failing-test-first fixes, CI evals |
| `sdlc-deploy` | 5. Deploy | Ranked PR findings, gates, autonomy tiers |
| `sdlc-maintain` | 6. Maintain | Control bands, tiered response, new `intent.md` |

Each triggers on its own stage's work, so only the relevant one loads. Ask for `sdlc`
when you want the map.

## Hooks

**Skills are advisory — they make it likely a policy is applied. Hooks are
deterministic — they enforce it every time.** Back any policy that has to hold without
exception with a hook.

`hooks/sdlc-guard.mjs` runs on `PreToolUse` and enforces three gates:

| Gate | Blocks |
| --- | --- |
| `protectedPaths` | Edits to generated or frozen files |
| `testPaths` + lock | Edits to tests while a bug fix is in progress |
| `deployGate` | Production deploys without a named authorization |

**The guard is inert until a repo opts in.** With no `.claude/sdlc.json` it allows
everything, silently — so enabling the plugin globally changes nothing until you ask
it to.

### Enabling it in a repo

```bash
mkdir -p .claude
cp "$CLAUDE_PLUGIN_ROOT/templates/sdlc.json" .claude/sdlc.json
# edit the paths and deploy commands to match this repo, then commit it
```

```json
{
  "protectedPaths": ["src/generated/**", "v1/**"],
  "testPaths": ["tests/**", "**/*.test.ts"],
  "fixLockFile": ".claude/sdlc-fix.lock",
  "deployGate": {
    "match": ["*deploy*production*"],
    "approvalEnv": "RELEASE_APPROVAL"
  }
}
```

Globs support `**`, `*` and `?`, matched against repo-relative paths. A pattern ending
in `/` matches everything beneath it. `deployGate.match` patterns are matched against
the whole command line, where `*` spans anything.

### The test lock

```bash
touch .claude/sdlc-fix.lock   # tests are now frozen
# ... write the failing test first, then fix the source ...
rm .claude/sdlc-fix.lock
```

This is a discipline guardrail, not a security boundary: the agent can remove the lock,
and the point is that doing so is a deliberate, visible act rather than a quiet edit
mid-fix. `sdlc-test` instructs it to stop and say so instead.

### Verifying a gate fires

Do not assume a gate works. Check it:

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"src/generated/api.ts"},"cwd":"'"$PWD"'"}' \
  | node "$CLAUDE_PLUGIN_ROOT/hooks/sdlc-guard.mjs"
```

A blocked action prints a `permissionDecision: deny` payload. Silence means allowed —
usually a missing `.claude/sdlc.json` or a glob that does not match.

## Bundled assets

Each stage skill ships the template it writes, so the template travels with the skill:

| Skill | Assets |
| --- | --- |
| `sdlc-plan` | `assets/intent.md` |
| `sdlc-design` | `assets/spec.md` |
| `sdlc-build` | `assets/plan.md`, `assets/CLAUDE.md` |
| `sdlc-maintain` | `assets/bands.yaml` |

`templates/sdlc.json` stays at plugin level because it configures the hook, not a
skill's output.

Every skill also carries `evals/evals.json` — two positive cases plus two negatives
that must *not* trigger it. Run them with `claude plugin eval`, or with skill-creator's
`run_eval.py` for a graded with-skill vs baseline comparison.

The maintain-stage **detector is deliberately not shipped** — it has to read your
metrics from your system, so a generic one would be a stub pretending to be machinery.
`sdlc-maintain` covers how to build it and what authority each band grants.

## What this does not do

It does not configure branch protection, CODEOWNERS, CI, or managed settings. Those
live in your forge and platform, and the deploy gate is worthless if CI holds
credentials that bypass them — `sdlc-deploy` covers what to set, but setting it is
outside any plugin's reach.
