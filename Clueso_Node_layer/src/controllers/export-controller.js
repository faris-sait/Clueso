// controllers/export-controller.js
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { Logger } = require('../config');

const execAsync = promisify(exec);

/**
 * Merge video and audio files using FFmpeg
 */
exports.mergeVideoAudio = async (req, res) => {
  try {
    const { videoUrl, audioUrl, sessionId } = req.body;

    if (!videoUrl || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Video URL and Audio URL are required'
      });
    }

    Logger.info(`[Export] Merging video and audio for session: ${sessionId}`);

    // Create temp directory
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });

    const videoPath = path.join(tempDir, `${sessionId}_video.webm`);
    const audioPath = path.join(tempDir, `${sessionId}_audio.webm`);
    const outputPath = path.join(tempDir, `${sessionId}_merged.webm`);

    // Download video and audio files
    Logger.info('[Export] Downloading video and audio files...');
    const [videoResponse, audioResponse] = await Promise.all([
      fetch(videoUrl),
      fetch(audioUrl)
    ]);

    const [videoBuffer, audioBuffer] = await Promise.all([
      videoResponse.buffer(),
      audioResponse.buffer()
    ]);

    await Promise.all([
      fs.writeFile(videoPath, videoBuffer),
      fs.writeFile(audioPath, audioBuffer)
    ]);

    Logger.info('[Export] Files downloaded, merging with FFmpeg...');

    // Use full path to FFmpeg (Chocolatey installation)
    const ffmpegPath = 'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe';
    
    // Check if FFmpeg exists at the expected path
    try {
      await fs.access(ffmpegPath);
      Logger.info(`[Export] FFmpeg found at: ${ffmpegPath}`);
    } catch (error) {
      Logger.error('[Export] FFmpeg not found at expected path');
      // Cleanup
      await Promise.all([
        fs.unlink(videoPath).catch(() => {}),
        fs.unlink(audioPath).catch(() => {})
      ]);
      return res.status(500).json({
        success: false,
        error: 'FFmpeg not found. Please ensure FFmpeg is installed at C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
      });
    }

    // Merge using FFmpeg
    // Note: WebM only supports VP8/VP9 video and Vorbis/Opus audio
    // Since audio is MP3, we need to convert it to Opus for WebM
    const ffmpegCommand = `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a libopus -b:a 128k -shortest "${outputPath}"`;
    
    Logger.info(`[Export] Running command: ${ffmpegCommand}`);
    await execAsync(ffmpegCommand);

    Logger.info('[Export] Merge complete, sending file...');

    // Send the merged file
    res.download(outputPath, `recording_${sessionId}.webm`, async (err) => {
      // Cleanup temp files
      await Promise.all([
        fs.unlink(videoPath).catch(() => {}),
        fs.unlink(audioPath).catch(() => {}),
        fs.unlink(outputPath).catch(() => {})
      ]);

      if (err) {
        Logger.error('[Export] Error sending file:', err);
      } else {
        Logger.info('[Export] File sent successfully');
      }
    });

  } catch (error) {
    Logger.error('[Export] Merge failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to merge video and audio'
    });
  }
};
