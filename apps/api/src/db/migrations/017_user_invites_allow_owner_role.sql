-- ─────────────────────────────────────────
-- Allow owner role in user_invites for tenant onboarding flows
-- Migration 017
-- ─────────────────────────────────────────

ALTER TABLE user_invites DROP CONSTRAINT IF EXISTS user_invites_role_check;
ALTER TABLE user_invites
  ADD CONSTRAINT user_invites_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

