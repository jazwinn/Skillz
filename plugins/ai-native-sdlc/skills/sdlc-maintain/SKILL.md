---
name: sdlc-maintain
description: "Stage 6 of the AI-native SDLC: close the loop with deterministic detection that invokes Claude only when a metric leaves its control band, tiered 1/2/3-sigma responses from log to read-only diagnosis to proposing a pull request, and scheduled security scans whose findings are validated before reporting. Make sure to use this skill whenever monitoring that triggers an agent is being set up, whenever control bands or runbooks are being defined, whenever the user is responding to a production incident or alert, and whenever they mention on-call, SLOs, error rates, error budgets or recurring security scans - even if they never mention the SDLC."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Stage 6 — Maintain: close the loop

Production feeds back into intent **without a person in the path to notice it**. A
deterministic script watches the metrics; Claude is invoked only once a control band is
breached. That ordering matters — detection is cheap, deterministic and always on;
inference is expensive and reserved for the cases that earned it.

## Detection is a script, not a judgment

The watcher is ordinary code on a schedule. It computes the metric over a rolling
window, compares against a baseline with **Western Electric or similar rules**, and
invokes Claude only on a breach. Never poll by asking a model whether things look fine.

## Response tiers

Start from `assets/bands.yaml` in this skill directory.

```yaml
# bands.yaml - CI test failure rate
metric: ci_test_failure_rate
window: 7d
bands:
  1sigma: { action: log }
  2sigma: { action: diagnose, tools: "Read,Grep,Bash(gh run view *)" }
  3sigma: { action: propose, routes: [pull_request, runbook:rollback-deploy] }
```

| Band | Action | Authority |
| --- | --- | --- |
| 1σ | log | Records the excursion. No model runs. |
| 2σ | diagnose | Claude runs **read-only** and explains. It cannot change anything. |
| 3σ | propose | Claude may act — but **only** by opening a PR into the review gate, or triggering a pre-approved runbook. |

The escalation is in *authority*, not in urgency. Even at 3σ the agent does not get a
free hand: a PR still meets a human reviewer, and a runbook is a path someone approved
in advance. Grant the tool set the band allows and nothing beyond it — a 2σ diagnosis
with write tools available is a 3σ response wearing the wrong label.

## Diagnosis output

A 2σ diagnosis reports:

- **What moved** — the metric, the window, the size of the deviation.
- **What changed** — deploys, config changes, dependency bumps, traffic shifts in that
  window, with evidence.
- **The likely cause**, with confidence, and what would confirm or kill the hypothesis.
- **What it did not check**, so the reader knows the shape of the gap.

State the uncertainty honestly. A confident wrong diagnosis at 2am costs more than an
uncertain one, because it redirects the humans who could have found the real cause.

## The loop closes here

When a diagnosis identifies real work, the agent **writes an `intent.md` from it** and
that re-enters Stage 1 — same five sections, `Status: draft`, Author naming the
detector or runbook that fired, and the evidence in the problem statement. It does not
skip the product owner's approval for having been machine-authored. See `sdlc-plan`.

## Scheduled security scans

Run on a fixed cadence, not only on change — dependencies rot without commits.

**Validate findings before reporting them.** Confirm the vulnerable path is actually
reachable in this codebase and give each finding a confidence rating. An unfiltered
scanner dump is how a security channel becomes ignored, and an ignored channel is
worse than none.

Gate findings on review before merge, exactly like any other change.

**Record dismissals with a reason.** A finding waved through silently is
indistinguishable next quarter from one nobody saw. The reason is the artifact — it is
what makes the same finding cheap to re-triage instead of re-investigate.

## On-call in chat

Claude answers in the on-call channel: reads the alert, pulls the logs and recent
deploys, and posts what it found. It runs at the band's authority — in a channel that
means read-and-explain unless a runbook covers the case.

Post evidence, not reassurance. "Error rate returned to baseline at 02:14, six minutes
after the rollback of #4821" is useful; "looks fine now" is not.

## Definition of done

- Detection is deterministic and scheduled; the model is invoked only on a breach.
- Each band grants only the tools its authority allows, and 3σ routes through a PR or
  a pre-approved runbook rather than acting directly.
- Diagnoses state evidence, confidence, and what was not checked.
- Real findings leave as an `intent.md`, so the loop actually closes.
- Dismissals carry reasons.
