#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
mkdir -p "$ARTIFACTS_DIR"

PATH_FILE="$ARTIFACTS_DIR/HARDENING_REPORT_PATH.txt"
OUT="$ARTIFACTS_DIR/HARDENING_PLAN_EXTRACT.md"

if [ ! -f "$PATH_FILE" ]; then
  echo "ERROR: $PATH_FILE not found. Run find_hardening_report.sh first." >&2
  exit 2
fi

REPORT="$(cat "$PATH_FILE")"
if [ "$REPORT" = "NOT_FOUND" ] || [ ! -f "$REPORT" ]; then
  echo "ERROR: auditor report not found. Expected a file path in $PATH_FILE." >&2
  exit 2
fi

# Extract the "Plan" section heuristically.
# Works for common headings: "Plan", "Hardening plan", "Plano", "Plan (ordered)"
REPORT_PATH="$REPORT" OUT_PATH="$OUT" python3 - << 'PY'
import os, re, pathlib, sys

report_path = pathlib.Path(os.environ["REPORT_PATH"])
out_path = pathlib.Path(os.environ["OUT_PATH"])
text = report_path.read_text(encoding="utf-8", errors="ignore")

# headings candidates
patterns = [
    r"^##\s+Plan\b.*?$",
    r"^##\s+Hardening\s+plan\b.*?$",
    r"^##\s+Plano\b.*?$",
    r"^##\s+Plan\s*\(ordered\).*?$",
]
lines = text.splitlines()
start = None
for i, line in enumerate(lines):
    for p in patterns:
        if re.match(p, line.strip(), flags=re.IGNORECASE):
            start = i
            break
    if start is not None:
        break

if start is None:
    # fallback: look for "Step 1" sequence
    for i, line in enumerate(lines):
        if re.match(r"^\s*\d+\)\s+|^\s*Step\s+\d+\b", line, flags=re.IGNORECASE):
            start = i
            break

if start is None:
    out_path.write_text("# HARDENING PLAN EXTRACT\n\n(Plan section not found; please ensure the auditor report includes a Plan section.)\n", encoding="utf-8")
    sys.exit(0)

# end at next top-level "## " heading after start
end = len(lines)
for j in range(start+1, len(lines)):
    if lines[j].startswith("## "):
        end = j
        break

extracted = "\n".join(lines[start:end]).strip()
out = "# HARDENING PLAN EXTRACT\n\n" + extracted + "\n"
out_path.write_text(out, encoding="utf-8")
PY

echo "Wrote: $OUT"
