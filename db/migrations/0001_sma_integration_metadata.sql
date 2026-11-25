-- Swanaya Media Academy: additive integration metadata only.
-- This migration deliberately does NOT copy, update, or delete Firebase records.
-- Review the live Railway database and take a verified backup before applying.
-- Apply manually to the intended Railway database after approval.

CREATE SCHEMA IF NOT EXISTS sma_integration;

CREATE TABLE IF NOT EXISTS sma_integration.schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sma_integration.firebase_document_map (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firebase_project_id TEXT NOT NULL,
  firestore_collection TEXT NOT NULL,
  firestore_document_id TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_record_id TEXT,
  source_updated_at TIMESTAMPTZ,
  payload_sha256 TEXT,
  sync_status TEXT NOT NULL DEFAULT 'DISCOVERED'
    CHECK (sync_status IN ('DISCOVERED', 'COPIED', 'VERIFIED', 'CONFLICT', 'ERROR')),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (firebase_project_id, firestore_collection, firestore_document_id)
);

CREATE TABLE IF NOT EXISTS sma_integration.sync_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  source_record_count BIGINT,
  copied_record_count BIGINT,
  verified_record_count BIGINT,
  conflict_count BIGINT,
  error_summary TEXT,
  initiated_by TEXT
);

INSERT INTO sma_integration.schema_migrations (version, description)
VALUES ('0001', 'Create isolated Firebase-to-PostgreSQL migration metadata')
ON CONFLICT (version) DO NOTHING;
