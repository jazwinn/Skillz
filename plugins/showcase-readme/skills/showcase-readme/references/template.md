# README template

Sections in order. `[R]` = recruiter zone (above the fold), `[E]` = engineer zone.

## [R] Hero

```markdown
<div align="center">

# Project Name

**One sentence: what it is + the hard part.** (e.g. "A transformer inference engine written from scratch in C++20 and CUDA - no PyTorch, no ggml, no ML libraries.")

![badge](...) ![badge](...) ![badge](...)

<img src="docs/assets/demo.gif" alt="..." width="760">

<sub>Caption: what is running, on what hardware, what was sped up in the recording (if anything).</sub>

</div>
```

Badges: shields.io static badges only for true facts - language/standard, key platform (CUDA version), test count, license if one exists. Use `style=flat-square` consistently. 3-6 badges.

## [R] At a glance

3-5 bullets or a small table of the most impressive *verified* facts. Lead with outcomes and numbers:

- Runs <real model> end to end on <hardware>
- <N> tests, including GPU-vs-CPU parity for every kernel
- Matches the reference implementation to within <tolerance>
- Written from scratch: <the list of things not used>

## [E] Highlights / What makes it interesting

3-6 short entries. Each one: the problem, what was built, the evidence. One or two sentences each. These are what a hiring manager quotes in an interview. Prefer depth (a design insight) over breadth (a feature list).

## [E] Architecture

Short paragraph, then the Mermaid layer diagram, then the request-flow diagram. Follow with a directory table (directory -> contents), real names only.

## [E] Performance

Hardware line first. Table of measured numbers with how they were measured. Current bottleneck stated plainly, with the planned fix. A chart only if there are 3+ comparable numbers.

## [E] Correctness / Testing

How correctness is established: test counts per area, reference parity, what the tests compare against. The command to run them.

## [E] Getting started

Requirements, build commands in a code block, how to get any model/data files, how to run. Keep the exact commands from the existing README.

## [E] Roadmap

Checkbox list grouped by area. If long, keep the top area open and put the rest in `<details>`.

## [E] Feature reference (optional)

The detailed "Implemented" material from an existing README, in `<details>` blocks per area.

## Footer

License (only if one exists), acknowledgements for vendored/borrowed code, and a contact/author line if the user wants it.
