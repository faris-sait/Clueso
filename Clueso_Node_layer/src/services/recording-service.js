// recording-service.js
const fs = require("fs");
const path = require("path");
const { Logger } = require("../config");
const supabaseService = require("./supabase-service");
const RealtimeAudioService = require("./realtime-audio-service");

const uploadDir = path.join(__dirname, "..", "uploads");
const recordingsDir = path.join(__dirname, "..", "recordings");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

// CHANGED: Per-session file streams
const activeStreams = new Map(); // sessionId -> { videoFile, audioFile, videoBytesWritten, audioBytesWritten }

// Feature flag for real-time processing
const ENABLE_REALTIME_PROCESSING = process.env.ENABLE_REALTIME_PROCESSING === 'true';

const getOrCreateStream = (sessionId, type) => {
  if (!activeStreams.has(sessionId)) {
    activeStreams.set(sessionId, {
      videoFile: null,
      audioFile: null,
      videoFilePath: null,
      audioFilePath: null,
      videoBytesWritten: 0,
      audioBytesWritten: 0,
      videoChunks: [],  // Track chunk order
      audioChunks: [],
      realtimeInitialized: false,
    });
  }

  const session = activeStreams.get(sessionId);

  if (type === "video" && !session.videoFile) {
    const filename = `video_${sessionId}.webm`;
    session.videoFilePath = path.join(uploadDir, filename);
    session.videoFile = fs.createWriteStream(session.videoFilePath);
    Logger.info(`[SERVICE] Created video stream for session: ${sessionId}`);
  }

  if (type === "audio" && !session.audioFile) {
    const filename = `audio_${sessionId}.webm`;
    session.audioFilePath = path.join(uploadDir, filename);
    session.audioFile = fs.createWriteStream(session.audioFilePath);
    Logger.info(`[SERVICE] Created audio stream for session: ${sessionId}`);
    
    // Initialize real-time processing for audio
    if (ENABLE_REALTIME_PROCESSING && !session.realtimeInitialized) {
      RealtimeAudioService.initSession(sessionId).then(() => {
        session.realtimeInitialized = true;
        Logger.info(`[SERVICE] Real-time processing initialized for session: ${sessionId}`);
      }).catch(err => {
        Logger.error(`[SERVICE] Failed to init real-time processing:`, err);
      });
    }
  }

  return session;
};

exports.saveChunk = async ({ sessionId, type, chunk, sequence, requestId }) => {
  return new Promise((resolve, reject) => {
    try {
      if (!sessionId) {
        return reject(new Error("sessionId is required"));
      }

      const session = getOrCreateStream(sessionId, type);
      const stream = type === "video" ? session.videoFile : session.audioFile;

      if (!stream) {
        return reject(new Error(`Failed to create ${type} stream`));
      }

      Logger.info(`[SERVICE] Saving ${type} chunk for session ${sessionId}`);
      Logger.info(`[SERVICE] Sequence: ${sequence}, Size: ${chunk.length} bytes`);

      // Store chunk info for ordering verification
      const chunks = type === "video" ? session.videoChunks : session.audioChunks;
      chunks.push({ sequence, size: chunk.length, timestamp: Date.now() });

      // Send audio chunks to real-time processing (non-blocking)
      if (type === "audio" && ENABLE_REALTIME_PROCESSING && session.realtimeInitialized) {
        RealtimeAudioService.processAudioChunk(sessionId, chunk).catch(err => {
          Logger.warn(`[SERVICE] Real-time audio processing error (non-fatal):`, err.message);
        });
      }

      stream.write(chunk, (err) => {
        if (err) {
          Logger.error(`[SERVICE] Error writing ${type} chunk:`, err);
          return reject(err);
        }

        if (type === "video") {
          session.videoBytesWritten += chunk.length;
          Logger.info(`[SERVICE] Video bytes written: ${session.videoBytesWritten}`);
        } else {
          session.audioBytesWritten += chunk.length;
          Logger.info(`[SERVICE] Audio bytes written: ${session.audioBytesWritten}`);
        }

        resolve();
      });
    } catch (err) {
      Logger.error(`[SERVICE] Error in saveChunk:`, err);
      reject(err);
    }
  });
};

const finalizeStream = (sessionId, type) => {
  return new Promise((resolve) => {
    if (!activeStreams.has(sessionId)) {
      return resolve(null);
    }

    const session = activeStreams.get(sessionId);

    if (type === "video" && session.videoFile) {
      Logger.info(`[SERVICE] Finalizing video for session ${sessionId}`);
      Logger.info(`[SERVICE] Total chunks: ${session.videoChunks.length}`);
      Logger.info(`[SERVICE] Total bytes: ${session.videoBytesWritten}`);

      session.videoFile.end(() => {
        const path = session.videoFilePath;
        Logger.info(`[SERVICE] Video stream closed: ${path}`);
        resolve(path);
      });
    } else if (type === "audio" && session.audioFile) {
      Logger.info(`[SERVICE] Finalizing audio for session ${sessionId}`);
      Logger.info(`[SERVICE] Total chunks: ${session.audioChunks.length}`);
      Logger.info(`[SERVICE] Total bytes: ${session.audioBytesWritten}`);

      session.audioFile.end(() => {
        const path = session.audioFilePath;
        Logger.info(`[SERVICE] Audio stream closed: ${path}`);
        resolve(path);
      });
    } else {
      resolve(null);
    }
  });
};

exports.processRecording = async ({ events, metadata, videoPath, audioPath }) => {
  try {
    let sessionId = metadata.sessionId;
    let originalSessionId = sessionId; // Keep track of original for response
    Logger.info(`[SERVICE] Processing recording for session: ${sessionId}`);

    // DEBUG: Log active sessions
    Logger.info(`[SERVICE] Active sessions: ${Array.from(activeStreams.keys()).join(', ')}`);
    Logger.info(`[SERVICE] Session exists in activeStreams: ${activeStreams.has(sessionId)}`);

    // WORKAROUND: If requested session doesn't exist, use the most recent one
    if (!activeStreams.has(sessionId) && activeStreams.size > 0) {
      const activeSessions = Array.from(activeStreams.keys());
      const fallbackSession = activeSessions[activeSessions.length - 1];
      Logger.warn(`[SERVICE] SessionId mismatch! Requested: ${sessionId}, Using fallback: ${fallbackSession}`);
      Logger.warn(`[SERVICE] IMPORTANT: Frontend should connect to: ${fallbackSession}`);
      sessionId = fallbackSession;
      // Update metadata to use the correct session ID for frontend communication
      metadata.sessionId = fallbackSession;
    }

    // Finalize streams for this session
    let finalAudioPath = audioPath || (await finalizeStream(sessionId, "audio"));
    let finalVideoPath = videoPath || (await finalizeStream(sessionId, "video"));

    // DEBUG: Log what we got
    Logger.info(`[SERVICE] finalAudioPath: ${finalAudioPath}`);
    Logger.info(`[SERVICE] finalVideoPath: ${finalVideoPath}`);

    // Clean up session from active streams
    if (activeStreams.has(sessionId)) {
      const session = activeStreams.get(sessionId);

      // Log chunk statistics
      Logger.info(`[SERVICE] Session ${sessionId} statistics:`);
      Logger.info(`[SERVICE] Video chunks received: ${session.videoChunks.length}`);
      Logger.info(`[SERVICE] Audio chunks received: ${session.audioChunks.length}`);

      // Check for missing sequences
      if (session.videoChunks.length > 0) {
        const videoSequences = session.videoChunks.map(c => c.sequence).sort((a, b) => a - b);
        const missingVideo = [];
        for (let i = 0; i < videoSequences[videoSequences.length - 1]; i++) {
          if (!videoSequences.includes(i)) missingVideo.push(i);
        }
        if (missingVideo.length > 0) {
          Logger.warn(`[SERVICE] Missing video chunks: ${missingVideo.join(', ')}`);
        }
      }

      activeStreams.delete(sessionId);
    }

    // Move files to permanent location
    let permanentVideoPath = null;
    let permanentAudioPath = null;

    if (finalVideoPath && fs.existsSync(finalVideoPath)) {
      permanentVideoPath = path.join(recordingsDir, `recording_${sessionId}_video.webm`);
      fs.copyFileSync(finalVideoPath, permanentVideoPath);
      fs.unlinkSync(finalVideoPath);
      Logger.info(`[SERVICE] Video moved to: ${permanentVideoPath}`);
    }

    if (finalAudioPath && fs.existsSync(finalAudioPath)) {
      permanentAudioPath = path.join(recordingsDir, `recording_${sessionId}_audio.webm`);
      fs.copyFileSync(finalAudioPath, permanentAudioPath);
      fs.unlinkSync(finalAudioPath);
      Logger.info(`[SERVICE] Audio moved to: ${permanentAudioPath}`);
    }

    const recordingData = {
      sessionId: metadata.sessionId,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      url: metadata.url,
      viewport: metadata.viewport,
      events,
      videoPath: permanentVideoPath || null,
      audioPath: permanentAudioPath || null,
      processedAt: new Date().toISOString(),
    };

    const filename = `recording_${metadata.sessionId}_${Date.now()}.json`;
    const filePath = path.join(recordingsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(recordingData, null, 2), "utf8");

    Logger.info(`[SERVICE] Recording saved: ${filename}`);

    // Save to Supabase if user ID is provided
    if (metadata.userId || metadata.clerkId) {
      try {
        let userId = metadata.userId;
        
        // If we have clerkId, look up the Supabase user ID
        if (!userId && metadata.clerkId) {
          const user = await supabaseService.getUserByClerkId(metadata.clerkId);
          if (user) {
            userId = user.id;
          }
        }

        if (userId) {
          // Upload files to Supabase Storage
          let storageVideoPath = null;
          let storageAudioPath = null;
          let videoSignedUrl = null;
          let audioSignedUrl = null;
          
          // Keep track of original paths for transcription (before deletion)
          const originalVideoPath = permanentVideoPath;
          const originalAudioPath = permanentAudioPath;

          if (permanentVideoPath && fs.existsSync(permanentVideoPath)) {
            const videoFileName = `${userId}/${metadata.sessionId}_video.webm`;
            storageVideoPath = await supabaseService.uploadToStorage(permanentVideoPath, videoFileName);
            if (storageVideoPath) {
              Logger.info(`[SERVICE] Video uploaded to Supabase Storage: ${storageVideoPath}`);
              // Generate signed URL for immediate use
              videoSignedUrl = await supabaseService.getSignedUrl(storageVideoPath);
              // Delete local file after successful upload
              fs.unlinkSync(permanentVideoPath);
              Logger.info(`[SERVICE] Local video file deleted: ${permanentVideoPath}`);
            }
          }

          if (permanentAudioPath && fs.existsSync(permanentAudioPath)) {
            const audioFileName = `${userId}/${metadata.sessionId}_audio.webm`;
            storageAudioPath = await supabaseService.uploadToStorage(permanentAudioPath, audioFileName);
            if (storageAudioPath) {
              Logger.info(`[SERVICE] Audio uploaded to Supabase Storage: ${storageAudioPath}`);
              // Generate signed URL for immediate use
              audioSignedUrl = await supabaseService.getSignedUrl(storageAudioPath);
              // NOTE: Don't delete audio file yet - controller needs it for transcription
              // The controller will delete it after transcription
              Logger.info(`[SERVICE] Audio file kept for transcription: ${permanentAudioPath}`);
            }
          }

          await supabaseService.createRecording({
            userId,
            sessionId: metadata.sessionId,
            title: metadata.title || `Recording ${metadata.sessionId.split('_').pop()}`,
            url: metadata.url,
            videoPath: storageVideoPath,  // Now stores Supabase storage path
            audioPath: storageAudioPath,  // Now stores Supabase storage path
            eventsCount: events.length,
            metadata: {
              startTime: metadata.startTime,
              endTime: metadata.endTime,
              viewport: metadata.viewport,
              timeline: metadata.timeline || null, // Store Deepgram timeline for transcript sync
            },
          });
          Logger.info(`[SERVICE] Recording saved to Supabase for user: ${userId}`);

          // Return with signed URLs for immediate frontend use
          // Keep audioPath for transcription in controller
          return {
            success: true,
            sessionId: metadata.sessionId,
            filename,
            eventsProcessed: events.length,
            message: "Recording saved successfully",
            audioPath: originalAudioPath,  // Keep original path for transcription
            videoPath: null,  // Video is deleted, use signed URL
            videoSignedUrl,
            audioSignedUrl,
            storageVideoPath,
            storageAudioPath,
          };
        }
      } catch (supabaseErr) {
        Logger.error('[SERVICE] Error saving to Supabase:', supabaseErr);
        // Don't fail the whole operation if Supabase save fails
      }
    }

    return {
      success: true,
      sessionId: metadata.sessionId,
      filename,
      eventsProcessed: events.length,
      message: "Recording saved successfully",
      audioPath: permanentAudioPath,
      videoPath: permanentVideoPath,
    };
  } catch (err) {
    Logger.error("[SERVICE] Error processing recording:", err);
    throw err;
  }
};

/**
 * Finalize real-time processing and get streamed audio
 * Call this after processRecording to get the pre-generated TTS audio
 */
exports.finalizeRealtimeProcessing = async (sessionId) => {
  if (!ENABLE_REALTIME_PROCESSING) {
    return null;
  }

  try {
    Logger.info(`[SERVICE] Finalizing real-time processing for session: ${sessionId}`);
    const result = await RealtimeAudioService.finalizeSession(sessionId);
    
    if (result && result.audio) {
      Logger.info(`[SERVICE] Real-time audio ready: ${result.audio.filename}`);
      return {
        audioPath: result.audio.path,
        audioFilename: result.audio.filename,
        transcription: result.transcription?.fullText || '',
        sentences: result.transcription?.sentences || [],
        segmentCount: result.audio.segmentCount,
      };
    }
    
    return null;
  } catch (err) {
    Logger.error(`[SERVICE] Error finalizing real-time processing:`, err);
    return null;
  }
};

/**
 * Check if real-time processing is enabled
 */
exports.isRealtimeEnabled = () => ENABLE_REALTIME_PROCESSING;