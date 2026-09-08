---
name: sdlc-test
description: Stage 4 of the AI-native SDLC — give the session a feedback loop so it verifies its own work before a human sees it, drive bug fixes from a failing test that cannot be edited during the fix, and keep evals running in CI whenever agent configuration changes. Use when a change needs verifying, when the user reports a bug to fix, when tests or builds need running before reporting done, or when setting up evals for skills, hooks or CLAUDE.md.
tools: Read, Glob, Grep, Write, Edit, Bash
---

# Stage 4 — Test: the session checks its own work

**Every session checks its own work before a human sees it.** The reviewer's attention
is the scarce resource; spending it on "does it even run" wastes it.

## Close the loop before reporting

Never report done on the strength of having written the code. Run the loop:

1. **Run the tests.** The real suite, or the targeted subset plus whatever the change
   could plausibly break.
2. **Run the build.** Compilation and type errors are the cheapest class of bug and the
   most embarrassing to hand over.
3. **Run the linter** if the repo has one wired into CI.
4. **Look at the result** for anything user-facing — a screenshot, the actual HTTP
   response, the rendered output. Not the code that should produce it.
5. **Paste the output into the session.** The evidence belongs in the transcript, not
   in a claim about the transcript.

If a step cannot run — no display, missing credentials, a service you cannot reach —
say which step and why. An unverified change reported as verified is the single most
expensive failure mode in this stage, because every gate downstream assumes this one
held.

The commands for all of this belong in `CLAUDE.md` under Commands. If they are not
there, add them once you have found them.

## Bug fixes start from a failing test

Reproduce first, in code:

1. **Write a test that fails** for the reason the bug exists. Run it. Watch it fail.
   A test that passes before the fix has not reproduced anything.
2. **Fix the source.** The test file is now frozen.
3. **Run it again.** It passes, and the rest of the suite still passes.

**The agent cannot edit the test during the fix.** That constraint is what makes the
test meaningful — a test that gets adjusted until it agrees with the code proves only
that the code exists.

Enforce it, do not merely intend it. This plugin ships a hook that blocks edits to test
paths while a fix is in progress:

```bash
# start of fix - the guard now blocks edits under the repo's configured test paths
touch .claude/sdlc-fix.lock
# ... fix the source, run the test ...
rm .claude/sdlc-fix.lock
```

See the plugin README for `.claude/sdlc.json`. Without the lock file the guard is
inert, so this stays opt-in per repo.

If the test turns out to be genuinely wrong — it asserts the wrong behaviour, not
merely an inconvenient one — stop, drop the lock, and say so explicitly. Rewriting it
quietly mid-fix is the exact move the rule exists to prevent.

## Never skip or delete a failing test

Not to get a build green, not to unblock a merge, not "temporarily". If a test fails
and you believe it is obsolete, that is a claim for a human to rule on, in the PR,
with the reasoning visible. Deleting it removes the evidence that the question was
ever asked.

The same goes for weakening an assertion, widening a tolerance, or marking it skipped.

## Evals for agent configuration

Skills, hooks, `CLAUDE.md` and subagent definitions are behaviour, and behaviour
regresses. **Run evals in CI whenever agent configuration changes.**

Treat a change to `.claude/` the way you treat a change to source: it needs a case that
would have caught the regression. `claude plugin eval` runs a plugin's suite; a case is
a prompt plus graders, with a no-plugin baseline arm for comparison.

Wire the eval job to trigger on changes to `.claude/**`, `CLAUDE.md`, and any plugin
directory, so the suite runs exactly when the risk exists.

## Definition of done

- Tests, build and lint have actually run, and their output is in the session.
- Anything user-facing has been looked at, not assumed.
- A bug fix has a test that failed first and was not touched during the fix.
- No test was skipped, deleted or weakened.
- Agent-configuration changes have eval coverage in CI.
