#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$SKILL_DIR/artifacts/INITIALIZATION_REVIEW_INPUTS"
mkdir -p "$OUT"

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
  (cd "$ROOT" && find . -maxdepth 4 -type d -print | sed 's#^\./##') > "$OUT/tree.txt" || true
fi

# Pattern scans (rg preferred)
if command -v rg >/dev/null 2>&1; then
  RG="rg"
else
  RG=""
fi

if [ -z "$RG" ]; then
  echo "rg not available; skipping pattern scans" > "$OUT/entrypoints.md"
  echo "rg not available; skipping pattern scans" > "$OUT/lifecycle_hits.md"
  echo "rg not available; skipping pattern scans" > "$OUT/startup_hotspots.md"
  echo "rg not available; skipping pattern scans" > "$OUT/vendor_imports.md"
  echo "Wrote inputs to: $OUT"
  exit 0
fi

# Entrypoints
{
  echo "# Entrypoints"
  echo
  echo "## @main / App"
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' --glob='!**/DerivedData/**' \
    '@main\\s*(final\\s+)?(class|struct)\\s+|struct\\s+\\w+\\s*:\\s*App\\b' "$ROOT" || true
  echo
  echo "## UIApplicationDelegate / SceneDelegate (se existir)"
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    'UIApplicationDelegate|SceneDelegate|application\\(|scene\\(' "$ROOT" || true
} > "$OUT/entrypoints.md"

# Lifecycle hits
{
  echo "# SwiftUI lifecycle hits"
  echo
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    '\\.onAppear\\b|\\.onDisappear\\b|\\.task\\b|scenePhase|NotificationCenter\\.default\\.publisher|\\.onChange\\b' "$ROOT" || true
} > "$OUT/lifecycle_hits.md"

# Startup hotspots
{
  echo "# Startup hotspots (heuristics)"
  echo
  echo "## Network / Sync / Auth triggers"
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    'URLSession|fetch\\b|download\\b|sync\\b|Firebase|Auth\\b|signIn\\b|refresh\\b' "$ROOT" || true
  echo
  echo "## Disk / decoding / heavy work"
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    'FileManager|UserDefaults|Keychain|JSONDecoder|PropertyListDecoder|Codable|Data\\(|try!|fatalError' "$ROOT" || true
  echo
  echo "## SwiftUI heavy ops in body (heuristic)"
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    '(var\\s+body\\s*:\\s*some\\s+View|@ViewBuilder).*?(map\\(|filter\\(|reduce\\(|sorted\\(|Dictionary\\(grouping:)' "$ROOT" || true
} > "$OUT/startup_hotspots.md"

# Vendor imports
{
  echo "# Vendor imports (heuristic)"
  echo
  rg -n --hidden --glob='!**/.swiftpm/**' --glob='!**/.build/**' \
    '^\\s*import\\s+Firebase' "$ROOT" || true
} > "$OUT/vendor_imports.md"

echo "Wrote inputs to: $OUT"
