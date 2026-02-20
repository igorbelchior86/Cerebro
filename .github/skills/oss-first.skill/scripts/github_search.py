#!/usr/bin/env python3
"""
github_search.py

Optional helper for searching GitHub via the REST API.

Requires:
- Python 3.10+
- A GitHub token in env var GITHUB_TOKEN (recommended to avoid low rate limits)

Usage:
  python3 github_search.py "pdf ocr cli stars:>500 pushed:>2023-01-01" --limit 10

Notes:
- This is a convenience script. In chat, you can also search GitHub using your web tool.
"""

import argparse
import os
import sys
import requests

API = "https://api.github.com/search/repositories"

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="GitHub search query")
    ap.add_argument("--limit", type=int, default=10, help="Number of results to print")
    args = ap.parse_args()

    headers = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params = {"q": args.query, "sort": "stars", "order": "desc", "per_page": min(args.limit, 50)}
    r = requests.get(API, headers=headers, params=params, timeout=30)
    if r.status_code != 200:
        print(f"GitHub API error: {r.status_code} {r.text}", file=sys.stderr)
        return 2

    data = r.json()
    items = data.get("items", [])[: args.limit]
    for i, repo in enumerate(items, 1):
        print(f"{i}. {repo.get('full_name')}  ⭐ {repo.get('stargazers_count')}  {repo.get('html_url')}")
        desc = (repo.get("description") or "").strip()
        if desc:
            print(f"   {desc}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
