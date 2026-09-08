---
name: sdlc-deploy
description: "Stage 5 of the AI-native SDLC: review pull requests against policy with findings ranked by severity, and ship through explicit gates with per-environment autonomy tiers so an agent acts freely in dev but can never pass the production gate. Make sure to use this skill whenever the user is reviewing a pull request or responding to review comments, setting up branch protection, CODEOWNERS or a release approval gate, running Claude non-interactively in CI, or sandboxing what an agent may reach - and whenever they mention shipping, releasing, merging or deploying, even if they never ask for a review."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Stage 5 — Deploy: review and gates

Two jobs: review what is proposed, and enforce where the agent's authority stops.

## Reviewing a PR

Read the change against the repo's policies — the loaded policy skills, `CLAUDE.md`,
and the `spec.md` and `plan.md` this branch came from. Drift from the accepted plan is
itself a finding.

**Rank findings by severity** and lead with the worst. A flat list forces the reviewer
to do the triage the review was supposed to save them:

```markdown
## Findings

### Blocking
- `api/status.py:42` — endpoint is registered outside the gateway JWT middleware.
  Policy: no anonymous routes outside `/health`.

### Should fix
- `panel/Status.tsx:88` — no cache; plan.md flagged the 50 rps limit on claims-core.

### Consider
- `api/status.py:60` — the retry loop duplicates `util.retry`.
```

For each finding: the location, what is wrong, and which policy or plan item it
violates. A finding without a rule behind it is an opinion, and should be labelled as
one under Consider.

Say plainly when a diff is clean. Manufacturing findings to look thorough is how
reviewers learn to skim.

When review comments come back — including via `@claude` tags on the PR — address them
in the branch and reply on the thread saying what changed. Do not resolve a thread you
did not act on.

## The gate structure

**Branch protection turns anything the agent writes into a PR, with no direct path to
main.** That is the foundation; the rest sits on top.

- **Branch protection** — no direct pushes to the default branch.
- **CODEOWNERS** — approval comes from a human who owns that code.
- **Release authorization** — production needs a named release manager.

## Autonomy tiers per environment

| Environment | The agent | The gate |
| --- | --- | --- |
| Development | Deploys freely | None |
| Staging | Deploys, within configured limits | Configuration, not a person |
| Production | Prepares the release only | A named release manager authorizes |

**The agent may act up to the production gate and cannot pass it.** Not "should not" —
cannot. Encode it as a hook, because a skill only makes compliance likely:

```bash
if [[ "$cmd" == *"deploy"* && "$cmd" == *"production"* ]]; then
  if [ -z "$RELEASE_APPROVAL" ]; then
    echo "Production deploys need a release authorization." >&2
    exit 2
  fi
fi
```

This plugin ships that gate, driven by `.claude/sdlc.json` so each repo names its own
deploy commands and approval variable. See the plugin README.

## Claude in CI

Run non-interactively in the pipeline for review and checks. Two things to get right:

- **Least privilege.** The pipeline token can open a PR and comment; it cannot merge,
  cannot push to main, cannot deploy to production. The gates above are worthless if CI
  holds credentials that bypass them.
- **No silent failure.** A review job that errors must fail the check, not pass quietly.
  A gate that fails open is not a gate.

Deployment tooling reached through MCP inherits the same tiering: whatever the agent
can call, it can call unattended, so production actions belong behind the gate rather
than behind an instruction not to use them.

## Sandboxing

Where the platform supports managed settings, constrain what a session can reach:

- **Deny** secrets — `~/.ssh`, `~/.aws/credentials` and equivalents — plus `WebFetch`
  and arbitrary `curl`/`wget`.
- **Allow** the working set: `git`, and the repo's build, test and lint commands.
- An OS-level domain allowlist **blocks egress outright**, and a command that fails
  inside the sandbox **cannot be retried outside it**. That second property is what
  makes the boundary real rather than advisory.

## Definition of done

- Findings are ranked, located, and tied to a policy, plan item or spec requirement.
- Drift from the accepted plan is called out explicitly.
- The branch cannot reach main except through review.
- Production is gated by a hook keyed to a named authorization, and you have verified
  the hook actually fires rather than assuming it does.
