-- ─────────────────────────────────────────
-- Workspace Settings + Integration Credentials Multi-tenant Fix
-- Migration 006
-- ─────────────────────────────────────────

-- 1. Add workspace-level settings column to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2. Fix integration_credentials for multi-tenant:
--    Old schema had PK on (service) alone — only one set of creds per service globally.
--    We need (tenant_id, service) so each tenant can have its own credentials.

-- Drop old primary key constraint
ALTER TABLE integration_credentials DROP CONSTRAINT IF EXISTS integration_credentials_pkey;

-- Make tenant_id NOT NULL (with a default for existing rows)
UPDATE integration_credentials SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE integration_credentials ALTER COLUMN tenant_id SET NOT NULL;

-- Add composite primary key
ALTER TABLE integration_credentials ADD PRIMARY KEY (tenant_id, service);
