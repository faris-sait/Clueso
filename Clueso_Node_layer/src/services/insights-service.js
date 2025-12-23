/**
 * AI Insights Service
 * Generates summaries from recording transcripts using NVIDIA AI
 */
const { Logger } = require('../config');
const { getSupabaseClient } = require('./supabase-service');

// NVIDIA AI configuration (OpenAI-compatible API)
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = 'qwen/qwen3-next-80b-a3b-instruct';

/**
 * Get NVIDIA API key (read at runtime to ensure dotenv is loaded)
 */
const getNvidiaApiKey = () => {
  const key = process.env.NVIDIA_API_KEY;
  Logger.info(`[Insights] NVIDIA_API_KEY check: ${key ? 'Found (length: ' + key.length + ')' : 'NOT FOUND'}`);
  return key;
};

/**
 * Generate AI summary from transcript text
 * @param {string} transcript - The recording transcript
 * @returns {Promise<string>} Summary text
 */
const generateSummary = async (transcript) => {
  if (!transcript || transcript.trim().length < 10) {
    throw new Error('Transcript is too short to summarize');
  }

  const apiKey = getNvidiaApiKey();

  // If no API key, use mock response for demo
  if (!apiKey) {
    Logger.warn('[Insights] No NVIDIA_API_KEY configured, using mock summary');
    return generateMockSummary(transcript);
  }

  Logger.info('[Insights] Using NVIDIA AI for summary generation');

  try {
    const prompt = `Analyze this recording transcript and provide:

1. A concise summary (3-5 bullet points) of the main content
2. Key observations about the recording (clarity, structure, notable moments)

Transcript:
"""
${transcript.substring(0, 4000)}
"""

Format your response as:
## Summary
- [bullet point 1]
- [bullet point 2]
- [bullet point 3]

## Key Observations
- [observation 1]
- [observation 2]`;

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes recording transcripts and provides concise summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error(`[Insights] NVIDIA API error: ${response.status} - ${errorText}`);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content;

    if (!summaryText) {
      throw new Error('No summary generated from AI');
    }

    Logger.info('[Insights] Summary generated successfully');
    return summaryText;
  } catch (err) {
    Logger.error(`[Insights] AI generation failed: ${err.message}`);
    throw err;
  }
};

/**
 * Generate mock summary for demo/testing
 */
const generateMockSummary = (transcript) => {
  const wordCount = transcript.split(/\s+/).length;
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  return `## Summary
- Recording contains approximately ${wordCount} words across ${sentences.length} sentences
- The speaker discusses the main topic with clear articulation
- Key points are presented in a logical sequence
- The recording covers the intended subject matter

## Key Observations
- Audio quality appears suitable for transcription
- Speech patterns are consistent throughout
- Consider adding visual cues for complex explanations`;
};

/**
 * Get existing insight for a recording by session_id
 */
const getInsight = async (sessionId) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('recording_insights')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found
    Logger.error(`[Insights] Error fetching insight: ${error.message}`);
    return null;
  }

  return data;
};

/**
 * Save insight to database
 */
const saveInsight = async (sessionId, summaryText) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.warn('[Insights] Supabase not configured, cannot save insight');
    return null;
  }

  const { data, error } = await client
    .from('recording_insights')
    .upsert(
      {
        session_id: sessionId,
        summary_text: summaryText,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single();

  if (error) {
    Logger.error(`[Insights] Error saving insight: ${error.message}`);
    throw error;
  }

  Logger.info(`[Insights] Insight saved for session: ${sessionId}`);
  return data;
};

/**
 * Get transcript for a recording from metadata
 */
const getTranscriptForRecording = async (recordingId) => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('recordings').select('metadata').eq('id', recordingId).single();

  if (error) {
    Logger.error(`[Insights] Error fetching recording: ${error.message}`);
    return null;
  }

  // Transcript might be stored in metadata or we need to fetch from elsewhere
  return data?.metadata?.transcript || null;
};

module.exports = {
  generateSummary,
  getInsight,
  saveInsight,
  getTranscriptForRecording,
};
