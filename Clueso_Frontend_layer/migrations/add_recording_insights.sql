-- Migration: Add recording_insights table for AI summaries
-- Run this in your Supabase SQL Editor

-- =====================
-- RECORDING INSIGHTS TABLE
-- =====================
-- Uses session_id (TEXT) instead of recording_id (UUID) for easier lookups
-- session_id matches the recording's session_id field
CREATE TABLE IF NOT EXISTS recording_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recording_insights_session_id ON recording_insights(session_id);

-- Enable RLS for insights
ALTER TABLE recording_insights ENABLE ROW LEVEL SECURITY;

-- Insights policies (allow all operations via service role)
CREATE POLICY "Users can view insights" ON recording_insights
  FOR SELECT USING (true);

CREATE POLICY "Users can insert insights" ON recording_insights
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update insights" ON recording_insights
  FOR UPDATE USING (true);
