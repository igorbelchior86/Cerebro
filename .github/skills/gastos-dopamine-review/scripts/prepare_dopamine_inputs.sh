#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-}"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "Usage: prepare_dopamine_inputs.sh <repo-root>" >&2
  exit 1
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )/.." && pwd)"
OUT_DIR="$SKILL_DIR/artifacts/DOPAMINE_INPUTS"
mkdir -p "$OUT_DIR"

SURFACES_FILE="$OUT_DIR/surfaces.md"
TOUCHPOINTS_FILE="$OUT_DIR/touchpoints.md"
SEARCH_HITS_FILE="$OUT_DIR/search_hits.md"

# 1) Surfaces snapshot
{
  echo "# Surfaces (auto)"
  echo
  for p in "GastosSwiftUI" "Packages" "GastosWidget" "Widget"; do
    if [[ -e "$REPO_ROOT/$p" ]]; then
      echo "- Found: $p"
    fi
  done
  echo
  echo "## Likely entrypoints"
  find "$REPO_ROOT" -maxdepth 4 -type f \( -name '*App.swift' -o -name '*Scene.swift' -o -name '*Widget*.swift' \) 2>/dev/null | sed 's#^#- #' || true
} > "$SURFACES_FILE"

# 2) Touchpoints via keyword scan
{
  echo "# Touchpoints (keyword scan)"
  echo
  echo "## Notifications"
  grep -RIn --exclude-dir=.git --include='*.swift' -E 'UNUserNotificationCenter|NotificationRequest|BGTask|BGAppRefreshTask|UserNotifications' "$REPO_ROOT" | head -n 200 || true
  echo
  echo "## Widgets / App Group"
  grep -RIn --exclude-dir=.git --include='*.swift' -E 'WidgetKit|AppGroup|suiteName|group\.' "$REPO_ROOT" | head -n 200 || true
  echo
  echo "## Haptics / celebration"
  grep -RIn --exclude-dir=.git --include='*.swift' -E 'UIImpactFeedbackGenerator|UINotificationFeedbackGenerator|haptic|Haptic' "$REPO_ROOT" | head -n 200 || true
  echo
  echo "## Streak / closure"
  grep -RIn --exclude-dir=.git --include='*.swift' -E 'streak|Streak|day closed|Dia fechado|closure' "$REPO_ROOT" | head -n 200 || true
} > "$TOUCHPOINTS_FILE"

# 3) Broader search hits for product surfaces
{
  echo "# Search hits (selected)"
  echo
  for term in "gauge" "Panorama" "Budget" "Commitment" "planned" "schedule" "receipt" "OCR" "Widget" "snapshot"; do
    echo "## term: $term"
    grep -RIn --exclude-dir=.git --include='*.swift' -E "$term" "$REPO_ROOT" | head -n 50 || true
    echo
  done
} > "$SEARCH_HITS_FILE"

echo "Wrote: $SURFACES_FILE"
echo "Wrote: $TOUCHPOINTS_FILE"
echo "Wrote: $SEARCH_HITS_FILE"
