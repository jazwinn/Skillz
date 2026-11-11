---
name: showcase-readme
description: Generate a portfolio-grade README that makes hiring managers and recruiters stop scrolling - hero with badges, a real recorded GIF demo of the program running, Mermaid architecture diagrams, measured performance numbers, engineering highlights and a roadmap. Use when the user asks to make, redesign or polish a README for a project they want to show employers, recruiters or a portfolio, or asks for a demo GIF or architecture diagram for their repo.
---

# Showcase README

Produce a README that works for two readers at once:

- **The recruiter (30 seconds).** Reads only the top: name, one-line pitch, badges, the GIF, three highlight numbers. Must leave knowing what it is and that it is impressive.
- **The engineer (5 minutes).** Scrolls on for architecture, decisions, tests and how to run it. Must leave convinced the author has judgment.

Everything above the first `##` heading is for the recruiter. Everything below is for the engineer.

## Non-negotiable rules

1. **No invented facts.** Every number, test count, model name, speedup and feature must come from the repo, a command you ran, or the user. If a number would be great but does not exist, measure it or leave it out and tell the user how to get it. Never reuse numbers from abandoned branches or old conversations without re-checking them against the current code.
2. **The demo is real.** Record the actual program. Never fake typed output. You may shorten dead time (model loading, a long prefill) and must say so in the caption. Streaming itself keeps its real pace; if the real pace is too slow to watch, speed up the whole GIF with `--speed N`, which stamps an "N× speed" badge on every frame. If the user doesn't want the badge, pass `--no-badge`, and the caption must then say "Sped up N×". A sped-up GIF is never published without one of the two.
3. **Keep the substance the user already wrote.** If a README exists, read all of it first. Its facts, caveats and roadmap carry over; you are restructuring and presenting, not discarding. Long reference material moves into `<details>` blocks, not into the bin.
4. **Honest about limits.** A short "Known limitations" or current bottleneck line reads as maturity, not weakness.
5. No emoji walls, no "🚀 Blazingly fast" filler, no badge for things that are not true (no CI badge without CI).

## Workflow

### 1. Analyse the repo

Read, at minimum: the existing README, the build files (CMakeLists/package.json/pyproject/Cargo.toml), the entry point, the top-level directory layout, `git log --oneline` (milestones), and any benchmark or results folder. Find:

- What it is in one sentence, and what makes it hard (from scratch? no dependencies? GPU? real models?).
- The headline capability that can be shown running.
- Measured numbers: test counts (list them from the test binaries, e.g. `--gtest_list_tests`, `pytest --collect-only -q`), accuracy/parity results, speedups, latencies.
- Hardware and toolchain the numbers come from.

If the project root the user points at holds only build output, search for the real source before going further.

### 2. Confirm the pitch with the user (briefly)

Only ask what you cannot find: target role (e.g. ML systems, GPU, backend), and anything they want featured. If the user already said "just generate it", skip and proceed with your best reading.

### 3. Record the demo GIF

Use the bundled scripts (Python 3 + Pillow; no other installs):

```
python scripts/record_cast.py --cwd <repo> --out docs/assets/demo.cast \
    --wait "> " --reply-marker "●" --send "Write a haiku about GPUs." --send "/exit" \
    --max-idle 5 -- <program> [args]
python scripts/cast_to_gif.py docs/assets/demo.cast docs/assets/demo.gif \
    --title "<window title>" --cols 76 --rows 22 [--speed 4]
```

- `record_cast.py` runs the program through pipes, waits for the `--wait` marker before each `--send`, types the input with human-like key timing, and writes an asciinema v2 cast with real timestamps. Gaps longer than `--max-idle` are compressed and listed in the cast header. Keep `--max-idle` above the per-token interval so streaming is never retimed. With `--reply-marker`, it prints `ttft_s`, `stream_s`, `chunks` and `ms_per_chunk` for each reply, measured on the real clock, for the README's numbers.
- `cast_to_gif.py` renders the cast in a terminal window frame (title bar, dark theme, Cascadia Mono/Consolas) handling `\r`, `\n`, clear-line and SGR colours including 256-colour codes. `--speed` adds the speed badge.
- **Git Bash on Windows:** prefix the recorder with `MSYS_NO_PATHCONV=1`, or arguments like `/exit` are rewritten into `C:/Program Files/Git/exit`. With it set, pass the script itself as a Windows path (`C:/Users/...`), not `~/...`.
- **Read the model's reply before using the take.** A small model can answer confidently and wrongly; a wrong answer about the project's own subject is worse than no demo. Prefer prompts with no factual answer (a haiku, a rewrite) and re-record if the output is wrong or rambles.
- Pick one prompt whose reply is short. Keep the GIF under ~5 MB; reduce `--rows`, `--fps` or the reply length if it is larger.
- If the program cannot run (missing weights, no GPU), tell the user and leave a placeholder with the exact command to record it later.

### 4. Draw the architecture

Use Mermaid inside the README (GitHub renders it, it diffs, it follows light/dark). Draw what the code actually does, using real class and file names:

- **Layer diagram** (`flowchart TB`): user-facing entry → core model/pipeline → primitives → backends/hardware. Group with `subgraph`. 12-20 nodes; more becomes unreadable.
- **Flow diagram** (`sequenceDiagram` or `flowchart LR`) of one request end to end, e.g. prompt → template → tokenize → prefill → decode loop → detokenize.

Avoid custom colours that break in one theme; if you style, use `classDef` with mid-tone fills and explicit text colour.

### 5. Write the README

Follow `references/template.md` section by section. Drop sections that would be empty rather than padding them.

### 6. Review

Go through `references/checklist.md`. Then preview the rendered Markdown (e.g. open the GitHub preview, or render locally) and fix anything that breaks.

Report to the user: what was measured and how, what was left out for lack of evidence, and the exact commands to re-record the GIF when the project improves.
