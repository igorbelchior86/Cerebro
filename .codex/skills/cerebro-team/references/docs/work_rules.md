# Work Rules (Everyone involved in every change)

## Core rule
Every change is reviewed cross-domain:
- 1 Primary Owner (domain owner)
- 2 Cross-reviewers (different domains)
- Reliability final gate

## PR expectations
- Small PRs (prefer <= ~300 LOC net change)
- Feature flags for risky behavior changes
- Explicit degraded mode for external dependencies
- Evidence Pack attached/linked

## No-silo policy
Reviewers must comment on:
- Contracts and compatibility
- Failure modes
- Observability
- Test coverage


## Engineering Principles
All work must comply with `docs/engineering_principles.md`. PR reviews must explicitly call out any principle violations.
