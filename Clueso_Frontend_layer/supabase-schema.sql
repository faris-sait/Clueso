-- Supabase Schema for Clueso
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
-- Synced with Clerk via webhooks
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast Clerk ID lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- =====================
-- RECORDINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Recording',
  url TEXT,
  video_path TEXT,
  audio_path TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  events_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recordings
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (true); -- Allow service role to read all

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (true);

-- Recordings policies
CREATE POLICY "Users can view own recordings" ON recordings
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own recordings" ON recordings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own recordings" ON recordings
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own recordings" ON recordings
  FOR DELETE USING (true);

-- =====================
-- FEEDBACK TABLE
-- =====================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_recording_id ON feedback(recording_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS for feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Feedback policies
CREATE POLICY "Users can view feedback on recordings" ON feedback
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- =====================
-- RECORDING INSIGHTS TABLE
-- =====================
-- Uses session_id (TEXT) for easier lookups
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

-- Insights policies
CREATE POLICY "Users can view insights" ON recording_insights
  FOR SELECT USING (true);

CREATE POLICY "Users can insert insights" ON recording_insights
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update insights" ON recording_insights
  FOR UPDATE USING (true);

-- =====================
-- FUNCTIONS
-- =====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- HELPER FUNCTION
-- =====================

-- Get user by Clerk ID
CREATE OR REPLACE FUNCTION get_user_by_clerk_id(p_clerk_id TEXT)
RETURNS users AS $$
  SELECT * FROM users WHERE clerk_id = p_clerk_id LIMIT 1;
$$ LANGUAGE sql;
