// Controller - Add to recording-controller.js
const fs = require("fs");
const path = require("path");
const recordingService = require("../services/recording-service");
const DeepgramService = require("../services/deepgram-service");
const pythonController = require("./python-controller");
const { Logger } = require("../config");

// recording-controller.js
exports.uploadVideoChunk = async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const sequence = parseInt(req.body.sequence);
    const chunk = req.file.buffer;  // ← From multer

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    Logger.info(`[CONTROLLER] Video chunk - Session: ${sessionId}, Sequence: ${sequence}`);

    await recordingService.saveChunk({
      sessionId,
      type: "video",
      chunk,
      sequence,
      requestId: req.requestId
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    Logger.error(`[CONTROLLER] Video chunk error:`, err);
    res.status(500).json({ error: "Failed to save video chunk" });
  }
};

exports.uploadAudioChunk = async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const sequence = parseInt(req.body.sequence);
    const chunk = req.file.buffer;  // ← From multer

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    Logger.info(`[CONTROLLER] Audio chunk - Session: ${sessionId}, Sequence: ${sequence}`);

    await recordingService.saveChunk({
      sessionId,
      type: "audio",
      chunk,
      sequence,
      requestId: req.requestId
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    Logger.error(`[CONTROLLER] Audio chunk error:`, err);
    res.status(500).json({ error: "Failed to save audio chunk" });
  }
};

/**
 * Transcribe audio file using Deepgram
 * @param {string} audioPath - Path to audio file
 * @param {string} sessionId - Session ID for broadcasting
 * @param {object} metadata - Session metadata
 * @returns {Promise<{text: string, deepgramResponse: object}|null>} Transcription result or null if failed
 */
exports.transcribeAudio = async (audioPath, sessionId, metadata) => {
  try {
    if (!audioPath || !fs.existsSync(audioPath)) {
      Logger.warn(`[Recording Controller] No audio file found at ${audioPath}, skipping transcription`);
      return null;
    }

    Logger.info(`[Recording Controller] Processing audio file: ${audioPath}`);
    const transcription = await DeepgramService.transcribeFile(audioPath);

    const transcribedText = transcription.text;
    const deepgramFullResponse = transcription; // Full response (text, timeline, metadata, raw)

    Logger.info(`[Recording Controller] Transcribed text from Deepgram:`);
    Logger.info(`[Recording Controller] Text: "${transcribedText}"`);
    Logger.info(`[Recording Controller] Timeline segments: ${transcription.timeline?.length || 0}`);
    Logger.info(`[Recording Controller] Metadata: ${JSON.stringify(transcription.metadata)}`);

    // NOTE: We do NOT send raw audio here anymore.
    // The processed AI audio from Python will be sent by python-controller.js
    // This prevents the user's voice from being played instead of AI narration.

    return {
      text: transcribedText,
      deepgramResponse: deepgramFullResponse
    };
  } catch (deepgramError) {
    Logger.error(`[Recording Controller] Error processing audio with Deepgram: ${deepgramError}`);

    // Notify frontend of transcription failure
    const frontendService = require("../services/frontend-service");
    frontendService.sendInstructions(sessionId, {
      action: "error",
      target: "Transcription Failed",
      metadata: { error: deepgramError.message }
    });

    // Send raw audio as fallback
    if (audioPath && fs.existsSync(audioPath)) {
      frontendService.sendAudio(sessionId, {
        filename: path.basename(audioPath),
        path: `/recordings/${path.basename(audioPath)}`,
        text: "Transcription failed",
        timestamp: new Date().toISOString()
      });
    }

    return null;
  }
};

exports.processRecording = async (req, res) => {
  try {
    const events = req.body.events ? JSON.parse(req.body.events) : [];
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    const videoPath = req.files?.video?.[0]?.path;
    let audioPath = req.files?.audio?.[0]?.path;

    // Finalize video/audio & save JSON first to ensure files are ready
    const result = await recordingService.processRecording({
      events,
      metadata,
      videoPath,
      audioPath,
    });

    // Validated permanent paths and signed URLs from service
    const permanentVideoPath = result.videoPath;
    const permanentAudioPath = result.audioPath;
    const videoSignedUrl = result.videoSignedUrl;
    const audioSignedUrl = result.audioSignedUrl;

    // Use result.sessionId as it may have been corrected by fallback logic in service
    const actualSessionId = result.sessionId;

    // 1. Broadcast video to frontend IMMEDIATELY (video doesn't need AI processing)
    // DEFENSIVE: Wrap in try-catch so broadcast errors don't block AI processing
    try {
      // Prefer signed URL from Supabase Storage, fallback to local path
      if (videoSignedUrl || permanentVideoPath) {
        Logger.info(`[Recording Controller] Broadcasting video to frontend session: ${actualSessionId}`);
        const frontendService = require("../services/frontend-service");
        
        if (videoSignedUrl) {
          // Use Supabase signed URL directly
          frontendService.sendVideo(actualSessionId, {
            filename: `${metadata.sessionId}_video.webm`,
            url: videoSignedUrl,  // Direct signed URL
            path: null,  // No local path
            metadata: metadata,
            timestamp: new Date().toISOString()
          });
        } else {
          // Fallback to local path
          frontendService.sendVideo(actualSessionId, {
            filename: path.basename(permanentVideoPath),
            path: `/recordings/${path.basename(permanentVideoPath)}`,
            metadata: metadata,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (broadcastError) {
      // Don't let broadcast errors block AI processing
      Logger.error(`[Recording Controller] Error broadcasting video to frontend (continuing with AI processing):`, broadcastError);
    }

    // 2. Check for real-time processing results first (if enabled)
    let realtimeResult = null;
    if (recordingService.isRealtimeEnabled()) {
      Logger.info(`[Recording Controller] Checking for real-time processing results...`);
      realtimeResult = await recordingService.finalizeRealtimeProcessing(actualSessionId);
      
      if (realtimeResult && realtimeResult.audioPath) {
        Logger.info(`[Recording Controller] Real-time audio available: ${realtimeResult.audioFilename}`);
        
        // Send the pre-generated audio to frontend
        const frontendService = require("../services/frontend-service");
        frontendService.sendAudio(actualSessionId, {
          filename: realtimeResult.audioFilename,
          path: `/recordings/${realtimeResult.audioFilename}`,
          text: realtimeResult.transcription,
          timestamp: new Date().toISOString(),
          isStreamed: true,
        });
        
        // Send transcription as instructions
        if (realtimeResult.sentences && realtimeResult.sentences.length > 0) {
          realtimeResult.sentences.forEach((sentence, index) => {
            frontendService.sendInstructions(actualSessionId, {
              type: 'transcription',
              text: sentence,
              index: index,
              timestamp: Date.now(),
            });
          });
        }
      }
    }

    // 3. Transcribe audio with Deepgram (if no real-time result and audio exists)
    let transcriptionResult = null;
    if (!realtimeResult) {
      transcriptionResult = await exports.transcribeAudio(
        permanentAudioPath,
        actualSessionId,
        metadata
      );
      
      // Update recording metadata with timeline data for transcript sync
      if (transcriptionResult && transcriptionResult.deepgramResponse && transcriptionResult.deepgramResponse.timeline) {
        try {
          const supabaseService = require("../services/supabase-service");
          const recording = await supabaseService.getRecordingBySessionId(actualSessionId);
          
          if (recording) {
            await supabaseService.updateRecordingStatus(actualSessionId, recording.status, {
              metadata: {
                ...recording.metadata,
                timeline: transcriptionResult.deepgramResponse.timeline,
                transcript: transcriptionResult.text
              }
            });
            Logger.info(`[Recording Controller] Updated recording metadata with timeline data (${transcriptionResult.deepgramResponse.timeline.length} words)`);
          }
        } catch (metadataError) {
          Logger.error(`[Recording Controller] Error updating recording metadata with timeline:`, metadataError);
        }
      }
    } else {
      // Use real-time transcription result
      transcriptionResult = {
        text: realtimeResult.transcription,
        deepgramResponse: { text: realtimeResult.transcription, sentences: realtimeResult.sentences },
      };
    }

    // Store DOM events for fallback (in case Python processing fails)
    try {
      const frontendService = require("../services/frontend-service");
      if (events && events.length > 0) {
        frontendService.storeDomEvents(actualSessionId, events);
        Logger.info(`[Recording Controller] Stored ${events.length} DOM events for potential fallback`);
      }
    } catch (storageError) {
      Logger.error(`[Recording Controller] Error storing DOM events for fallback:`, storageError);
    }

    // 4. Process with AI (if transcription succeeded and no real-time audio)
    let pythonResponse = null;
    if (!realtimeResult && transcriptionResult && transcriptionResult.text) {
      // Get userId for Supabase storage path
      const userId = result.storageVideoPath ? result.storageVideoPath.split('/')[0] : null;
      
      pythonResponse = await pythonController.processWithAI(
        transcriptionResult.text,
        events,
        metadata,
        transcriptionResult.deepgramResponse, // Full Deepgram JSON
        actualSessionId,
        permanentAudioPath, // Raw audio path (for local fallback)
        audioSignedUrl,     // Supabase signed URL for raw audio
        userId              // User ID for uploading processed audio
      );

      // If Python processing failed, trigger fallback to DOM events
      if (!pythonResponse) {
        Logger.warn(`[Recording Controller] Python processing failed, triggering DOM events fallback`);
        try {
          const frontendService = require("../services/frontend-service");
          frontendService.sendDomEventsAsFallback(actualSessionId);
        } catch (fallbackError) {
          Logger.error(`[Recording Controller] Error triggering fallback:`, fallbackError);
        }
      }
    } else if (realtimeResult) {
      // Real-time processing succeeded, skip Python
      Logger.info(`[Recording Controller] Using real-time audio, skipping Python processing`);
    } else {
      // No transcription, use DOM events as fallback
      Logger.warn(`[Recording Controller] No transcription available, triggering DOM events fallback`);
      try {
        const frontendService = require("../services/frontend-service");
        frontendService.sendDomEventsAsFallback(actualSessionId);
      } catch (fallbackError) {
        Logger.error(`[Recording Controller] Error triggering fallback:`, fallbackError);
      }
    }

    // Add transcription info to result
    if (transcriptionResult) {
      result.transcription = {
        text: transcriptionResult.text,
        sentToPython: pythonResponse !== null,
        pythonResponse: pythonResponse,
        deepgramResponse: transcriptionResult.deepgramResponse
      };
    }

    // Clean up local audio file after transcription (if it was uploaded to Supabase)
    if (permanentAudioPath && result.storageAudioPath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(permanentAudioPath)) {
          fs.unlinkSync(permanentAudioPath);
          Logger.info(`[Recording Controller] Local audio file deleted after transcription: ${permanentAudioPath}`);
        }
      } catch (cleanupErr) {
        Logger.error(`[Recording Controller] Error deleting local audio file:`, cleanupErr);
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    Logger.error("Process recording error:", err);
    res.status(500).json({
      error: "Failed to process recording",
      message: err.message,
    });
  }
};
