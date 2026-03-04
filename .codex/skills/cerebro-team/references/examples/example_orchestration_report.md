# Example Orchestration Report (Output)

## Change Brief
(CHANGE_BRIEF here)

## Agents Invoked
- productlead (review)
- backendlead (owner)
- reliability (gate)

## Key decisions
- Use idempotency_key stored per ticket_note_write
- Add connector contract test
- Add structured logs

## Gates
- Contract gate: PASS
- Connector write-safety: PASS
- Observability: PASS

## Evidence Pack
- Unit tests: PASS
- Integration tests: PASS
- Logs: attached
- Rollback: feature flag documented

## Status
READY
