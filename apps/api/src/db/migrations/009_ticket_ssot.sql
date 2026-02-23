CREATE TABLE IF NOT EXISTS ticket_ssot (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  TEXT NOT NULL,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE SET NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_ssot_ticket_id ON ticket_ssot(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ssot_session_id ON ticket_ssot(session_id);
