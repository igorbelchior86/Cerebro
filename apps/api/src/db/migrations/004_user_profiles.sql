-- ─────────────────────────────────────────
-- User Profiles & Preferences
-- Migration 004
-- ─────────────────────────────────────────

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
