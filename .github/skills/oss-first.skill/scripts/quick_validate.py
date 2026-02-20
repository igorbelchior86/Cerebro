#!/usr/bin/env python3
"""
quick_validate.py

Lightweight validator for an OSS-First skill package layout.

Usage:
  python3 quick_validate.py /path/to/skill-folder
"""

import sys
from pathlib import Path

REQUIRED = [
    "SKILL.md",
    "LICENSE.txt",
    "references/repo-triage-checklist.md",
    "references/github-search-cheatsheet.md",
    "references/security-licensing.md",
    "references/output-templates.md",
    "scripts/github_search.py",
    "scripts/repo_score.py",
]

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: quick_validate.py <skill-folder>")
        return 2

    root = Path(sys.argv[1])
    missing = [p for p in REQUIRED if not (root / p).exists()]
    if missing:
        print("Missing files:")
        for m in missing:
            print(f" - {m}")
        return 1

    print("OK: skill structure looks good.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
