/**
 * Real-time Audio Processing Service
 * Coordinates streaming transcription and TTS generation
 */
const StreamingTranscriptionService = require('./streaming-transcription-service');
const StreamingTTSService = require('./streaming-tts-service');
const FrontendService = require('./frontend-service');
const { Logger } = require('../config');

class RealtimeAudioService {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Initialize real-time processing for a session
   */
  async initSession(sessionId, metadata = {}) {
    if (this.sessions.has(sessionId)) {
      Logger.warn(`[RealtimeAudio] Session ${sessionId} already initialized`);
      return this.sessions.get(sessionId);
    }

    Logger.info(`[RealtimeAudio] Initializing session: ${sessionId}`);

    const session = {
      sessionId,
      metadata,
      transcriptionStarted: false,
      ttsStarted: false,
      sentenceCount: 0,
      isActive: true,
    };

    // Start TTS session
    StreamingTTSService.startSession(sessionId);
    session.ttsStarted = true;

    // Start transcription session with callback for completed sentences
    const transcriptionSession = await StreamingTranscriptionService.startSession(
      sessionId,
      // onSentenceComplete callback
      (sentence, index) => {
        this._onSentenceComplete(sessionId, sentence, index);
      },
      // onError callback
      (error) => {
        Logger.error(`[RealtimeAudio] Transcription error for ${sessionId}:`, error);
      }
    );

    if (transcriptionSession) {
      session.transcriptionStarted = true;
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Process incoming audio chunk
   */
  async processAudioChunk(sessionId, audioBuffer) {
    let session = this.sessions.get(sessionId);
    
    // Auto-initialize if needed
    if (!session) {
      session = await this.initSession(sessionId);
    }

    if (!session.transcriptionStarted) {
      Logger.warn(`[RealtimeAudio] Transcription not started for ${sessionId}`);
      return false;
    }

    // Send to streaming transcription
    return StreamingTranscriptionService.sendAudioChunk(sessionId, audioBuffer);
  }

  /**
   * Handle completed sentence from transcription
   */
  _onSentenceComplete(sessionId, sentence, index) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.sentenceCount++;
    Logger.info(`[RealtimeAudio] Sentence ${index} complete for ${sessionId}: "${sentence.substring(0, 40)}..."`);

    // Queue for TTS generation (runs in parallel)
    StreamingTTSService.queueSentence(sessionId, sentence, index);

    // Notify frontend of transcription progress
    FrontendService.sendInstructions(sessionId, {
      type: 'transcription_progress',
      sentenceIndex: index,
      text: sentence,
      timestamp: Date.now(),
    });
  }

  /**
   * Finalize session and get results
   */
  async finalizeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      Logger.warn(`[RealtimeAudio] No session to finalize: ${sessionId}`);
      return null;
    }

    Logger.info(`[RealtimeAudio] Finalizing session: ${sessionId}`);
    session.isActive = false;

    // End transcription and get final text
    const transcriptionResult = await StreamingTranscriptionService.endSession(sessionId);

    // Wait for TTS to complete and get combined audio
    const ttsResult = await StreamingTTSService.finalizeSession(sessionId);

    // Cleanup
    this.sessions.delete(sessionId);

    const result = {
      sessionId,
      transcription: transcriptionResult,
      audio: ttsResult,
      sentenceCount: session.sentenceCount,
    };

    Logger.info(`[RealtimeAudio] Session ${sessionId} finalized:`, {
      sentences: result.sentenceCount,
      audioFile: ttsResult?.filename,
    });

    return result;
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.isActive || false;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const ttsStatus = StreamingTTSService.getSessionStatus(sessionId);

    return {
      sessionId,
      isActive: session.isActive,
      transcriptionStarted: session.transcriptionStarted,
      sentenceCount: session.sentenceCount,
      tts: ttsStatus,
    };
  }
}

module.exports = new RealtimeAudioService();
