-- ─────────────────────────────────────────
-- Auth hardening + platform admin control plane
-- Migration 015
-- ─────────────────────────────────────────

-- Normalize current identities first.
UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL;
UPDATE user_invites SET email = lower(trim(email)) WHERE email IS NOT NULL;

-- Enforce global uniqueness for local auth identities.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_global_unique ON users ((lower(trim(email))));

-- Harden invite semantics (one-time token, revocation, typed flow).
ALTER TABLE user_invites
  ADD COLUMN IF NOT EXISTS invite_type TEXT NOT NULL DEFAULT 'add_member'
    CHECK (invite_type IN ('activation', 'add_member')),
  ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_user_invites_token_hash ON user_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_invites_revoked_at ON user_invites(revoked_at);

-- Platform admin can issue invites before tenant users exist.
ALTER TABLE user_invites ALTER COLUMN created_by DROP NOT NULL;

-- Control-plane admins (outside tenant RBAC).
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);
