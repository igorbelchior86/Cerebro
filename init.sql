-- Enable extensions (pgvector not available in standard postgres:15, comment out for now)
-- CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- Triage Sessions
-- ─────────────────────────────────────────
CREATE TABLE triage_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     TEXT NOT NULL,
  org_id        TEXT,
  org_name      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','approved','needs_more_info','blocked','failed')),
  retry_count   INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error    TEXT,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_ticket_id  ON triage_sessions(ticket_id);
CREATE INDEX idx_sessions_org_id     ON triage_sessions(org_id);
CREATE INDEX idx_sessions_created_by ON triage_sessions(created_by);
CREATE INDEX idx_sessions_status     ON triage_sessions(status);

-- ─────────────────────────────────────────
-- Evidence Packs
-- ─────────────────────────────────────────
CREATE TABLE evidence_packs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_session ON evidence_packs(session_id);

-- ─────────────────────────────────────────
-- LLM Outputs (diagnose + playbook)
-- ─────────────────────────────────────────
CREATE TABLE llm_outputs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  step           TEXT NOT NULL CHECK (step IN ('diagnose', 'playbook')),
  model          TEXT NOT NULL,
  input_tokens   INT,
  output_tokens  INT,
  cost_usd       NUMERIC(10, 6),
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_outputs_session ON llm_outputs(session_id);
CREATE INDEX idx_llm_outputs_step    ON llm_outputs(step);

-- ─────────────────────────────────────────
-- Validation Results
-- ─────────────────────────────────────────
CREATE TABLE validation_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('approved','needs_more_info','blocked')),
  violations      JSONB NOT NULL DEFAULT '[]',
  required_fixes  JSONB NOT NULL DEFAULT '[]',
  req_questions   JSONB NOT NULL DEFAULT '[]',
  safe_to_proceed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_session ON validation_results(session_id);

-- ─────────────────────────────────────────
-- Playbooks (output final exportável)
-- ─────────────────────────────────────────
CREATE TABLE playbooks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  content_md   TEXT NOT NULL,
  content_json JSONB,
  exported_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playbooks_session ON playbooks(session_id);

-- ─────────────────────────────────────────
-- Audit Log
-- ─────────────────────────────────────────
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES triage_sessions(id) ON DELETE SET NULL,
  user_id      TEXT NOT NULL,
  action       TEXT NOT NULL,
  detail       JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_session    ON audit_log(session_id);
CREATE INDEX idx_audit_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- ─────────────────────────────────────────
-- Vector Documents (RAG — IT Glue runbooks) - commented out for now, requires pgvector
-- CREATE TABLE vector_documents (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   org_id       TEXT NOT NULL,
--   source       TEXT NOT NULL CHECK (source IN ('itglue','autotask_note','manual')),
--   source_ref   JSONB,
--   title        TEXT NOT NULL,
--   content      TEXT NOT NULL,
--   embedding    vector(1536),
--   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- CREATE INDEX idx_vector_org    ON vector_documents(org_id);
-- CREATE INDEX idx_vector_source ON vector_documents(source);
-- CREATE INDEX idx_vector_embed  ON vector_documents USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ─────────────────────────────────────────
-- Trigger: updated_at automático
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON triage_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- CREATE TRIGGER trg_vector_docs_updated_at
--   BEFORE UPDATE ON vector_documents
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- Integration Credentials
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_credentials (
  service      TEXT PRIMARY KEY CHECK (service IN ('autotask', 'ninjaone', 'itglue')),
  credentials  JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
