#!/usr/bin/env python3
"""Heuristic concurrency hotspot scanner for Cerebro apps/api."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List


TARGET_DIR = Path("apps/api/src")


PATTERNS: Dict[str, tuple[str, int]] = {
    "timer_interval": (r"\bsetInterval\s*\(", 4),
    "timer_timeout": (r"\bsetTimeout\s*\(", 2),
    "promise_all": (r"\bPromise\.all\s*\(", 2),
    "promise_race": (r"\bPromise\.race\s*\(", 2),
    "async_local_storage": (r"\bAsyncLocalStorage\b|\btenantContext\b", 3),
    "in_memory_guard": (r"\bisPolling\b|\bintervalId\b|\bretryIntervalId\b", 4),
    "db_read_write_helpers": (r"\bqueryOne\s*\(|\bquery\s*\(|\bexecute\s*\(|\binsert\s*\(", 3),
    "background_pipeline": (r"\btriggerBackgroundProcessing\b|\brunPipeline\b|\bstartRetryListener\b", 4),
}

KNOWN_HOTSPOTS: Dict[str, str] = {
    "services/triage-orchestrator.ts": "Background retry listener + session state transitions + multi-step writes",
    "services/autotask-polling.ts": "Timer-based polling with local overlap guard only",
    "services/email-ingestion-polling.ts": "Timer-based polling and backfill in same loop",
    "routes/playbook.ts": "Background processing helper can overlap with orchestrator/manual retriggers",
    "lib/tenantContext.ts": "AsyncLocalStorage tenant context propagation boundary",
    "db/pool.ts": "Transaction wrapper and RLS context application",
}


@dataclass
class Hit:
    pattern: str
    line: int
    preview: str


@dataclass
class FileSummary:
    path: str
    score: int
    reasons: List[str]
    hits: List[Hit]


def iter_ts_files(root: Path):
    for path in (root / TARGET_DIR).rglob("*.ts"):
        if any(part in {"dist", "node_modules"} for part in path.parts):
            continue
        yield path


def scan_file(path: Path, repo_root: Path) -> FileSummary | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    rel = path.relative_to(repo_root).as_posix()

    score = 0
    hits: List[Hit] = []
    reasons: List[str] = []

    for pattern_name, (regex, weight) in PATTERNS.items():
        compiled = re.compile(regex)
        for idx, line in enumerate(lines, start=1):
            if compiled.search(line):
                hits.append(Hit(pattern=pattern_name, line=idx, preview=line.strip()[:180]))
                score += weight

    for suffix, reason in KNOWN_HOTSPOTS.items():
        if rel.endswith(suffix):
            reasons.append(f"known_hotspot: {reason}")
            score += 20

    # Heuristics (candidate signals, not proof)
    if "setInterval(" in text and "isPolling" not in text:
        reasons.append("candidate_timer_overlap: interval without local reentrancy flag")
        score += 8
    if "setInterval(" in text and "isPolling" in text:
        reasons.append("timer_guard_present: verify guard resets in finally and multi-process behavior")
        score += 4
    if "queryOne(" in text and "execute(" in text and "FOR UPDATE" not in text:
        reasons.append("candidate_check_then_act: read/write sequence without row lock in same file")
        score += 8
    if "UPDATE triage_sessions" in text and "SELECT" in text:
        reasons.append("candidate_status_transition_race: triage session reads and writes coexist")
        score += 10
    if "AsyncLocalStorage" in text or "tenantContext.run(" in text:
        reasons.append("tenant_context_path: verify async context propagation across background work")
        score += 6

    if score == 0:
        return None

    hits.sort(key=lambda h: (h.line, h.pattern))
    return FileSummary(path=rel, score=score, reasons=reasons, hits=hits[:30])


def main():
    parser = argparse.ArgumentParser(description="Scan Cerebro apps/api for concurrency/race hotspots")
    parser.add_argument("--root", default=".", help="Repo root (default: current directory)")
    parser.add_argument("--limit", type=int, default=15, help="Max files to display")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    repo_root = Path(args.root).resolve()
    target_root = repo_root / TARGET_DIR
    if not target_root.exists():
        raise SystemExit(f"Target path not found: {target_root}")

    summaries: List[FileSummary] = []
    for file_path in iter_ts_files(repo_root):
        summary = scan_file(file_path, repo_root)
        if summary:
            summaries.append(summary)

    summaries.sort(key=lambda s: (-s.score, s.path))
    top = summaries[: args.limit]

    payload = {
        "repo_root": str(repo_root),
        "target": TARGET_DIR.as_posix(),
        "files_scanned": len(list(iter_ts_files(repo_root))),
        "results": [
            {
                **asdict(item),
                "hits": [asdict(h) for h in item.hits],
            }
            for item in top
        ],
    }

    if args.json:
        print(json.dumps(payload, indent=2))
        return

    print(f"# Concurrency Hotspots ({payload['target']})")
    print(f"Scanned files: {payload['files_scanned']}")
    print(f"Top results: {len(top)}\n")

    for idx, item in enumerate(top, start=1):
        print(f"{idx}. {item.path} [score={item.score}]")
        for reason in item.reasons:
            print(f"   - {reason}")
        for hit in item.hits[:8]:
            print(f"   - line {hit.line}: {hit.pattern} :: {hit.preview}")
        if len(item.hits) > 8:
            print(f"   - ... {len(item.hits) - 8} more hits")
        print()

    print("Notes:")
    print("- Heuristics mark candidates only; confirm with code path + repro.")
    print("- Prioritize files with DB state transitions plus timers/background execution.")


if __name__ == "__main__":
    main()

