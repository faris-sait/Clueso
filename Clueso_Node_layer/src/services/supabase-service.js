const { createClient } = require('@supabase/supabase-js');
const { Logger } = require('../config');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STORAGE_BUCKET = 'Recordings';

let supabase = null;
let bucketVerified = false;

const getSupabaseClient = () => {
  if (!supabase && supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    Logger.info('[Supabase] Client initialized');
  }
  return supabase;
};

/**
 * Ensure the storage bucket exists
 */
const ensureBucketExists = async () => {
  if (bucketVerified) return true;
  
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      Logger.error(`[Supabase] Error listing buckets: ${listError.message}`);
      return false;
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    
    if (!bucketExists) {
      Logger.info(`[Supabase] Creating bucket: ${STORAGE_BUCKET}`);
      // Create bucket with default settings (no custom file size limit to avoid free tier issues)
      const { error: createError } = await client.storage.createBucket(STORAGE_BUCKET, {
        public: false,
      });
      
      if (createError) {
        Logger.error(`[Supabase] Error creating bucket: ${createError.message}`);
        return false;
      }
      Logger.info(`[Supabase] Bucket created: ${STORAGE_BUCKET}`);
    } else {
      Logger.info(`[Supabase] Bucket exists: ${STORAGE_BUCKET}`);
    }
    
    bucketVerified = true;
    return true;
  } catch (err) {
    Logger.error(`[Supabase] Bucket check exception: ${err.message}`);
    return false;
  }
};

/**
 * Upload a file to Supabase Storage
 * @param {string} localFilePath - Local file path
 * @param {string} storagePath - Path in storage bucket (e.g., "user123/video_session.webm")
 * @returns {string|null} Storage path on success, null on failure
 */
const uploadToStorage = async (localFilePath, storagePath) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.warn('[Supabase] Client not initialized, skipping storage upload');
    return null;
  }

  // Ensure bucket exists before uploading
  await ensureBucketExists();

  if (!fs.existsSync(localFilePath)) {
    Logger.error(`[Supabase] File not found: ${localFilePath}`);
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(localFilePath);
    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 
                        ext === '.mp4' ? 'video/mp4' : 
                        ext === '.wav' ? 'audio/wav' : 'application/octet-stream';

    Logger.info(`[Supabase] Uploading ${localFilePath} to ${STORAGE_BUCKET}/${storagePath} (${fileBuffer.length} bytes)`);

    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      Logger.error(`[Supabase] Storage upload error: ${error.message || JSON.stringify(error)}`);
      return null;
    }

    Logger.info(`[Supabase] File uploaded to storage: ${data.path}`);
    return storagePath;
  } catch (err) {
    Logger.error(`[Supabase] Storage upload exception: ${err.message || err}`);
    return null;
  }
};

/**
 * Generate a signed URL for a storage file
 * @param {string} storagePath - Path in storage bucket
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {string|null} Signed URL or null on failure
 */
const getSignedUrl = async (storagePath, expiresIn = 3600) => {
  const client = getSupabaseClient();
  if (!client || !storagePath) return null;

  try {
    Logger.info(`[Supabase] Generating signed URL for: ${storagePath}`);
    
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      Logger.error(`[Supabase] Signed URL error: ${error.message}`);
      return null;
    }

    Logger.info(`[Supabase] Signed URL generated successfully`);
    return data.signedUrl;
  } catch (err) {
    Logger.error(`[Supabase] Signed URL exception: ${err.message}`);
    return null;
  }
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

/**
 * Get recordings for a user with signed URLs
 */
const getUserRecordingsWithUrls = async (userId) => {
  const recordings = await getUserRecordings(userId);
  
  // Generate signed URLs for each recording
  const recordingsWithUrls = await Promise.all(
    recordings.map(async (recording) => {
      const videoUrl = recording.video_path 
        ? await getSignedUrl(recording.video_path) 
        : null;
      const audioUrl = recording.audio_path 
        ? await getSignedUrl(recording.audio_path) 
        : null;
      
      return {
        ...recording,
        videoUrl,
        audioUrl,
      };
    })
  );

  return recordingsWithUrls;
};

/**
 * Create feedback for a recording
 */
const createFeedback = async (userId, recordingId, message) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.warn('[Supabase] Client not initialized, skipping feedback save');
    return null;
  }

  const { data, error } = await client
    .from('feedback')
    .insert({
      user_id: userId,
      recording_id: recordingId,
      message: message,
    })
    .select(`
      *,
      users (first_name, last_name, email)
    `)
    .single();

  if (error) {
    Logger.error('[Supabase] Error creating feedback:', error.message);
    return null;
  }

  Logger.info(`[Supabase] Feedback created: ${data.id}`);
  return data;
};

/**
 * Get feedback for a recording
 */
const getRecordingFeedback = async (recordingId) => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('feedback')
    .select(`
      *,
      users (first_name, last_name, email)
    `)
    .eq('recording_id', recordingId)
    .order('created_at', { ascending: false });

  if (error) {
    Logger.error('[Supabase] Error fetching feedback:', error.message);
    return [];
  }

  return data || [];
};

/**
 * Get recording by session ID
 */
const getRecordingBySessionId = async (sessionId) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('recordings')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    Logger.error('[Supabase] Error fetching recording:', error.message);
    return null;
  }

  return data;
};

/**
 * Update recording title
 */
const updateRecordingTitle = async (sessionId, title) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('recordings')
    .update({ title })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    Logger.error('[Supabase] Error updating recording title:', error.message);
    return null;
  }

  Logger.info(`[Supabase] Recording title updated: ${sessionId}`);
  return data;
};

/**
 * Delete recording and associated files from storage
 */
const deleteRecording = async (sessionId) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.error('[Supabase] Client not initialized for deletion');
    return false;
  }

  try {
    Logger.info(`[Supabase] Attempting to delete recording: ${sessionId}`);
    
    // First get the recording to find storage paths
    const recording = await getRecordingBySessionId(sessionId);
    if (!recording) {
      Logger.error(`[Supabase] Recording not found for deletion: ${sessionId}`);
      
      // List all recordings to help debug
      const { data: allRecordings } = await client
        .from('recordings')
        .select('session_id')
        .limit(10);
      Logger.info(`[Supabase] Available session IDs: ${allRecordings?.map(r => r.session_id).join(', ') || 'none'}`);
      
      return false;
    }

    Logger.info(`[Supabase] Found recording to delete: ${recording.id}`);

    // Delete files from storage
    const filesToDelete = [];
    if (recording.video_path) filesToDelete.push(recording.video_path);
    if (recording.audio_path) filesToDelete.push(recording.audio_path);

    if (filesToDelete.length > 0) {
      Logger.info(`[Supabase] Deleting ${filesToDelete.length} files from storage: ${filesToDelete.join(', ')}`);
      const { error: storageError } = await client.storage
        .from(STORAGE_BUCKET)
        .remove(filesToDelete);

      if (storageError) {
        Logger.warn(`[Supabase] Error deleting storage files: ${storageError.message}`);
        // Continue with database deletion even if storage deletion fails
      } else {
        Logger.info(`[Supabase] Deleted ${filesToDelete.length} files from storage`);
      }
    }

    // Delete recording from database (cascade will delete feedback)
    const { error } = await client
      .from('recordings')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      Logger.error(`[Supabase] Error deleting recording from database: ${error.message}`);
      return false;
    }

    Logger.info(`[Supabase] Recording deleted successfully: ${sessionId}`);
    return true;
  } catch (err) {
    Logger.error(`[Supabase] Delete recording exception: ${err.message}`);
    return false;
  }
};

module.exports = {
  getSupabaseClient,
  getUserByClerkId,
  createRecording,
  updateRecordingStatus,
  getUserRecordings,
  getUserRecordingsWithUrls,
  uploadToStorage,
  getSignedUrl,
  createFeedback,
  getRecordingFeedback,
  getRecordingBySessionId,
  updateRecordingTitle,
  deleteRecording,
};
