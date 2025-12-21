const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateUser } = require('../../middleware/auth-middleware');
const supabaseService = require('../../services/supabase-service');

const recordingsDir = path.join(__dirname, '..', '..', 'recordings');

/**
 * GET /api/v1/users/profile
 * Get user profile with recording history
 */
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    // Here you would fetch user's recording history from database
    // For now, returning basic user info
    res.json({
      success: true,
      user: {
        ...req.user,
        recordings: [], // Add recording history from DB
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

/**
 * PUT /api/v1/users/profile
 * Update user profile
 */
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    // Here you would update user preferences in database
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: req.user
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

/**
 * GET /api/v1/users/recordings
 * Get user's recording history with signed URLs for playback
 */
router.get('/recordings', authenticateUser, async (req, res) => {
  try {
    // First try to get recordings from Supabase (with signed URLs)
    if (req.user && req.user.id) {
      const supabaseRecordings = await supabaseService.getUserRecordingsWithUrls(req.user.id);
      
      if (supabaseRecordings && supabaseRecordings.length > 0) {
        const recordings = supabaseRecordings.map(r => ({
          id: r.id,
          sessionId: r.session_id,
          title: r.title,
          url: r.url || 'Unknown URL',
          startTime: r.metadata?.startTime,
          endTime: r.metadata?.endTime,
          processedAt: r.created_at,
          eventsCount: r.events_count || 0,
          hasVideo: !!r.video_path,
          hasAudio: !!r.audio_path,
          videoUrl: r.videoUrl,  // Signed URL for video playback
          audioUrl: r.audioUrl,  // Signed URL for audio playback
          thumbnail: null,
        }));

        return res.json({
          success: true,
          recordings,
          total: recordings.length,
          source: 'supabase'
        });
      }
    }

    // Fallback: Read recordings from the local recordings directory
    const recordings = [];
    
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      
      // Get JSON recording files
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(recordingsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          
          recordings.push({
            id: data.sessionId,
            sessionId: data.sessionId,
            title: `Recording ${data.sessionId.split('_').pop()}`,
            url: data.url || 'Unknown URL',
            startTime: data.startTime,
            endTime: data.endTime,
            processedAt: data.processedAt,
            eventsCount: data.events?.length || 0,
            hasVideo: !!data.videoPath,
            hasAudio: !!data.audioPath,
            videoUrl: null,  // Local files don't have signed URLs
            audioUrl: null,
            thumbnail: null,
          });
        } catch (parseErr) {
          console.error(`Error parsing ${file}:`, parseErr.message);
        }
      }
      
      // Sort by processedAt descending (newest first)
      recordings.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));
    }
    
    res.json({
      success: true,
      recordings,
      total: recordings.length,
      source: 'local'
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recordings'
    });
  }
});

/**
 * GET /api/v1/users/stats
 * Get user's dashboard statistics
 */
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    let totalRecordings = 0;
    let totalEvents = 0;
    let recentActivity = [];
    
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      totalRecordings = jsonFiles.length;
      
      // Calculate total events and recent activity
      for (const file of jsonFiles.slice(0, 5)) {
        try {
          const filePath = path.join(recordingsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          totalEvents += data.events?.length || 0;
          
          recentActivity.push({
            sessionId: data.sessionId,
            processedAt: data.processedAt,
            url: data.url
          });
        } catch (e) {
          // Skip invalid files
        }
      }
    }
    
    res.json({
      success: true,
      stats: {
        totalRecordings,
        totalEvents,
        totalVideos: totalRecordings,
        storageUsed: '0 MB', // Could calculate actual size
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

module.exports = router;
