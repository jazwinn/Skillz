---
name: sdlc-build
description: "Stage 3 of the AI-native SDLC: turn an approved spec.md into an accepted plan.md before any code is written, using the bundled assets/plan.md template, and keep institutional knowledge in CLAUDE.md so every session starts informed. Make sure to use this skill whenever implementation is about to start, whenever the user says 'plan the work', 'implement the spec', 'start building' or 'write CLAUDE.md', whenever parallel worktree sessions are being set up, and whenever a repository needs its protected paths and build conventions written down. Use it before writing code even when the change looks small enough to skip planning."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion
---

# Stage 3 — Build: plan, then implement

**Nothing is implemented without an accepted plan.** Use plan mode to produce
`plan.md` from the spec, get it accepted, then build. The plan is where course
changes are cheap — editing a document instead of rewriting a branch.

## plan.md

Start from `assets/plan.md` in this skill directory; `assets/CLAUDE.md` is the
template for the CLAUDE.md section further down.

```markdown
# Plan: <title>

Source: spec.md (approved <date>). Status: proposed.

## Files that change
- `src/api/status.py` — new endpoint
- `web/panel/Status.tsx` — new component
- `web/portal/nav.tsx` — one entry added

## Order of work
1. Add the status endpoint behind existing auth.
2. Panel against the endpoint.
3. Wire into the portal nav.

## Risks
- The claims-core API rate-limits at 50 rps; the panel must cache.
- The legacy `v1/` package is frozen; changes go in `v2/`.

## Proof
Tests and acceptance criteria that will show this works. The test stage reads this.
```

Four sections, all of them load-bearing:

**Files that change** with real paths, from actually looking at the repo. A plan
listing files that do not exist has not been grounded and will not survive contact.

**Order of work** as numbered steps, sequenced so each one is independently verifiable.
If step 3 cannot be checked until step 5 lands, the ordering is wrong.

**Risks** naming the specific thing that could go wrong in *this* repo — a frozen
package, a rate limit, a migration that cannot roll back, a shared fixture. Generic
risk boilerplate is worse than none: it trains the reviewer to skim.

**Proof** stated before implementation, so the test stage inherits a target instead of
inventing one after the fact.

## Do not put approval prompts inside the build

An approval prompt during the build puts a person back on the critical path of every
session running in parallel. That is precisely the bottleneck this design removes.

Approval belongs at the plan (before) and the PR (after). Between them the agent runs
unattended, and anything that must not happen is enforced by a **hook**, not by asking.
If you find yourself wanting to prompt mid-build, that is a signal to write a hook —
see the plugin README for the protected-paths guard.

## CLAUDE.md

Institutional knowledge, read at the start of every session. Four sections:

```markdown
# <Project>

## Commands
Build, test and lint, with real invocations that work in this repo.

## Conventions
Language level, patterns in use, data types, error handling, naming.

## Architecture
How components are organized and which boundaries matter.

## Things Claude gets wrong
Specific, hard-won corrections. This section earns its place fastest.
```

**Keep it under a page, because Claude reads all of it at the start of a session.**
Every line competes with the user's actual request for attention.

"Things Claude gets wrong" is where real value accumulates. Write the correction the
moment you hit it, in the imperative, with the reason:

```markdown
- Do not bump dependency versions; the platform team owns them.
- Never edit generated classes in `src/generated/`; change the schema and regenerate.
- The legacy `v1/` package is frozen; changes go in `v2/`.
```

Commit it. It is a repo artifact, not a personal setting — that is what makes it
institutional rather than individual.

Do not put in a skill what belongs in `CLAUDE.md` or a prompt. Repo facts that apply
to every session go here; reusable procedures with their own trigger go in a skill.

## Parallel work

**Worktrees** for parallel sessions — separate directories on separate branches, so
sessions do not collide in one working tree. **Subagents** for repeated jobs within a
session, when the same shaped task recurs and you only need its conclusion.

Both only pay off when the plan has already split the work into independently
verifiable steps. Parallelising an unplanned build multiplies the merge problem.

## Definition of done

- `plan.md` has all four sections, with paths verified against the repo.
- The plan was accepted before implementation started.
- Anything that must not happen during the build is enforced by a hook, not a prompt.
- `CLAUDE.md` gained any correction this session earned, and is still under a page.
- The change is ready for `sdlc-test`. Do not report done before that stage runs.
