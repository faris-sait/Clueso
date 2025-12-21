const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../middleware/auth-middleware');
const { 
  getUserByClerkId, 
  createFeedback, 
  getRecordingFeedback,
  getRecordingBySessionId 
} = require('../../services/supabase-service');
const { Logger } = require('../../config');

/**
 * POST /api/v1/feedback
 * Create feedback for a recording
 * Body: { recordingId: string (session_id), message: string }
 */
router.post('/', authenticateUser, async (req, res) => {
  console.log('[Feedback] POST handler entered');
  console.log('[Feedback] req.body:', JSON.stringify(req.body));
  console.log('[Feedback] req.user:', JSON.stringify(req.user));
  
  try {
    const { recordingId, message } = req.body || {};
    const clerkId = req.user?.id;

    console.log(`[Feedback] Extracted - recordingId: ${recordingId}, message: ${message}, clerkId: ${clerkId}`);
    Logger.info(`[Feedback] POST request - recordingId: ${recordingId}, clerkId: ${clerkId}`);

    // Validate input
    if (!recordingId || !message) {
      Logger.warn(`[Feedback] Missing required fields - recordingId: ${recordingId}, message: ${!!message}`);
      return res.status(400).json({
        success: false,
        error: 'recordingId and message are required'
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty'
      });
    }

    // Get user from Supabase
    Logger.info(`[Feedback] Looking up user by clerkId: ${clerkId}`);
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      Logger.warn(`[Feedback] User not found for clerkId: ${clerkId}`);
      return res.status(404).json({
        success: false,
        error: 'User not found in database. Please refresh the page.'
      });
    }
    Logger.info(`[Feedback] Found user: ${user.id}`);

    // Get recording by session_id
    Logger.info(`[Feedback] Looking up recording by sessionId: ${recordingId}`);
    const recording = await getRecordingBySessionId(recordingId);
    if (!recording) {
      Logger.warn(`[Feedback] Recording not found for sessionId: ${recordingId}`);
      return res.status(404).json({
        success: false,
        error: 'Recording not found in database'
      });
    }
    Logger.info(`[Feedback] Found recording: ${recording.id}`);

    // Create feedback
    Logger.info(`[Feedback] Creating feedback - userId: ${user.id}, recordingId: ${recording.id}`);
    const feedback = await createFeedback(user.id, recording.id, message.trim());
    if (!feedback) {
      Logger.error(`[Feedback] createFeedback returned null`);
      return res.status(500).json({
        success: false,
        error: 'Failed to create feedback'
      });
    }

    Logger.info(`[Feedback] Created feedback ${feedback.id} for recording ${recordingId} by user ${clerkId}`);

    res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    Logger.error('[Feedback] Error creating feedback:', error.message);
    Logger.error('[Feedback] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/feedback/:recordingId
 * Get all feedback for a recording (by session_id)
 */
router.get('/:recordingId', authenticateUser, async (req, res) => {
  try {
    const { recordingId } = req.params;

    // Get recording by session_id
    const recording = await getRecordingBySessionId(recordingId);
    if (!recording) {
      // Recording not in database yet - return empty feedback array
      // This is not an error, just means no feedback exists yet
      Logger.info(`[Feedback] Recording ${recordingId} not found in database, returning empty feedback`);
      return res.json({
        success: true,
        data: []
      });
    }

    // Get feedback
    const feedback = await getRecordingFeedback(recording.id);

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    Logger.error('[Feedback] Error fetching feedback:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
