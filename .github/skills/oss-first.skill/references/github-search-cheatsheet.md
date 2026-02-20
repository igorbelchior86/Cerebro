# GitHub Search Cheat Sheet

## Useful Qualifiers

- `stars:>500`  adoption signal
- `forks:>100`  ecosystem signal
- `pushed:>2023-01-01`  recency
- `language:python`  narrow by stack
- `topic:cli`  narrow by intent
- `in:readme <term>`  find usage keywords
- `archived:false`  avoid archived repos

## Example Queries

- `ffmpeg wrapper cli stars:>200 pushed:>2022-01-01`
- `pdf ocr cli stars:>500 pushed:>2023-01-01`
- `bulk rename tool stars:>300 pushed:>2022-01-01`
- `web crawler archive stars:>300 pushed:>2022-01-01`

## Strategy

1. Start with 2 to 3 keywords for the core job.
2. Add constraints (stars, pushed) only after you see candidates.
3. Open top 5 repos and read:
   - README
   - Releases
   - Issues (most recent)
   - License
