#!/usr/bin/env bash
# Bring this machine in line with the Skillz marketplace.
#
# Pulls the repo, registers the marketplaces, installs every plugin, merges
# shared settings into ~/.claude/settings.json, and installs npm dependencies
# for bundled skills. Safe to re-run.
#
# Usage: scripts/sync.sh [--no-pull] [--dry-run-settings]

set -uo pipefail

no_pull=0
dry_run_settings=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) no_pull=1 ;;
    --dry-run-settings) dry_run_settings=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=()

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$1"; }

# Run a claude CLI command, tolerating failure. Returns 0 on success.
invoke_claude() {
  local output
  if output="$(claude "$@" 2>&1)"; then
    return 0
  fi
  warn "claude $* failed:"
  printf '      %s\n' "$output" | head -20
  return 1
}

command -v claude >/dev/null 2>&1 || { echo "The 'claude' CLI is not on PATH. Install Claude Code first." >&2; exit 1; }
command -v node   >/dev/null 2>&1 || { echo "Node.js is not on PATH. It is required to merge settings." >&2; exit 1; }

# --- 1. Pull -----------------------------------------------------------------
if [[ $no_pull -eq 0 ]]; then
  step "Pulling latest from git"
  if [[ -z "$(git -C "$repo_root" remote)" ]]; then
    warn "no git remote configured; skipping pull"
  elif [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
    warn "working tree has local changes; skipping pull (commit or stash first)"
  elif git -C "$repo_root" pull --ff-only; then
    ok "up to date"
  else
    warn "git pull failed"
    failures+=("git pull")
  fi
fi

# --- 2. Marketplaces ---------------------------------------------------------
# Each line is "<name>\t<source>": the upstream ones, then this repo itself.
marketplace_rows="$(node -e '
  const fs = require("fs");
  const root = process.argv[1];
  const up = JSON.parse(fs.readFileSync(root + "/config/upstream.json", "utf8"));
  const mk = JSON.parse(fs.readFileSync(root + "/.claude-plugin/marketplace.json", "utf8"));
  for (const m of up.marketplaces ?? []) console.log(m.name + "\t" + m.source);
  console.log(mk.name + "\t" + root);
' "$repo_root")" || { echo "failed to read manifests" >&2; exit 1; }

step "Registering marketplaces"
while IFS=$'\t' read -r name source; do
  [[ -z "$name" ]] && continue
  if invoke_claude plugin marketplace add "$source"; then
    ok "added $name"
  elif invoke_claude plugin marketplace update "$name"; then
    # Most likely already registered - refreshed it instead.
    ok "updated $name"
  else
    failures+=("marketplace $name")
  fi
done <<< "$marketplace_rows"

# --- 3. Plugins --------------------------------------------------------------
plugin_ids="$(node -e '
  const fs = require("fs");
  const root = process.argv[1];
  const up = JSON.parse(fs.readFileSync(root + "/config/upstream.json", "utf8"));
  const mk = JSON.parse(fs.readFileSync(root + "/.claude-plugin/marketplace.json", "utf8"));
  for (const id of up.plugins ?? []) console.log(id);
  for (const p of mk.plugins ?? []) console.log(p.name + "@" + mk.name);
' "$repo_root")"

step "Installing plugins"
while read -r id; do
  [[ -z "$id" ]] && continue
  if invoke_claude plugin install "$id" --scope user; then
    ok "installed $id"
  else
    failures+=("install $id")
  fi
done <<< "$plugin_ids"

# --- 4. Settings -------------------------------------------------------------
step "Merging shared settings"
merge_args=("$repo_root/scripts/merge-settings.mjs")
[[ $dry_run_settings -eq 1 ]] && merge_args+=(--dry-run)
node "${merge_args[@]}" || failures+=("merge-settings")

# --- 5. Skill dependencies ---------------------------------------------------
step "Installing skill dependencies"
node "$repo_root/scripts/install-deps.mjs" || failures+=("install-deps")

# --- Done --------------------------------------------------------------------
echo
if [[ ${#failures[@]} -gt 0 ]]; then
  printf '\033[33mFinished with %d problem(s):\033[0m\n' "${#failures[@]}"
  printf '\033[33m  - %s\033[0m\n' "${failures[@]}"
  exit 1
fi
printf '\033[32mSync complete. Restart Claude Code to load the changes.\033[0m\n'
