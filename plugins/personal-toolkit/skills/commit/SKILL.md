---
name: commit
description: "Stage and write git commits that produce a high-signal, professional history: Conventional Commits format, atomic changes, imperative subjects, and bodies that explain why rather than what. Make sure to use this skill whenever the user says 'commit', 'commit this', 'stage and commit', 'write a commit message', 'clean up my history' or 'squash these', whenever a change is finished and about to be committed, whenever a large working tree needs splitting into separate commits, and before opening a pull request. Use it even when the change looks small enough that the message seems obvious."
allowed-tools: Bash, Read, Grep, Glob
---

# Commit

A commit history is read far more often than it is written — by reviewers, by
whoever bisects a regression a year from now, and by anyone assessing how you
work. Optimise for the reader.

## Workflow

Never skip step 1. Writing a message before reading the diff produces a message
that describes the task you were given rather than the change you actually made.

1. **Read the change.** Run these together and read all of it:
   ```bash
   git status --short && git diff --stat && git diff && git diff --staged
   ```
2. **Match the repo's existing conventions.** Run `git log --oneline -15`. If
   the repo does not already use Conventional Commits, follow whatever style it
   does use — a consistent history beats a correct-by-this-document one. Only
   apply the format below when the repo already uses it or has no convention.
3. **Decide the groupings.** One logical change per commit. If the working tree
   holds several unrelated changes, commit them separately rather than as one.
4. **Stage deliberately.** Name the paths: `git add src/auth/token.ts`. Never
   `git add -A` or `git add .` — unrelated dirty files stay dirty.
5. **Write the message** per the format below, using a heredoc so the body keeps
   its line breaks:
   ```bash
   git commit -F - <<'EOF'
   feat(auth): add JWT token rotation

   Refresh tokens were long-lived, so a leaked token stayed valid until
   expiry. Rotate on every refresh and revoke the previous token.
   EOF
   ```
6. **Verify.** Run `git log -1 --stat` and confirm the message matches what was
   actually committed. If the commit failed, read the error before retrying.

## Message format

```text
<type>(<scope>): <imperative summary>

<body: why this change, and why this approach>

<footer: refs and breaking changes>
```

- **Subject line** — 72 characters hard limit, 50 preferred, counted *including*
  the `type(scope): ` prefix. Imperative mood, lowercase after the colon, no
  trailing period. It must complete the sentence *"If applied, this commit
  will… ."*
- **Scope** — the module, layer or feature area touched: `auth`, `api`, `db`,
  `ui`, `deps`. Omit the parentheses entirely if the change is repo-wide.
- **Body** — wrap at 72 columns. Explain the trade-off, the constraint, or the
  non-obvious reason. Skip it when the subject genuinely says everything; a body
  that restates the subject is noise.
- **Footer** — `Refs: #123`, `Closes #123`. For a breaking change, mark the
  subject `feat(api)!:` *and* add a `BREAKING CHANGE: <what breaks and what to
  do about it>` footer.

## Types

| Type | When to use | Example |
| :--- | :--- | :--- |
| `feat` | New capability or behaviour | `feat(auth): add JWT token rotation` |
| `fix` | Corrects broken behaviour | `fix(api): resolve race in webhook retries` |
| `perf` | Faster, smaller, or less memory | `perf(ui): lazy-load charts to cut bundle 30%` |
| `refactor` | Restructures without changing behaviour | `refactor(db): replace nested loops with a hash map` |
| `test` | Adds or improves tests | `test(cache): cover redis eviction edge cases` |
| `docs` | Documentation only | `docs(readme): add architecture diagram` |
| `style` | Formatting only, no logic change | `style(api): apply prettier to route handlers` |
| `build` | Build system or dependencies | `build(deps): upgrade typescript to v5` |
| `ci` | CI configuration and pipelines | `ci: run the test matrix on pull requests` |
| `chore` | Housekeeping that fits nothing above | `chore: drop the unused fixtures directory` |
| `revert` | Reverts an earlier commit | `revert: feat(auth): add JWT token rotation` |

## Accuracy

The body is a claim about the code, and a reviewer can check it.

- Every claim must be supported by the diff or by a measurement actually taken.
  Do not write "cuts bundle size 30%" unless 30% was measured — write what the
  change does and leave the number out.
- Do not describe intent the code does not yet implement.
- Do not credit the commit with fixing something it does not touch.

## Atomic commits

One reviewable idea per commit. A refactor plus the feature it enabled are two
commits, not one: the reviewer can then check the refactor preserved behaviour
before reasoning about the new logic.

If the working tree has already mixed several changes, split it — `git add -p`
stages individual hunks. Each commit must leave the tree in a working state; a
commit that does not build is not atomic, it is a fragment.

## Squashing

Squash *noise* — `fix typo`, `wip`, `debug log`, `address review comment` — into
the commit it belongs to, with `git rebase -i` before the branch is merged.

Do not squash a branch of genuinely atomic commits into one. The incremental
history is the thing worth showing; collapsing it discards exactly what makes it
readable.

## Never

- **Never add attribution, trailers, emoji, or "Generated with…" footers** to a
  commit message unless the user explicitly asks for them.
- **Never amend, rebase, or force-push a commit that is already on a shared
  branch.** Check with `git branch -r --contains HEAD` when unsure.
- **Never use `--no-verify`.** If a pre-commit hook fails, fix what it flagged.
- **Never commit secrets.** Scan the diff for `.env` files, API keys, tokens,
  private keys and credentials before staging. If one is already committed,
  stop and tell the user — rotating the secret matters more than the history.
- **Never run `git checkout --`, `git reset --hard`, `git clean` or `git stash`
  to tidy up before committing.** That destroys work the user has not saved.
- **Never commit on the user's behalf when they only asked you to write the
  message.** Show it and wait.
