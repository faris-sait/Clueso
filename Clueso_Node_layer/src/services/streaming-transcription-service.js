/**
 * Streaming Transcription Service
 * Uses Deepgram's live streaming API for real-time transcription
 * and triggers TTS generation for completed sentences
 */
const { createClient } = require('@deepgram/sdk');
const { Logger } = require('../config');

// Deepgram live transcription events
const LiveTranscriptionEvents = {
  Open: 'open',
  Transcript: 'Results',
  UtteranceEnd: 'UtteranceEnd',
  Error: 'error',
  Close: 'close',
};

class StreamingTranscriptionService {
  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY;
    this.client = this.apiKey ? createClient(this.apiKey) : null;
    this.sessions = new Map(); // sessionId -> session state
  }

  /**
   * Start a new streaming session
   */
  async startSession(sessionId, onSentenceComplete, onError) {
    if (!this.client) {
      Logger.error('[StreamingTranscription] Deepgram not configured');
      return null;
    }

    if (this.sessions.has(sessionId)) {
      Logger.warn(`[StreamingTranscription] Session ${sessionId} already exists`);
      return this.sessions.get(sessionId);
    }

    Logger.info(`[StreamingTranscription] Starting session: ${sessionId}`);

    const session = {
      sessionId,
      connection: null,
      buffer: '',
      sentences: [],
      wordTimings: [],
      isActive: true,
      onSentenceComplete,
      onError,
    };

    try {
      // Create live transcription connection
      const connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        punctuate: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        smart_format: true,
      });

      // Handle transcription events
      connection.on(LiveTranscriptionEvents.Open, () => {
        Logger.info(`[StreamingTranscription] Connection opened for session: ${sessionId}`);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        this._handleTranscript(session, data);
      });

      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        this._handleUtteranceEnd(session);
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        Logger.error(`[StreamingTranscription] Error for session ${sessionId}:`, error);
        if (session.onError) session.onError(error);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        Logger.info(`[StreamingTranscription] Connection closed for session: ${sessionId}`);
        session.isActive = false;
      });

      session.connection = connection;
      this.sessions.set(sessionId, session);

      return session;
    } catch (error) {
      Logger.error(`[StreamingTranscription] Failed to start session ${sessionId}:`, error);
      if (onError) onError(error);
      return null;
    }
  }

  /**
   * Send audio chunk to streaming session
   */
  sendAudioChunk(sessionId, audioBuffer) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.connection || !session.isActive) {
      Logger.warn(`[StreamingTranscription] No active session for ${sessionId}`);
      return false;
    }

    try {
      session.connection.send(audioBuffer);
      return true;
    } catch (error) {
      Logger.error(`[StreamingTranscription] Error sending chunk for ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * End streaming session and get final results
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      Logger.warn(`[StreamingTranscription] No session found for ${sessionId}`);
      return null;
    }

    Logger.info(`[StreamingTranscription] Ending session: ${sessionId}`);

    // Process any remaining buffer
    if (session.buffer.trim()) {
      this._processSentence(session, session.buffer.trim());
      session.buffer = '';
    }

    // Close connection
    if (session.connection) {
      try {
        session.connection.finish();
      } catch (e) {
        Logger.warn(`[StreamingTranscription] Error closing connection:`, e);
      }
    }

    session.isActive = false;

    const result = {
      sessionId,
      fullText: session.sentences.join(' '),
      sentences: session.sentences,
      wordTimings: session.wordTimings,
    };

    this.sessions.delete(sessionId);
    return result;
  }

  /**
   * Handle incoming transcript data
   */
  _handleTranscript(session, data) {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    const isFinal = data.is_final;
    const words = data.channel?.alternatives?.[0]?.words || [];

    if (isFinal) {
      // Add word timings
      words.forEach(word => {
        session.wordTimings.push({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
        });
      });

      // Add to buffer
      session.buffer += ' ' + transcript;

      // Check for complete sentences
      const sentences = this._extractCompleteSentences(session.buffer);
      if (sentences.extracted.length > 0) {
        sentences.extracted.forEach(sentence => {
          this._processSentence(session, sentence);
        });
        session.buffer = sentences.remaining;
      }
    }
  }

  /**
   * Handle utterance end (natural pause in speech)
   */
  _handleUtteranceEnd(session) {
    // Process buffer as a sentence on natural pause
    if (session.buffer.trim()) {
      this._processSentence(session, session.buffer.trim());
      session.buffer = '';
    }
  }

  /**
   * Extract complete sentences from buffer
   */
  _extractCompleteSentences(text) {
    const sentenceEnders = /([.!?])\s+/g;
    const parts = text.split(sentenceEnders);
    
    const extracted = [];
    let current = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (['.', '!', '?'].includes(parts[i])) {
        current += parts[i];
        if (current.trim()) {
          extracted.push(current.trim());
        }
        current = '';
      } else {
        current += parts[i];
      }
    }

    return {
      extracted,
      remaining: current.trim(),
    };
  }

  /**
   * Process a complete sentence
   */
  _processSentence(session, sentence) {
    if (!sentence.trim()) return;

    Logger.info(`[StreamingTranscription] Sentence complete: "${sentence.substring(0, 50)}..."`);
    session.sentences.push(sentence);

    // Trigger callback for TTS generation
    if (session.onSentenceComplete) {
      session.onSentenceComplete(sentence, session.sentences.length - 1);
    }
  }

  /**
   * Check if session exists and is active
   */
  isSessionActive(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.isActive || false;
  }
}

module.exports = new StreamingTranscriptionService();
