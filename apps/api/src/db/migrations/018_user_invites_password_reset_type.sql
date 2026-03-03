-- ─────────────────────────────────────────
-- Allow password reset token type in user_invites
-- Migration 018
-- ─────────────────────────────────────────

ALTER TABLE user_invites DROP CONSTRAINT IF EXISTS user_invites_invite_type_check;
ALTER TABLE user_invites
  ADD CONSTRAINT user_invites_invite_type_check
  CHECK (invite_type IN ('activation', 'add_member', 'password_reset'));
