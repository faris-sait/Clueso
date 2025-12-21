/**
 * Streaming TTS Service
 * Generates TTS audio for sentences as they come in
 * Uses Deepgram TTS API
 */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../config');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak';
const DEFAULT_VOICE = 'aura-2-odysseus-en';

class StreamingTTSService {
  constructor() {
    this.sessions = new Map(); // sessionId -> TTS state
    this.recordingsPath = path.join(__dirname, '../../recordings');
  }

  /**
   * Start a TTS session for a recording
   */
  startSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const session = {
      sessionId,
      segments: [], // { index, text, audioPath, status }
      isProcessing: false,
      outputPath: null,
    };

    this.sessions.set(sessionId, session);
    Logger.info(`[StreamingTTS] Started session: ${sessionId}`);
    return session;
  }

  /**
   * Queue a sentence for TTS generation
   */
  async queueSentence(sessionId, sentence, index) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.startSession(sessionId);
    }

    const segment = {
      index,
      text: sentence,
      audioPath: null,
      audioBuffer: null,
      status: 'pending',
    };

    session.segments.push(segment);
    Logger.info(`[StreamingTTS] Queued sentence ${index} for session ${sessionId}`);

    // Start processing immediately (non-blocking)
    this._processSegment(session, segment).catch(err => {
      Logger.error(`[StreamingTTS] Error processing segment ${index}:`, err);
    });

    return segment;
  }

  /**
   * Process a single segment (generate TTS)
   */
  async _processSegment(session, segment) {
    segment.status = 'processing';
    Logger.info(`[StreamingTTS] Processing segment ${segment.index}: "${segment.text.substring(0, 30)}..."`);

    try {
      const audioBuffer = await this._generateTTS(segment.text);
      
      if (audioBuffer && audioBuffer.length > 100) {
        segment.audioBuffer = audioBuffer;
        segment.status = 'complete';
        Logger.info(`[StreamingTTS] Segment ${segment.index} complete: ${audioBuffer.length} bytes`);
      } else {
        segment.status = 'failed';
        Logger.warn(`[StreamingTTS] Segment ${segment.index} failed: audio too small`);
      }
    } catch (error) {
      segment.status = 'failed';
      Logger.error(`[StreamingTTS] Segment ${segment.index} failed:`, error.message);
    }
  }

  /**
   * Generate TTS audio for text
   */
  async _generateTTS(text, retries = 3) {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('Deepgram API key not configured');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(DEEPGRAM_TTS_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
          timeout: 30000,
        });

        if (!response.ok) {
          throw new Error(`Deepgram TTS error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        Logger.warn(`[StreamingTTS] TTS attempt ${attempt} failed: ${error.message}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const total = session.segments.length;
    const complete = session.segments.filter(s => s.status === 'complete').length;
    const failed = session.segments.filter(s => s.status === 'failed').length;
    const pending = session.segments.filter(s => s.status === 'pending' || s.status === 'processing').length;

    return {
      sessionId,
      total,
      complete,
      failed,
      pending,
      isComplete: pending === 0 && total > 0,
    };
  }

  /**
   * Wait for all segments to complete
   */
  async waitForCompletion(sessionId, timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = this.getSessionStatus(sessionId);
      if (!status) return null;
      
      if (status.isComplete) {
        return status;
      }
      
      await new Promise(r => setTimeout(r, 500));
    }

    Logger.warn(`[StreamingTTS] Timeout waiting for session ${sessionId}`);
    return this.getSessionStatus(sessionId);
  }

  /**
   * Concatenate all audio segments and save to file
   */
  async finalizeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      Logger.warn(`[StreamingTTS] No session found: ${sessionId}`);
      return null;
    }

    // Wait for any pending segments
    await this.waitForCompletion(sessionId);

    // Sort segments by index
    const sortedSegments = session.segments
      .filter(s => s.status === 'complete' && s.audioBuffer)
      .sort((a, b) => a.index - b.index);

    if (sortedSegments.length === 0) {
      Logger.warn(`[StreamingTTS] No complete segments for session ${sessionId}`);
      this.sessions.delete(sessionId);
      return null;
    }

    // Concatenate audio buffers
    const totalLength = sortedSegments.reduce((sum, s) => sum + s.audioBuffer.length, 0);
    const combinedBuffer = Buffer.concat(
      sortedSegments.map(s => s.audioBuffer),
      totalLength
    );

    // Save to file
    const filename = `streamed_audio_${sessionId}_${Date.now()}.mp3`;
    const outputPath = path.join(this.recordingsPath, filename);

    // Ensure directory exists
    if (!fs.existsSync(this.recordingsPath)) {
      fs.mkdirSync(this.recordingsPath, { recursive: true });
    }

    fs.writeFileSync(outputPath, combinedBuffer);
    Logger.info(`[StreamingTTS] Saved combined audio: ${outputPath} (${combinedBuffer.length} bytes)`);

    // Cleanup
    this.sessions.delete(sessionId);

    return {
      filename,
      path: outputPath,
      size: combinedBuffer.length,
      segmentCount: sortedSegments.length,
    };
  }

  /**
   * Get completed audio segments (for streaming to frontend)
   */
  getCompletedSegments(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.segments
      .filter(s => s.status === 'complete')
      .sort((a, b) => a.index - b.index);
  }
}

module.exports = new StreamingTTSService();
