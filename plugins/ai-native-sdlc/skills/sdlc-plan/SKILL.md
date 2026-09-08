---
name: sdlc-plan
description: Stage 1 of the AI-native SDLC — capture a raw idea, request or bug report as a version-controlled intent.md proto-spec in the originator's own words. Use when someone brings an unformed idea, feature request, complaint or problem and it needs writing down before anyone designs it; when the user says "capture this", "write it up", "file an intent"; or when a diagnosis from the maintain stage needs to re-enter the pipeline as new work.
tools: Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion
---

# Stage 1 — Plan: capture intent

The output is `intent.md`: a proto-spec, committed to version control, **in the
originator's own words**. It is not a spec and must not try to be one. Its job is to
stop ideas from waiting for someone with time to write them up.

Write to `docs/sdlc/<slug>/intent.md` unless the repo has its own convention.

## The five sections

```markdown
# <Short title>

Author: <name> (<team or role>). Status: draft.

## Problem statement
What is wrong today, described concretely. Who hits it, how often, what it costs them.

## Proposed outcome
What "better" looks like from the originator's point of view. Not a design.

## Affected users and systems
Who is touched, which services and data are involved, what integrations are in play.

## Constraints
Deadlines, budgets, regulatory limits, systems that cannot change, decisions already made.

## Open questions
Everything genuinely unresolved. These carry forward into the spec.
```

## How to run it

**Interview, do not compose.** The value of this artifact is that it records what the
originator actually thinks, including the parts they are unsure about. Ask about
whatever is missing from the five sections and write down the answers.

**Keep their words.** If the originator says "the portal takes forever and people
phone us instead", that belongs in the file. Do not upgrade it to "latency degrades
self-service conversion". The person reviewing this needs to hear the originator, not
you.

**Do not solve it.** No architecture, no endpoint names, no library choices, no
schema. If a solution is obvious to you, put it in Open questions as a question. The
design stage owns that decision, and pre-empting it here removes the one cheap chance
to disagree.

**Leave the unknowns visible.** An empty Open questions section on a non-trivial
intent means the interview was too shallow. Unresolved is a legitimate state for this
document; guessing is not.

**Say who is affected, specifically.** "All users" is almost never true and hides the
constraint that matters. Name the team, the segment, the calling system.

## Definition of done

- The five sections are present and none is a placeholder.
- The originator is named, and `Status:` reflects reality (`draft` until they confirm).
- No solution has been smuggled into the problem statement.
- The file is committed.
- **The product owner has reviewed and approved it before handoff to design.** This is
  a human gate. Do not proceed to `sdlc-design` on your own initiative — write the
  file, commit it, and say who needs to approve.

## When intent comes from the maintain stage

An agent that diagnosed a production problem writes its own `intent.md` and enters
here — that is how the loop closes. Same five sections. The Author line names the
detector or runbook that fired, the problem statement carries the evidence (metric,
window, deviation), and Status stays `draft` until a human owns it. It does not skip
the approval gate for being machine-authored.
