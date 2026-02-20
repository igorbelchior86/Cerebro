ALTER TABLE tickets_processed
  ADD COLUMN IF NOT EXISTS company VARCHAR(255);

