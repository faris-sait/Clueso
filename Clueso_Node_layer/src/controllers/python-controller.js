// Controller for Python AI processing
const PythonService = require("../services/python-service");
const { Logger } = require("../config");
const path = require("path");
const fs = require("fs");
const supabaseService = require("../services/supabase-service");

/**
 * Process text with AI (Python service)
 * This controller can be used by recording flow, chat, or any other feature
 * 
 * @param {string} text - Text to process
 * @param {Array} events - DOM events from extension (optional for chat)
 * @param {object} metadata - Session metadata
 * @param {object} deepgramResponse - Full Deepgram JSON response (optional)
 * @param {string} sessionId - Session ID for broadcasting
 * @param {string} audioPath - Path to raw audio file (optional)
 * @param {string} audioSignedUrl - Supabase signed URL for raw audio (optional)
 * @param {string} userId - User ID for Supabase storage path (optional)
 * @returns {Promise<object|null>} Python response or null if failed
 */
exports.processWithAI = async (text, events = [], metadata = {}, deepgramResponse = null, sessionId = null, audioPath = null, audioSignedUrl = null, userId = null) => {
    try {
        if (!text || text.trim().length === 0) {
            Logger.warn(`[Python Controller] Text is empty, skipping AI processing`);
            return null;
        }

        Logger.info(`[Python Controller] Processing with AI:`);
        Logger.info(`[Python Controller] - Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        Logger.info(`[Python Controller] - DOM Events: ${events.length}`);
        Logger.info(`[Python Controller] - Has Deepgram Response: ${!!deepgramResponse}`);
        Logger.info(`[Python Controller] - Audio Path: ${audioPath || 'none'}`);
        Logger.info(`[Python Controller] - Session ID: ${sessionId || 'none'}`);

        // Send to Python service
        const pythonResponse = await PythonService.sendTextWithDomEvents(
            text,
            events,
            metadata,
            deepgramResponse // Pass full Deepgram JSON response (can be null for chat)
        );

        Logger.info(`[Python Controller] Successfully received response from Python layer`);
        Logger.info(`[Python Controller] Python response:`, JSON.stringify(pythonResponse));

        // Broadcast results to frontend if sessionId is provided
        if (sessionId) {
            const frontendService = require("../services/frontend-service");

            // Broadcast instructions if Python returned them
            if (pythonResponse && pythonResponse.instructions && Array.isArray(pythonResponse.instructions) && pythonResponse.instructions.length > 0) {
                Logger.info(`[Python Controller] Broadcasting ${pythonResponse.instructions.length} instructions to frontend`);
                pythonResponse.instructions.forEach((instruction, index) => {
                    frontendService.sendInstructions(sessionId, instruction, 'python');
                    Logger.info(`[Python Controller] Sent instruction ${index + 1}/${pythonResponse.instructions.length}`);
                });
            } else {
                // Fallback: Send DOM events as instructions if Python didn't return any
                Logger.info(`[Python Controller] No instructions from Python, using DOM events as fallback`);
                if (events && Array.isArray(events) && events.length > 0) {
                    Logger.info(`[Python Controller] Broadcasting ${events.length} DOM events as instructions to frontend`);
                    events.forEach((event, index) => {
                        frontendService.sendInstructions(sessionId, event, 'dom');
                        Logger.info(`[Python Controller] Sent DOM event ${index + 1}/${events.length} as instruction`);
                    });
                } else {
                    Logger.warn(`[Python Controller] No instructions from Python and no DOM events available`);
                }
            }

            // Handle processed audio if Python returned it
            if (pythonResponse && pythonResponse.processed_audio_filename) {
                const processedAudioPath = path.join(
                    __dirname,
                    '../../recordings',
                    pythonResponse.processed_audio_filename
                );

                Logger.info(`[Python Controller] Checking for processed audio at: ${processedAudioPath}`);

                // Verify the processed audio file exists
                if (fs.existsSync(processedAudioPath)) {
                    Logger.info(`[Python Controller] Found processed audio, broadcasting to frontend session: ${sessionId}`);
                    
                    // Try to upload processed audio to Supabase if userId is available
                    let processedAudioUrl = null;
                    if (userId) {
                        try {
                            const storagePath = `${userId}/${pythonResponse.processed_audio_filename}`;
                            const uploadedPath = await supabaseService.uploadToStorage(processedAudioPath, storagePath);
                            if (uploadedPath) {
                                processedAudioUrl = await supabaseService.getSignedUrl(uploadedPath);
                                Logger.info(`[Python Controller] Processed audio uploaded to Supabase: ${storagePath}`);
                                // Delete local file after upload
                                fs.unlinkSync(processedAudioPath);
                            }
                        } catch (uploadErr) {
                            Logger.error(`[Python Controller] Failed to upload processed audio to Supabase:`, uploadErr);
                        }
                    }
                    
                    frontendService.sendAudio(sessionId, {
                        filename: pythonResponse.processed_audio_filename,
                        url: processedAudioUrl,  // Supabase signed URL (may be null)
                        path: processedAudioUrl ? null : `/recordings/${pythonResponse.processed_audio_filename}`,
                        text: pythonResponse.script || text, // Use generated script if available
                        timestamp: new Date().toISOString()
                    });
                } else {
                    Logger.warn(`[Python Controller] Processed audio file not found at ${processedAudioPath}`);
                    // Fall back to raw audio signed URL
                    if (audioSignedUrl) {
                        Logger.info(`[Python Controller] Using raw audio signed URL as fallback`);
                        frontendService.sendAudio(sessionId, {
                            filename: audioPath ? path.basename(audioPath) : 'audio.webm',
                            url: audioSignedUrl,
                            path: null,
                            text: pythonResponse.script || text,
                            timestamp: new Date().toISOString()
                        });
                    } else if (audioPath && fs.existsSync(audioPath)) {
                        Logger.info(`[Python Controller] Using raw audio local path as fallback: ${audioPath}`);
                        frontendService.sendAudio(sessionId, {
                            filename: path.basename(audioPath),
                            path: `/recordings/${path.basename(audioPath)}`,
                            text: pythonResponse.script || text,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } else if (pythonResponse && pythonResponse.audio_generation_failed) {
                // Audio generation failed in Python, use raw audio signed URL
                Logger.warn(`[Python Controller] Audio generation failed in Python, using raw audio`);
                if (audioSignedUrl) {
                    frontendService.sendAudio(sessionId, {
                        filename: audioPath ? path.basename(audioPath) : 'audio.webm',
                        url: audioSignedUrl,
                        path: null,
                        text: pythonResponse.script || text,
                        timestamp: new Date().toISOString()
                    });
                } else if (audioPath && fs.existsSync(audioPath)) {
                    frontendService.sendAudio(sessionId, {
                        filename: path.basename(audioPath),
                        path: `/recordings/${path.basename(audioPath)}`,
                        text: pythonResponse.script || text,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        return pythonResponse;
    } catch (pythonError) {
        Logger.error(`[Python Controller] Error processing with AI: ${pythonError}`);

        // Notify frontend of AI failure if sessionId is provided
        if (sessionId) {
            const frontendService = require("../services/frontend-service");
            frontendService.sendInstructions(sessionId, {
                type: "error",
                target: { text: "AI Processing Failed" },
                timestamp: Date.now(),
                metadata: { error: pythonError.message || "Failed to connect to AI engine" }
            });

            // IMPORTANT: Send raw audio as fallback when Python fails
            // Prefer signed URL over local path
            if (audioSignedUrl) {
                Logger.info(`[Python Controller] Python failed, sending raw audio signed URL as fallback`);
                frontendService.sendAudio(sessionId, {
                    filename: audioPath ? path.basename(audioPath) : 'audio.webm',
                    url: audioSignedUrl,
                    path: null,
                    text: text, // Use original transcription
                    timestamp: new Date().toISOString()
                });
            } else if (audioPath && fs.existsSync(audioPath)) {
                Logger.info(`[Python Controller] Python failed, sending raw audio local path as fallback: ${audioPath}`);
                frontendService.sendAudio(sessionId, {
                    filename: path.basename(audioPath),
                    path: `/recordings/${path.basename(audioPath)}`,
                    text: text, // Use original transcription
                    timestamp: new Date().toISOString()
                });
            }
        }

        return null;
    }
};

/**
 * Process chat message with AI
 * Simplified wrapper for chat applications
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
exports.processChatMessage = async (req, res) => {
    try {
        const { text, sessionId, events = [] } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required" });
        }

        Logger.info(`[Python Controller] Processing chat message for session: ${sessionId}`);

        const metadata = {
            sessionId,
            source: 'chat',
            timestamp: new Date().toISOString(),
            ...req.body.metadata
        };

        const result = await exports.processWithAI(
            text,
            events,
            metadata,
            null, // No Deepgram response for chat
            sessionId,
            null  // No audio for chat
        );

        if (result) {
            return res.status(200).json({
                success: true,
                response: result
            });
        } else {
            return res.status(500).json({
                success: false,
                error: "AI processing failed"
            });
        }
    } catch (err) {
        Logger.error("[Python Controller] Chat message error:", err);
        res.status(500).json({
            error: "Failed to process chat message",
            message: err.message,
        });
    }
};
