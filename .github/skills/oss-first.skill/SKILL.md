---
name: oss-first
description: When a problem is likely already solved in open source, this skill forces a GitHub-first approach: search, triage, and recommend battle-tested repos, CLIs, and libraries instead of writing custom code.
license: Complete terms in LICENSE.txt
---

# OSS-First (GitHub Scout)

## When to Use

Use this skill when the user’s problem is universal enough that open source developers have probably solved it already, especially for:

- Format conversion (video, audio, image, document)
- Media downloading (site downloads, playlists, batch pulls)
- File manipulation (rename, dedupe, organize, bulk metadata edits)
- Web scraping and archiving (crawl, snapshot, extract)
- Automation scripts and CLI tools (batch jobs, scheduled tasks, glue scripts)

Do **not** use this skill when:
- The task is highly company-specific or depends on private internal systems
- The user explicitly wants a bespoke algorithm or custom implementation
- Licensing constraints make OSS unsuitable

## Goal

Find 2 to 5 strong GitHub options that are likely to work in production, explain tradeoffs, and provide actionable “how to run it” steps.

## Workflow

### 1) Define the Problem Precisely (60 seconds)

Extract:
- Inputs (formats, sources, constraints, OS)
- Outputs (desired format, structure, destination)
- Non-negotiables (speed, GUI vs CLI, offline vs online, cost, license)
- Risk factors (credentials, scraping ToS, DRM, PII)

Write a one-line problem statement:
- “Convert X to Y while preserving Z on OS A, batch size N.”

### 2) Search GitHub Like a Pro

Use these query patterns (start broad, then narrow):

- Repo search:
  - `<keyword> <format>`  `stars:>500`  `pushed:>2023-01-01`
  - `topic:<topic>`  `language:<lang>`
  - `in:readme <keyword>`  `in:description <keyword>`

- Examples:
  - `pdf to docx cli stars:>500 pushed:>2023-01-01`
  - `yt-dlp download playlist stars:>1000 pushed:>2023-01-01`
  - `web archive crawler stars:>300 pushed:>2022-01-01`

Also search:
- GitHub Releases pages (for stable binaries)
- Awesome lists (curated indexes) as a shortcut

### 3) Triage and Score Candidates

For each candidate, check:

**Activity and health**
- Recent commits and releases
- Open issues trend, maintainer responsiveness
- CI status, tests, linting

**Adoption**
- Stars and forks are signals, not guarantees
- Downstream usage (package managers, docker pulls, integrations)

**Docs and UX**
- Clear installation steps
- Examples for the exact use-case
- Error handling guidance

**Safety and legality**
- License fit (MIT, Apache-2.0, GPL)
- Security posture (Dependabot, security policy)
- Avoid tools that facilitate DRM bypass or clearly illegal use

Use the checklist in `references/repo-triage-checklist.md`.

### 4) Pick the Shortlist (2 to 5)

Prefer:
- Mature CLIs with stable releases and good docs
- Widely adopted libraries with maintained APIs
- Tools that work on the user’s OS without heroic setup

Balance the shortlist:
- One “safe default”
- One “power user” option
- One “lightweight” option, if relevant

### 5) Deliver a Recommendation the User Can Execute

Output structure:
1. Short summary: best pick and why
2. Alternatives: when to choose them
3. Install instructions (copy/paste)
4. Minimal working example commands
5. Pitfalls and gotchas
6. License note

Use the templates in `references/output-templates.md`.

## Quality Bar

A repo qualifies as “battle-tested” only if it meets most of:
- Active in the last 12 to 24 months
- Documented install and usage
- Has releases or packaging path
- Clear license
- Evidence of users running it at scale

## Built-In Decision Rules

- If the user needs a **one-off task**, prefer a CLI.
- If the user needs a **repeatable workflow**, prefer a library plus a small wrapper.
- If the task touches **private data**, prefer local/offline tools over cloud.
- If there’s a strong incumbent (e.g., ffmpeg, ImageMagick, yt-dlp), start there.

## What to Provide Back to the User

Always include:
- A direct GitHub link (or release link)
- The simplest viable command line example
- Any required dependencies
- A “how to uninstall or rollback” note if the tool changes system state

