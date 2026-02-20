#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$SKILL_DIR/artifacts/INITIAL_REVIEW_INPUTS"
mkdir -p "$OUT"

# tools
if command -v rg >/dev/null 2>&1; then
  SEARCH="rg"
else
  SEARCH="grep -R"
fi

# Git (optional)
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  {
    echo "## git status"
    git -C "$ROOT" status --porcelain=v1 || true
    echo
    echo "## branch"
    git -C "$ROOT" rev-parse --abbrev-ref HEAD || true
    echo
    echo "## diff --stat (staged)"
    git -C "$ROOT" diff --staged --stat || true
    echo
    echo "## diff --stat (unstaged)"
    git -C "$ROOT" diff --stat || true
  } > "$OUT/status.txt"

  {
    git -C "$ROOT" diff --name-only --staged || true
    git -C "$ROOT" diff --name-only || true
  } | sort -u > "$OUT/changed_files.txt"
else
  echo "git not available or not a git repo" > "$OUT/status.txt"
  echo "" > "$OUT/changed_files.txt"
fi

# Tree (best effort)
if command -v tree >/dev/null 2>&1; then
  tree -L 4 "$ROOT" > "$OUT/tree.txt" || true
else
  # fallback: shallow listing
  (cd "$ROOT" && find . -maxdepth 4 -type d -print | sed 's#^\./##') > "$OUT/tree.txt" || true
fi

# SwiftPM packages inventory
{
  echo "## Package.swift files"
  find "$ROOT" -name Package.swift -maxdepth 6 -print 2>/dev/null || true
  echo
  if command -v swift >/dev/null 2>&1; then
    echo "## swift package describe (best effort)"
    # run describe in each folder containing Package.swift
    while IFS= read -r pkg; do
      dir="$(dirname "$pkg")"
      echo
      echo "### $dir"
      (cd "$dir" && swift package describe 2>/dev/null) || echo "(swift package describe failed)"
    done < <(find "$ROOT" -name Package.swift -maxdepth 6 -print 2>/dev/null || true)
  else
    echo "swift not available"
  fi
} > "$OUT/swift_packages.txt"

# Static scans (heuristics)
SCAN="$OUT/scan_findings.md"
echo "# Scan findings (heuristics)" > "$SCAN"
echo >> "$SCAN"

add_section() {
  local title="$1"
  local pattern="$2"
  echo "## $title" >> "$SCAN"
  echo >> "$SCAN"
  if [ "$SEARCH" = "rg" ]; then
    rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' --glob='!**/DerivedData/**' "$pattern" "$ROOT" >> "$SCAN" 2>/dev/null || true
  else
    grep -RIn --exclude-dir=.build --exclude-dir=.swiftpm --exclude-dir=DerivedData "$pattern" "$ROOT" >> "$SCAN" 2>/dev/null || true
  fi
  echo >> "$SCAN"
}

add_section "Vendor imports (Firebase heuristic)" '^\\s*import\\s+Firebase'
add_section "print(" '\\bprint\\('
add_section "DispatchQueue usage" 'DispatchQueue\\.'
add_section "Force unwrap (!)" '![\\s\\]\\)\\,\\:]'
add_section "try! usage" '\\btry!\\b'
add_section "fatalError usage" '\\bfatalError\\b'
add_section "SwiftUI heavy ops in body (heuristic)" '(var\\s+body\\s*:\\s*some\\s+View|@ViewBuilder).*?(map\\(|filter\\(|reduce\\(|sorted\\(|Dictionary\\(grouping:)'

echo "Wrote inputs to: $OUT"
