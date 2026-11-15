#!/usr/bin/env node
/**
 * Migration 16: Revision System with Topic Progress and AI Generation
 * Exports SQL for revision features including GATE syllabus, topic tracking, and mistake enhancements
 */

export function getMigrationSQL() {
  return `
-- Create gate_syllabus table for topic seeder
CREATE TABLE IF NOT EXISTS gate_syllabus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  exam text NOT NULL CHECK (exam IN ('CS', 'DA')),
  topic_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, topic_name)
);

-- Create user_topic_progress table
CREATE TABLE IF NOT EXISTS user_topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  topic_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  last_studied timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_topic_progress_unique UNIQUE (user_id, subject_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_user_topic_progress_user_id ON user_topic_progress(user_id);
ALTER TABLE user_topic_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_topic_progress' AND policyname = 'user_topic_progress_own') THEN
    CREATE POLICY user_topic_progress_own ON user_topic_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Update mistakes table
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS question_id uuid;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS your_answer text;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS correct_answer text;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS source_ref text;

-- Update questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation text;

-- Update mock_tests table
ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS mode text DEFAULT 'practice';
`.trim()
}

// Allow direct execution for inspection
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').replace(/^[A-Za-z]:/, ''))) {
  console.log(getMigrationSQL())
}
