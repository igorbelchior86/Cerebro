-- ─────────────────────────────────────────
-- Multi-tenant Row-Level Security (RLS)
-- Migration 005
-- ─────────────────────────────────────────

-- 1. Add tenant_id to remaining standalone tables
ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE integration_credentials ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_validation_results_tenant ON validation_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_tenant ON integration_credentials(tenant_id);

-- 2. Configure RLS Policies
-- All queries from the node-postgres pool will execute within a transaction setting LOCAL variables.
-- app.bypass_rls = 'on' allows explicitly querying across tenants (e.g. login/admin tasks)
-- otherwise it requires a match on app.current_tenant_id

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

-- Creating the policies 
CREATE POLICY isolation_policy_tenants ON tenants USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_users ON users USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_user_invites ON user_invites USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_triage_sessions ON triage_sessions USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_evidence_packs ON evidence_packs USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_llm_outputs ON llm_outputs USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_playbooks ON playbooks USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_validation_results ON validation_results USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_audit_log ON audit_log USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

CREATE POLICY isolation_policy_integration_credentials ON integration_credentials USING (
  current_setting('app.bypass_rls', true) = 'on' OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

-- Force RLS so even table owner connects via Node app respect the policies
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE user_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE triage_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE llm_outputs FORCE ROW LEVEL SECURITY;
ALTER TABLE playbooks FORCE ROW LEVEL SECURITY;
ALTER TABLE validation_results FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials FORCE ROW LEVEL SECURITY;
