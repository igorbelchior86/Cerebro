-- ─────────────────────────────────────────
-- Tenant-scoped SAML provider configuration and replay protection
-- Migration 016
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_saml_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sp_entity_id TEXT NOT NULL,
  acs_url TEXT NOT NULL,
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_certificates JSONB NOT NULL DEFAULT '[]'::jsonb,
  nameid_format TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  attribute_mapping JSONB NOT NULL DEFAULT '{"email":"email","first_name":"firstName","last_name":"lastName","groups":"groups"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_saml_providers_tenant ON tenant_saml_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_saml_providers_enabled ON tenant_saml_providers(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS saml_request_replay_guard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  saml_request_id TEXT NOT NULL,
  assertion_id TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, provider_key, saml_request_id),
  UNIQUE (tenant_id, provider_key, assertion_id)
);

CREATE INDEX IF NOT EXISTS idx_saml_replay_guard_expiry ON saml_request_replay_guard(expires_at);

ALTER TABLE tenant_saml_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_request_replay_guard ENABLE ROW LEVEL SECURITY;

CREATE POLICY isolation_policy_tenant_saml_providers ON tenant_saml_providers USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_saml_request_replay_guard ON saml_request_replay_guard USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

ALTER TABLE tenant_saml_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE saml_request_replay_guard FORCE ROW LEVEL SECURITY;
