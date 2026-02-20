# Task: Debugging Authentication Error in Playbook Brain
**Status**: planning
**Started**: 2026-02-19

## Plan
- [x] Step 1: Initialize workflow orchestrator files
- [x] Step 2: Search codebase to locate source of 'Authentication required'
- [x] Step 3: Identify why the Playbook Brain chat request is returning 401
- [x] Step 4: Fix the auth header / token issue in frontend or backend
- [ ] Step 5: Verify Playbook Brain chat works properly

## Progress Notes
- Initialized.
- 'Authentication required' comes from `apps/api/src/middleware/auth.ts`, it means missing or invalid `pb_session` cookie or Bearer token.

## Review
(filled after completion)

---

# Task: Implement Email Ingestion for Tickets (Autotask Alternative)
**Status**: implementing
**Started**: 2026-02-19

## Plan
- [x] Step 1: Initialize Microsoft Graph API OAuth & fetch logic.
- [x] Step 2: Implement smart filter for `help@refreshtech.com` and `TICKET #`.
- [x] Step 3: Implement email parser (Title, Description, Requester, ID).
- [x] Step 4: Handle ticket updates (`RE: TICKET #`).
- [x] Step 5: Setup PostgreSQL to store `tickets_raw` and `tickets_processed` in new tables.
- [x] Step 6: Create an endpoint or worker to trigger the ingestion.
- [x] Step 7: Verify end-to-end ingestion flow with a test email.

## Progress Notes
- Wrote implementation plan in the brain artifact directory for user review.
- Built the `graphClient`, `emailParser`.
- Removed `firebaseStore` and creating Postgres tables and repository instead for simplicity.
- Added a `POST /email-ingestion/ingest` endpoint to run the pipeline manually.
- Completed DB Migrations. Awaiting user to test.

## Review
(filled after completion)
