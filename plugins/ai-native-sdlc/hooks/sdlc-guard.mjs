#!/usr/bin/env node
// PreToolUse guard for the AI-native SDLC gates.
//
// Three deterministic checks, all driven by <repo>/.claude/sdlc.json:
//   1. protectedPaths  - refuse edits to generated or frozen paths
//   2. testPaths       - refuse edits to tests while a bug fix is in progress
//   3. deployGate      - refuse a production deploy without a named authorization
//
// With no .claude/sdlc.json the guard is inert: it allows everything, silently.
// That keeps the plugin safe to enable globally and opt-in per repository.
//
// Reads the hook payload on stdin, writes a PreToolUse deny decision on stdout.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, isAbsolute, sep } from 'node:path'

const ALLOW = 0 // exit code; a deny is expressed in the JSON payload, not the code

function allow() {
  process.exit(ALLOW)
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
    systemMessage: reason,
  }))
  process.exit(ALLOW)
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

let payload
try {
  const raw = readFileSync(0, 'utf8')
  payload = raw.trim() ? JSON.parse(raw) : {}
} catch {
  allow() // never break a session over a malformed payload
}

const toolName = payload.tool_name ?? ''
const toolInput = payload.tool_input ?? {}
const cwd = payload.cwd ?? process.cwd()

// ---------------------------------------------------------------------------
// Config: nearest .claude/sdlc.json at or above cwd
// ---------------------------------------------------------------------------

function findConfig(startDir) {
  let dir = resolve(startDir)
  for (;;) {
    const candidate = join(dir, '.claude', 'sdlc.json')
    if (existsSync(candidate)) return { path: candidate, root: dir }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const found = findConfig(cwd)
if (!found) allow()

let config
try {
  config = JSON.parse(readFileSync(found.path, 'utf8'))
} catch (err) {
  // A broken config must not silently disable the gates it was meant to enforce.
  deny(`.claude/sdlc.json is not valid JSON (${err.message}). Fix it before continuing — the SDLC gates are not being enforced while it is unreadable.`)
}

const repoRoot = found.root

// ---------------------------------------------------------------------------
// Glob matching (supports **, * and ?; paths normalised to forward slashes)
// ---------------------------------------------------------------------------

function globToRegExp(glob) {
  let out = '^'
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++ // consume the second star
        if (glob[i + 1] === '/') {
          // "**/" - zero or more leading directories, so "**/x" also matches "x"
          i++
          out += '(?:.*/)?'
        } else {
          // trailing or bare "**" - matches the rest, separators included
          out += '.*'
        }
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      out += '\\' + ch
    } else {
      out += ch
    }
  }
  return new RegExp(out + '$')
}

const toPosix = (p) => p.split(sep).join('/')

function matchesAny(relPath, globs) {
  if (!Array.isArray(globs)) return false
  const target = toPosix(relPath)
  return globs.some((g) => {
    const pattern = toPosix(String(g))
    // A bare directory prefix like "v1/" matches everything beneath it.
    if (pattern.endsWith('/')) return target.startsWith(pattern)
    return globToRegExp(pattern).test(target)
  })
}

// ---------------------------------------------------------------------------
// File edits: protected paths, and the test lock
// ---------------------------------------------------------------------------

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

if (EDIT_TOOLS.has(toolName)) {
  const target = toolInput.file_path ?? toolInput.notebook_path ?? ''
  if (!target) allow()

  const abs = isAbsolute(target) ? target : resolve(cwd, target)
  const rel = relative(repoRoot, abs)
  // Outside the repo entirely - not this guard's business.
  if (rel.startsWith('..')) allow()

  if (matchesAny(rel, config.protectedPaths)) {
    deny(
      `${toPosix(rel)} is a protected path in this repository (.claude/sdlc.json -> protectedPaths). ` +
      `Generated and frozen files are not edited directly — change the source that produces them, ` +
      `or take the change to the package that is still open.`
    )
  }

  const lockFile = config.fixLockFile ?? '.claude/sdlc-fix.lock'
  const lockActive = existsSync(resolve(repoRoot, lockFile))
  if (lockActive && matchesAny(rel, config.testPaths)) {
    deny(
      `${toPosix(rel)} is a test file and a bug fix is in progress (${toPosix(lockFile)} exists). ` +
      `The failing test is frozen while the source is fixed — a test edited during the fix proves nothing. ` +
      `Fix the source instead. If the test itself asserts the wrong behaviour, stop and say so, ` +
      `then remove the lock deliberately rather than editing around it.`
    )
  }

  allow()
}

// ---------------------------------------------------------------------------
// Bash: the production deploy gate
// ---------------------------------------------------------------------------

if (toolName === 'Bash') {
  const gate = config.deployGate
  if (!gate || !Array.isArray(gate.match) || gate.match.length === 0) allow()

  const command = String(toolInput.command ?? '')
  if (!command) allow()

  // Gate patterns are matched against the whole command line, so "*" here spans
  // anything including separators - deliberately broader than path globs.
  const hit = gate.match.find((raw) => {
    const pattern = String(raw)
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\S]*')
    return new RegExp(source).test(command)
  })
  if (!hit) allow()

  const envVar = gate.approvalEnv ?? 'RELEASE_APPROVAL'
  const approval = process.env[envVar]
  if (approval && approval.trim()) allow()

  deny(
    `Production deploys need a release authorization. ` +
    `This command matched the production deploy gate (${hit}) and ${envVar} is not set. ` +
    `A named release manager sets ${envVar} to authorize the release; the agent prepares it and stops here.`
  )
}

allow()
