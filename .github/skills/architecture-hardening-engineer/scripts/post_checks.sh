#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
mkdir -p "$ARTIFACTS_DIR"
OUT="$ARTIFACTS_DIR/HARDENING_POST.md"

# reuse baseline checks output format
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/baseline_checks.sh" "$ROOT" >/dev/null 2>&1 || true

# copy baseline format for "post"
if [ -f "$ARTIFACTS_DIR/HARDENING_BASELINE.md" ]; then
  cp "$ARTIFACTS_DIR/HARDENING_BASELINE.md" "$OUT"
  sed -i.bak 's/HARDENING BASELINE/HARDENING POST/' "$OUT" 2>/dev/null || true
  rm -f "$OUT.bak" "$OUT.bak.bak" 2>/dev/null || true
  echo "Wrote: $OUT"
else
  echo "# HARDENING POST\n\n(baseline file missing)" > "$OUT"
  echo "Wrote: $OUT"
fi
