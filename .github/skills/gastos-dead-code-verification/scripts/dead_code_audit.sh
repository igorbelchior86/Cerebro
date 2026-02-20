#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$SKILL_DIR/artifacts"
mkdir -p "$OUT_DIR"

CSV="$OUT_DIR/DEAD_CODE_CANDIDATES.csv"
MD="$OUT_DIR/DEAD_CODE_CANDIDATES.md"

if command -v rg >/dev/null 2>&1; then
  RG="rg"
else
  echo "ERROR: ripgrep (rg) not installed. Install rg to auto-generate candidates." >&2
  exit 2
fi

echo "kind,path,symbol,notes" > "$CSV"

# Heuristics: "likely unused" symbols are hard; we surface review candidates instead.
# 1) Files with only previews or sample data
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' --glob='!**/DerivedData/**' \
  '#Preview|PreviewProvider|sampleData|mock' "$ROOT" \
  | awk -F: '{print "preview," $1 ",," $2}' >> "$CSV" || true

# 2) Prints (debug candidates)
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  '\bprint\(' "$ROOT" \
  | awk -F: '{print "debug_print," $1 ",," $2}' >> "$CSV" || true

# 3) DispatchQueue usage (concurrency audit candidates)
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  'DispatchQueue\.' "$ROOT" \
  | awk -F: '{print "dispatchqueue," $1 ",," $2}' >> "$CSV" || true

# 4) SwiftUI body heavy operations heuristic
$RG -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
  '(var\s+body\s*:\s*some\s+View|@ViewBuilder).*?(map\(|filter\(|reduce\(|sorted\(|Dictionary\(grouping:)' "$ROOT" \
  | awk -F: '{print "render_heavy," $1 ",," $2}' >> "$CSV" || true

# Render markdown summary
{
  echo "# Dead Code Candidates (auto-generated)"
  echo
  echo "- Root: \`$ROOT\`"
  echo "- Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "This list is **candidates only**. Use the dead-code-verification skill to classify with evidence."
  echo
  echo "## Top signals (counts)"
  echo
  echo "\`\`\`"
  echo "preview: $($RG -c 'PreviewProvider|#Preview' "$ROOT" 2>/dev/null || true)"
  echo "print: $($RG -c '\\bprint\\(' "$ROOT" 2>/dev/null || true)"
  echo "dispatchqueue: $($RG -c 'DispatchQueue\\.' "$ROOT" 2>/dev/null || true)"
  echo "\`\`\`"
  echo
  echo "## Candidates (CSV excerpt)"
  echo
  echo "\`\`\`"
  head -n 40 "$CSV" || true
  echo "\`\`\`"
} > "$MD"

echo "Wrote:"
echo " - $MD"
echo " - $CSV"
