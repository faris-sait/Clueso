const { createClient } = require('@deepgram/sdk');
const fs = require('fs');
const { Logger } = require('../config');

class DeepgramService {
  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      Logger.warn('[Deepgram] API key missing');
      this.client = null;
      return;
    }

    Logger.info('[Deepgram] Client initialized');
    this.client = createClient(apiKey);
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Sleep helper for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Transcribe from file path with retry logic
   */
  async transcribeFile(audioPath, userOptions = {}) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.client) throw new Error('Deepgram not configured');

        if (!fs.existsSync(audioPath)) {
          Logger.error(`[Deepgram] File missing: ${audioPath}`);
          throw new Error(`File not found: ${audioPath}`);
        }

        Logger.info(`[Deepgram] Transcribing file (attempt ${attempt}/${this.maxRetries}): ${audioPath}`);

        // Read file as buffer instead of stream for better reliability
        const audioBuffer = fs.readFileSync(audioPath);
        const options = this._buildOptions(audioPath, userOptions);

        Logger.info(`[Deepgram] File size: ${audioBuffer.length} bytes`);

        const { result, error } = await this.client.listen.prerecorded.transcribeFile(audioBuffer, options);

        if (error) throw error;

        Logger.info('[Deepgram] File transcription complete');

        return this._formatResult(result);
      } catch (err) {
        lastError = err;
        Logger.error(`[Deepgram] Transcription attempt ${attempt} failed:`, err.message);
        
        // Don't retry for non-recoverable errors
        if (err.message.includes('File not found') || err.message.includes('not configured')) {
          throw err;
        }
        
        if (attempt < this.maxRetries) {
          Logger.info(`[Deepgram] Retrying in ${this.retryDelay}ms...`);
          await this._sleep(this.retryDelay);
        }
      }
    }
    
    Logger.error('[Deepgram] All transcription attempts failed');
    throw lastError;
  }

  /**
   * Transcribe from Buffer
   */
  async transcribeBuffer(audioBuffer, userOptions = {}) {
    try {
      if (!this.client) throw new Error('Deepgram not configured');

      if (!Buffer.isBuffer(audioBuffer)) {
        Logger.error('[Deepgram] Passed buffer is not a Buffer');
        throw new Error('audioBuffer must be a Buffer');
      }

      Logger.info(`[Deepgram] Transcribing buffer (${audioBuffer.length} bytes)`);

      const options = this._buildOptions(null, userOptions);

      const { result, error } = await this.client.listen.prerecorded.transcribeFile(audioBuffer, options);

      if (error) throw error;

      Logger.info('[Deepgram] Buffer transcription complete');

      return this._formatResult(result);
    } catch (err) {
      Logger.error('[Deepgram] Buffer transcription failed:', err);
      throw err;
    }
  }

  /**
   * Deepgram request options
   */
  _buildOptions(audioPath, userOptions) {
    Logger.info('[Deepgram] Building transcription options');

    return {
      model: 'nova-2',
      language: 'en-US',
      punctuate: true,
      diarize: false,
      utterances: true,
      utterance_silence: 100,
      filler_words: true,
      mimetype: audioPath ? this._detectMimeType(audioPath) : 'audio/webm',

      ...userOptions,
    };
  }

  /**
   * Build clean result object
   */
  _formatResult(result) {
    Logger.info('[Deepgram] Formatting result');

    const utterances = result?.results?.utterances || [];

    const timeline = utterances.map(u => ({
      start: u.start,
      end: u.end,
      text: u.transcript.trim() || '—',
      type: u.transcript.trim() ? 'speech' : 'silence',
    }));

    const text = timeline.map(t => t.text).join(' ');

    Logger.info('[Deepgram] Final timeline built with', timeline.length, 'segments');

    return {
      text,          // main readable transcript
      timeline,      // KEY timeline with silence
      metadata: result.metadata,
      raw: result
    };
  }

  /**
   * Infer mimetype
   */
  _detectMimeType(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    const map = {
      webm: 'audio/webm',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/m4a',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      mp4: 'audio/mp4',
    };
    return map[ext] || 'audio/webm';
  }
}

module.exports = new DeepgramService();
