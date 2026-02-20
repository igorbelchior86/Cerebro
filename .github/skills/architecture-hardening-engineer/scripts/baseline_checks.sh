#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
mkdir -p "$ARTIFACTS_DIR"
OUT="$ARTIFACTS_DIR/HARDENING_BASELINE.md"

if command -v rg >/dev/null 2>&1; then
  RG="rg"
else
  echo "ERROR: ripgrep (rg) not installed." >&2
  exit 2
fi

TARGETS="$ROOT/GastosSwiftUI $ROOT/GastosWidget $ROOT/Packages"

{
  echo "# HARDENING BASELINE"
  echo
  echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "## Vendor imports (Firebase heuristic)"
  $RG -n -F 'import Firebase' --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' --glob='!**/DerivedData/**' \
    $TARGETS || true
  echo
  echo "## print("
  $RG -n -F 'print(' --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    $TARGETS || true
  echo
  echo "## DispatchQueue usage"
  $RG -n -F 'DispatchQueue.' --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    $TARGETS || true
  echo
  echo "## Heavy ops in SwiftUI body (heuristic)"
  echo "(skipped – heuristic regex disabled for stability)"
} > "$OUT"

echo "Wrote: $OUT"
