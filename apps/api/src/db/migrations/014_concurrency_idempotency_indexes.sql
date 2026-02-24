-- Deduplicate rows before adding uniqueness used by ON CONFLICT upserts.
-- Keep the most recently written row per logical key.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_id, step
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM llm_outputs
)
DELETE FROM llm_outputs lo
USING ranked
WHERE lo.id = ranked.id
  AND ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM validation_results
)
DELETE FROM validation_results vr
USING ranked
WHERE vr.id = ranked.id
  AND ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM playbooks
)
DELETE FROM playbooks p
USING ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_outputs_session_step_unique
  ON llm_outputs(session_id, step);

CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_results_session_unique
  ON validation_results(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playbooks_session_unique
  ON playbooks(session_id);
