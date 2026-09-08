---
name: sdlc-design
description: "Stage 2 of the AI-native SDLC: read an approved intent.md and produce spec.md from the bundled assets/spec.md template, collapsing requirements and design into one session while applying organizational policy skills (security, compliance, brand, UX) live rather than discovering them in a later review. Make sure to use this skill whenever an intent needs turning into requirements and a design, whenever the user says 'write the spec', 'design this' or 'how should we build this', and whenever a spec needs checking against policy - including when they frame it as just sketching, since requirements and design belong in one pass."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion
---

# Stage 2 — Design: intent into spec

Requirements and design **collapse into a single prompted session**. The traditional
split exists because they were done by different people at different times; when one
session holds the whole context, the handoff between them is pure overhead.

Read `intent.md`. Write `spec.md` beside it. Do not start without an approved intent —
if it is missing or still `draft`, say so and stop.

## What spec.md contains

Start from `assets/spec.md` in this skill directory. It contains:

```markdown
# <Title>

Source: intent.md (approved <date> by <name>). Status: draft.

## Requirements
Numbered, testable statements. Each one traceable to something in the intent.

## Design
The approach. Components touched, data flow, interfaces, states, failure modes.

## Policy findings
Concerns raised while writing this, each mapped to the owner who has to rule on it.

## Open questions
From the intent: answered here, or carried forward with a reason.

## Out of scope
What this deliberately does not do, so the build stage does not rediscover it.
```

## Apply policy while writing, not afterwards

This is the point of the stage. Whatever organizational skills the repo or user has
loaded — security, compliance, brand, accessibility, data handling, UX policy — apply
them **as the spec is written**. A policy discovered during a later review is a rewrite;
a policy applied during drafting is a sentence.

For each concern, record it in Policy findings with the **owner who decides**, not a
vague flag:

```markdown
- Handling claims data puts this in scope for the retention policy.
  Owner: Data Governance. Needs: a ruling on the 90-day window before build starts.
```

If no policy skills are loaded and the work is clearly regulated or externally facing,
say so plainly — an unpoliced spec in that situation is a finding in itself.

## Resolve or carry forward, never drop

Every open question from the intent gets one of two fates in the spec:

- **Answered** — with the answer and who gave it.
- **Carried forward** — with why it is still open and what unblocks it.

Silently dropping a question is the failure mode that makes the chain untrustworthy.

## Requirements have to be testable

The test stage reads these. "The panel should be fast" cannot be verified; "the panel
renders within 500 ms at the 95th percentile with 200 claims" can. If the intent gave
you a soft target, pin it down here or record it as an open question with an owner.

## Definition of done

- Every requirement traces to the intent; anything new is marked as an addition and
  justified.
- Policy findings each name an owner and what they must decide.
- Open questions are all answered or carried forward with a reason.
- Out of scope is populated — an empty one usually means scope was never tested.
- The file is committed, and you have stated which findings block the build stage.
