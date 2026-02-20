-- ─────────────────────────────────────────────────────────────
-- Migration 002: Integration Credentials
-- Stores per-service API credentials entered via Settings UI.
-- NOTE: Credentials are stored as JSON. In production, use
-- encryption at rest (e.g. pgcrypto or a secrets manager).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_credentials (
  service      TEXT PRIMARY KEY
                 CHECK (service IN ('autotask', 'ninjaone', 'itglue')),
  credentials  JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: keep updated_at fresh on every upsert
CREATE TRIGGER trg_integration_creds_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
