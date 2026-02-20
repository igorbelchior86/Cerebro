#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
mkdir -p "$ARTIFACTS_DIR"

OUT="$ARTIFACTS_DIR/HARDENING_REPORT_PATH.txt"
# Look for auditor output in sibling skill
REPORT="$SKILL_DIR/../gastos-architecture-hardening/artifacts/ARCHITECTURE_HARDENING.md"

if [ -f "$REPORT" ]; then
  echo "$REPORT" > "$OUT"
  echo "Found: $REPORT"
  exit 0
fi

echo "NOT_FOUND" > "$OUT"
echo "Missing required auditor output: $REPORT"
exit 1
