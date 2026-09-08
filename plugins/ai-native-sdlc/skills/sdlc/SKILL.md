---
name: sdlc
description: Router and reference for the AI-native SDLC — the six stages (plan, design, build, test, deploy, maintain), the committed artifact chain that links them, and the skills-vs-hooks control model. Use when the user asks about the AI-native SDLC or the playbook, wants to set the workflow up in a repo, asks which stage comes next or where a piece of work stands, or says something like "run the SDLC", "start a new feature properly", or "wire up the SDLC gates".
tools: Read, Glob, Grep, Bash, Write, Edit
---

# The AI-native SDLC

Six stages. Each one **ends by writing a single artifact to version control**, and the
next one **begins by reading it**. That chain is the whole design: it is the handoff
mechanism, the audit trail, and the reason a stage can be re-run without re-deriving
everything before it.

```
intent.md  ->  spec.md  ->  plan.md  ->  diff + tests  ->  PR review  ->  incident record
  plan        design        build           test             deploy         maintain
```

## Routing

| The user is doing | Stage | Skill | Artifact |
| --- | --- | --- | --- |
| Capturing a raw idea or request | Plan | `sdlc-plan` | `intent.md` |
| Turning intent into requirements + design | Design | `sdlc-design` | `spec.md` |
| Deciding what code to change | Build | `sdlc-build` | `plan.md`, `CLAUDE.md` |
| Proving the change works | Test | `sdlc-test` | test output, eval results |
| Reviewing, gating and shipping | Deploy | `sdlc-deploy` | PR with ranked findings |
| Watching production, responding | Maintain | `sdlc-maintain` | diagnosis, new `intent.md` |

Load the stage skill rather than working from this page. This one exists to answer
"where are we?" and "what comes next?".

## Where the work lives

Default layout, one directory per unit of work:

```
docs/sdlc/<slug>/
  intent.md
  spec.md
  plan.md
```

`CLAUDE.md` lives at the repo root (and optionally per package). `.claude/sdlc.json`
holds the repo's gate configuration — see `sdlc-deploy` and the plugin README.

Before creating a new `docs/sdlc/<slug>/`, check whether the repo already has a
convention (an `adr/`, `rfcs/`, `docs/proposals/` directory) and follow it instead.
**One system is authoritative per artifact**; everything else holds a copy or a link.
If specs live in Jira or Notion, the repo holds the link, not a second copy that drifts.

## The control model

This is the distinction that makes the rest coherent:

- **Skills are advisory.** They make it *likely* the model applies a policy. Use them
  for judgment, formatting, review criteria, house style.
- **Hooks are deterministic.** They enforce a policy *every time*, regardless of what
  the model decides. Use them for anything that must hold without exception.

**Back any skill whose policy has to hold without exception with a hook.** A
`secure-api-review` skill that says "no anonymous routes" is a good reviewer and a bad
gate. The hook is the gate.

This plugin ships three hooks — protected paths, test-lock during bug fixes, and the
production deploy gate. They are inert until a repo opts in with `.claude/sdlc.json`.
See the plugin README to enable them.

## Principles that cut across every stage

**Humans remain accountable for every decision that requires judgment.** The stages
move where that judgment is spent, not whether it is spent.

**Attention concentrates at the gates.** A reviewer reads what the agent flagged
instead of starting the stage from scratch. That only works if each stage genuinely
flags its concerns — a stage that reports "all good" by default has broken the chain.

**Build is no longer the constraint.** The human-speed steps around it are. When
optimising, look at the queue in front of review and approval, not at code generation.

**Design review happens when changing course is cheap.** Disagreeing with a document
costs a paragraph. Disagreeing with a merged branch costs a rewrite. Push contention
upstream on purpose.

## Running a stage

1. Read the previous artifact. If it is missing, say so and offer to run that stage
   first — do not silently infer what it would have said.
2. Do the stage's work with its skill.
3. Write the artifact, commit it, and state explicitly what the next stage is and who
   has to approve before it starts.
