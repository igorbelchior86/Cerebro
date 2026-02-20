#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="artifacts/UI_ENGINEER_INPUTS"
mkdir -p "$OUT_DIR"

# Git quick status (read-only)
if command -v git >/dev/null 2>&1; then
  git status --porcelain=v1 > "$OUT_DIR/status.txt" || true
  git diff --name-only > "$OUT_DIR/changed_files.txt" || true
else
  echo "git not available" > "$OUT_DIR/status.txt"
fi

# Tree (best effort)
if command -v tree >/dev/null 2>&1; then
  tree -L 4 > "$OUT_DIR/tree.txt" || true
else
  find . -maxdepth 4 -print > "$OUT_DIR/tree.txt" || true
fi

# Placeholder: the agent should additionally run ripgrep/grep using suggested_code_search_hints from AUDIT_FINDINGS.json
echo "Use code search hints from artifacts/AUDIT_FINDINGS.json to locate targets (rg/grep). Save outputs next to this file." > "$OUT_DIR/code_search_instructions.txt"

echo "Prepared UI Engineer inputs in $OUT_DIR"
