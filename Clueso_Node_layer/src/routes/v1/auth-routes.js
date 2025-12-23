const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../middleware/auth-middleware');

/**
 * GET /api/v1/auth/me
 * Get current user information
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user information'
    });
  }
});

/**
 * POST /api/v1/auth/verify
 * Verify authentication token
 */
router.post('/verify', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token is valid',
      user: req.user
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify token'
    });
  }
});

module.exports = router;
