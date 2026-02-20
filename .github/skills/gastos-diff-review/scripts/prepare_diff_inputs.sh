#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$SKILL_DIR/artifacts"
mkdir -p "$OUT"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not found. Cannot auto-prepare diff inputs." >&2
  exit 2
fi

# Collect staged + unstaged diffs
PATCH="$OUT/DIFF.patch"
STAT="$OUT/DIFF.stat"
FILES="$OUT/CHANGED_FILES.txt"

# If not in a git repo, fail clearly
if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not a git repository at $ROOT" >&2
  exit 2
fi

# patch: include staged and unstaged
{
  echo "# === STAGED DIFF ==="
  git -C "$ROOT" diff --staged
  echo
  echo "# === UNSTAGED DIFF ==="
  git -C "$ROOT" diff
} > "$PATCH"

# stats
{
  echo "## git status"
  git -C "$ROOT" status --porcelain=v1
  echo
  echo "## diff --stat (staged)"
  git -C "$ROOT" diff --staged --stat
  echo
  echo "## diff --stat (unstaged)"
  git -C "$ROOT" diff --stat
  echo
  echo "## numstat (staged)"
  git -C "$ROOT" diff --staged --numstat
  echo
  echo "## numstat (unstaged)"
  git -C "$ROOT" diff --numstat
} > "$STAT"

# changed files list (union)
{
  git -C "$ROOT" diff --name-only --staged
  git -C "$ROOT" diff --name-only
} | sort -u > "$FILES"

echo "Wrote:"
echo " - $PATCH"
echo " - $STAT"
echo " - $FILES"
