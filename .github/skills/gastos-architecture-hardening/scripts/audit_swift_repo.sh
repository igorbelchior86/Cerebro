#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

echo "== Architecture hardening audit =="
echo "Root: $ROOT"
echo

# Helper: run ripgrep if present
if command -v rg >/dev/null 2>&1; then
  RG="rg"
else
  echo "ERROR: ripgrep (rg) not installed. Install it, or replace rg calls with grep -R."
  exit 2
fi

echo "## 1) Vendor SDK imports (heuristic: Firebase)"
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' --glob='!**/DerivedData/**' \
  '^\s*import\s+Firebase' "$ROOT" || true
echo

echo "## 2) UI importing vendor SDKs (heuristic: SwiftUI dirs + Firebase imports nearby)"
# Adjust glob if your UI folder names differ
$RG -n --hidden --glob='**/*.swift' --glob='!**/.swiftpm/**' \
  -S 'import\s+Firebase' "$ROOT" | $RG -n -S '(GastosSwiftUI|Views|UI|Screens)' || true
echo

echo "## 3) Prints (should be DEBUG-only)"
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  '\bprint\(' "$ROOT" || true
echo

echo "## 4) DispatchQueue usage (flag for review)"
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  'DispatchQueue\.' "$ROOT" || true
echo

echo "## 5) Heavy work in SwiftUI body (heuristic)"
# This is intentionally fuzzy; it surfaces candidates for human review.
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  '(var\s+body\s*:\s*some\s+View|@ViewBuilder).*?(map\(|filter\(|reduce\(|sorted\(|grouping:|Dictionary\(grouping:)' "$ROOT" || true
echo

echo "## Done."
echo "Interpretation:"
echo "- Hits are not automatically 'bad'; they are review candidates."
echo "- Use the Architecture Hardening skill to decide what to fix and where."
