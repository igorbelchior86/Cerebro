#!/usr/bin/env python3
"""
repo_score.py

Tiny offline heuristic scorer for a repo metadata JSON blob (from GitHub API).
It is intentionally simple: it helps rank candidates when you already have
metadata, but it does NOT replace human review.

Usage:
  python3 repo_score.py repo.json
"""

import json
import sys
from datetime import datetime, timezone

def days_since(iso: str) -> int:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).days

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: repo_score.py <repo.json>", file=sys.stderr)
        return 2

    repo = json.load(open(sys.argv[1], "r", encoding="utf-8"))

    score = 0
    stars = int(repo.get("stargazers_count", 0))
    forks = int(repo.get("forks_count", 0))
    open_issues = int(repo.get("open_issues_count", 0))
    pushed_at = repo.get("pushed_at") or repo.get("updated_at")

    score += min(stars / 500, 10)   # up to 10
    score += min(forks / 200, 5)    # up to 5
    score -= min(open_issues / 200, 3)  # down to -3

    if pushed_at:
        d = days_since(pushed_at)
        if d < 90:
            score += 5
        elif d < 365:
            score += 3
        elif d < 730:
            score += 1
        else:
            score -= 2

    license_info = repo.get("license", {}) or {}
    if license_info.get("key"):
        score += 2
    else:
        score -= 3

    archived = bool(repo.get("archived", False))
    if archived:
        score -= 5

    print(f"score: {score:.2f}")
    print(f"stars: {stars} forks: {forks} open_issues: {open_issues}")
    if pushed_at:
        print(f"last_push_days: {days_since(pushed_at)}")
    print(f"archived: {archived}")
    print(f"license: {license_info.get('spdx_id') or 'unknown'}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
