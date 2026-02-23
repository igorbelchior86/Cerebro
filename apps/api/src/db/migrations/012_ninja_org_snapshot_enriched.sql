CREATE TABLE IF NOT EXISTS ninja_org_snapshot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ninja_org_snapshot_org_id
  ON ninja_org_snapshot(org_id);

CREATE TABLE IF NOT EXISTS ninja_org_enriched (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ninja_org_enriched_org_id
  ON ninja_org_enriched(org_id);
