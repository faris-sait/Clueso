/**
 * Insights API Routes
 * POST /api/v1/insights/:sessionId - Generate summary
 * GET /api/v1/insights/:sessionId - Get existing summary
 */
const express = require('express');
const router = express.Router();
const { Logger } = require('../../config');
const insightsService = require('../../services/insights-service');
const { optionalAuth } = require('../../middleware/auth-middleware');

/**
 * GET /api/v1/insights/:sessionId
 * Get existing insight for a recording
 */
router.get('/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    Logger.info(`[Insights API] GET insight for session: ${sessionId}`);

    const insight = await insightsService.getInsight(sessionId);

    if (!insight) {
      return res.status(404).json({ 
        error: 'No insight found',
        message: 'Generate a summary first using POST request'
      });
    }

    return res.json({
      success: true,
      insight: {
        id: insight.id,
        sessionId: insight.session_id,
        recordingId: insight.recording_id,
        summary: insight.summary,
        keyPoints: insight.key_points || [],
        actionItems: insight.action_items || [],
        sentiment: insight.sentiment || 'neutral',
        topics: insight.topics || [],
        summaryText: insight.summary_text, // Legacy field
        createdAt: insight.created_at,
      }
    });
  } catch (err) {
    Logger.error(`[Insights API] GET error: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch insight' });
  }
});

/**
 * POST /api/v1/insights/:sessionId
 * Generate and save AI summary for a recording
 */
router.post('/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { transcript } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    Logger.info(`[Insights API] POST generate insight for session: ${sessionId}`);

    // Check if insight already exists
    const existingInsight = await insightsService.getInsight(sessionId);
    if (existingInsight) {
      Logger.info(`[Insights API] Returning existing insight for: ${sessionId}`);
      return res.json({
        success: true,
        cached: true,
        insight: {
          id: existingInsight.id,
          sessionId: existingInsight.session_id,
          summaryText: existingInsight.summary_text,
          createdAt: existingInsight.created_at,
        }
      });
    }

    // Get transcript from request body
    if (!transcript) {
      return res.status(400).json({ 
        error: 'No transcript available',
        message: 'Please provide transcript in request body'
      });
    }

    // Generate AI summary
    const summaryText = await insightsService.generateSummary(transcript);

    // Save to database
    const savedInsight = await insightsService.saveInsight(sessionId, summaryText);

    return res.json({
      success: true,
      cached: false,
      insight: {
        id: savedInsight?.id,
        sessionId: sessionId,
        summaryText: summaryText,
        createdAt: savedInsight?.created_at || new Date().toISOString(),
      }
    });
  } catch (err) {
    Logger.error(`[Insights API] POST error: ${err.message}`);
    
    if (err.message.includes('too short')) {
      return res.status(400).json({ error: err.message });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate summary',
      message: 'AI service temporarily unavailable. Please try again later.'
    });
  }
});

module.exports = router;
