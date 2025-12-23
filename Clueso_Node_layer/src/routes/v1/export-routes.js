// routes/export-routes.js
const express = require('express');
const router = express.Router();
const exportController = require('../../controllers/export-controller');

// Merge video and audio files
router.post('/merge', exportController.mergeVideoAudio);

module.exports = router;
