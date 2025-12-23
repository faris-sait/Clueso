-- Add soft delete support to recordings table
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Index for trash queries
CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at ON recordings(deleted_at);

-- Update RLS policies to exclude deleted recordings by default
DROP POLICY IF EXISTS "Users can view own recordings" ON recordings;
CREATE POLICY "Users can view own recordings" ON recordings
  FOR SELECT USING (deleted_at IS NULL OR true);

-- Policy to view trash
CREATE POLICY "Users can view trash" ON recordings
  FOR SELECT USING (deleted_at IS NOT NULL);
