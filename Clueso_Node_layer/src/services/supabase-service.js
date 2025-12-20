const { createClient } = require('@supabase/supabase-js');
const { Logger } = require('../config');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

const getSupabaseClient = () => {
  if (!supabase && supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    Logger.info('[Supabase] Client initialized');
  }
  return supabase;
};

/**
 * Get user by Clerk ID
 */
const getUserByClerkId = async (clerkId) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('clerk_id', clerkId)
    .single();

  if (error) {
    Logger.error('[Supabase] Error fetching user:', error.message);
    return null;
  }

  return data;
};

/**
 * Create a new recording in Supabase
 */
const createRecording = async ({
  userId,
  sessionId,
  title,
  url,
  videoPath,
  audioPath,
  eventsCount,
  metadata,
}) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.warn('[Supabase] Client not initialized, skipping recording save');
    return null;
  }

  const { data, error } = await client.from('recordings').insert({
    user_id: userId,
    session_id: sessionId,
    title: title || `Recording ${sessionId.split('_').pop()}`,
    url: url || null,
    video_path: videoPath || null,
    audio_path: audioPath || null,
    events_count: eventsCount || 0,
    status: 'completed',
    metadata: metadata || null,
  }).select().single();

  if (error) {
    Logger.error('[Supabase] Error creating recording:', error.message);
    return null;
  }

  Logger.info(`[Supabase] Recording created: ${data.id}`);
  return data;
};

/**
 * Update recording status
 */
const updateRecordingStatus = async (sessionId, status, updates = {}) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('recordings')
    .update({ status, ...updates })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    Logger.error('[Supabase] Error updating recording:', error.message);
    return null;
  }

  return data;
};

/**
 * Get recordings for a user
 */
const getUserRecordings = async (userId) => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('recordings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    Logger.error('[Supabase] Error fetching recordings:', error.message);
    return [];
  }

  return data || [];
};

module.exports = {
  getSupabaseClient,
  getUserByClerkId,
  createRecording,
  updateRecordingStatus,
  getUserRecordings,
};
