CREATE TABLE IF NOT EXISTS ticket_text_artifacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  TEXT NOT NULL,
  session_id UUID NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_text_artifacts_ticket_id
  ON ticket_text_artifacts(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_text_artifacts_session_id
  ON ticket_text_artifacts(session_id);
