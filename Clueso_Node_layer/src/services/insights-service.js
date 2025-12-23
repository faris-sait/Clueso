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
 * @returns {Promise<Object>} Structured insights object
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
    const prompt = `Analyze this recording transcript and provide structured insights in JSON format.

Transcript:
"""
${transcript.substring(0, 4000)}
"""

Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "summary": "A brief 2-3 sentence overview of the recording",
  "key_points": ["point 1", "point 2", "point 3"],
  "action_items": ["action 1", "action 2"],
  "sentiment": "positive|neutral|negative",
  "topics": ["topic1", "topic2", "topic3"]
}`;

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
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No summary generated from AI');
    }

    // Parse the JSON response from AI
    try {
      const structuredInsights = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      Logger.info('[Insights] Structured insights generated successfully');
      return structuredInsights;
    } catch (parseError) {
      Logger.warn('[Insights] Failed to parse AI response as JSON, using as plain text');
      // Fallback to plain text if parsing fails
      return {
        summary: aiResponse,
        key_points: [],
        action_items: [],
        sentiment: 'neutral',
        topics: []
      };
    }
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

  return {
    summary: `Recording contains approximately ${wordCount} words across ${sentences.length} sentences. The speaker discusses the main topic with clear articulation. Key points are presented in a logical sequence.`,
    key_points: [
      'Audio quality appears suitable for transcription',
      'Speech patterns are consistent throughout',
      'Recording covers the intended subject matter'
    ],
    action_items: [
      'Review transcript for accuracy',
      'Consider adding visual cues for complex explanations'
    ],
    sentiment: 'neutral',
    topics: ['recording', 'transcription', 'analysis']
  };
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
 * Save insight to database with structured data
 * @param {string} sessionId - Recording session ID
 * @param {string} recordingId - Recording UUID
 * @param {Object} insights - Structured insights object
 */
const saveInsight = async (sessionId, recordingId, insights) => {
  const client = getSupabaseClient();
  if (!client) {
    Logger.warn('[Insights] Supabase not configured, cannot save insight');
    return null;
  }

  // Support both structured and legacy plain text format
  const insightData = {
    session_id: sessionId,
    recording_id: recordingId,
    summary: insights.summary || insights,
    key_points: insights.key_points || [],
    action_items: insights.action_items || [],
    sentiment: insights.sentiment || 'neutral',
    topics: insights.topics || [],
    summary_text: typeof insights === 'string' ? insights : insights.summary, // Legacy field
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('recording_insights')
    .upsert(insightData, { onConflict: 'session_id' })
    .select()
    .single();

  if (error) {
    Logger.error(`[Insights] Error saving insight: ${error.message}`);
    throw error;
  }

  Logger.info(`[Insights] Structured insight saved for session: ${sessionId}`);
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
