-- Version 1 — idempotent additive columns + indexes for OSS installs that predate schema.sql updates.
ALTER TABLE $SCHEMA.decisions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_decisions_unreviewed
  ON $SCHEMA.decisions(project_id)
  WHERE invalidated_at IS NULL AND reviewed_at IS NULL;

ALTER TABLE $SCHEMA.planning_blocks
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS planning_blocks_unique_topic
  ON $SCHEMA.planning_blocks(project_id, block_type, topic)
  WHERE topic IS NOT NULL;

ALTER TABLE $SCHEMA.projects
  ADD COLUMN IF NOT EXISTS last_synthesis_at TIMESTAMPTZ;

ALTER TABLE $SCHEMA.projects
  ADD COLUMN IF NOT EXISTS working_directory TEXT;
