# Repo Triage Checklist (OSS-First)

Use this checklist to decide if a GitHub repo is worth recommending.

## Must-Haves

- License file present (MIT/Apache-2.0/BSD/GPL etc.)
- Clear README with install + usage examples
- Recent activity (commit/release within ~24 months, unless the project is “done” and stable)
- Works on the user’s OS (Windows/macOS/Linux) or has explicit support notes

## Strong Signals

- Releases with versioning (tags) and changelog
- CI configured (GitHub Actions, etc.) with passing status
- Tests or fixtures
- Active issue triage and maintainer replies
- Package distribution (pip, npm, crates, brew, apt, docker, etc.)

## Red Flags

- No license or unclear license
- “Works on my machine” instructions only
- Numerous unresolved issues about core functionality
- Obvious supply chain risk: random binary downloads, no checksums, no releases
- Repo is a thin wrapper around a standard tool without added value

## Fit Questions

- Is this a CLI or library, and what did the user actually need?
- Does it support the exact input/output formats?
- Does it preserve metadata or quality settings (important for media)?
- Does it scale to the user’s batch size without timeouts?

## Output Notes

When you recommend a repo, include:
- Why it fits
- The smallest working example command
- A backup plan if it fails
- License type and any implications (GPL vs permissive)
