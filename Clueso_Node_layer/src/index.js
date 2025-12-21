const express = require('express');
const http = require('http');
const cors = require('cors'); // Import the cors middleware

const { ServerConfig, Logger } = require('./config');
const apiRoutes = require('./routes');
const recordingRoutes = require('./routes/v1/recording-routes');
const pythonRoutes = require('./routes/v1/python-routes'); // Add python routes
const authRoutes = require('./routes/v1/auth-routes'); // Add auth routes
const userRoutes = require('./routes/v1/user-routes'); // Add user routes
const { FrontendService } = require('./services');

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO for frontend communication
FrontendService.initialize(httpServer);

// Enable CORS for all routes and origins (you can configure this further)
app.use(cors());

const path = require('path');

// Static file options with proper MIME types
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp3')) {
            res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.webm')) {
            // Check if it's likely audio or video based on filename
            if (filePath.includes('audio')) {
                res.setHeader('Content-Type', 'audio/webm');
            } else {
                res.setHeader('Content-Type', 'video/webm');
            }
        }
    }
};

// Serve static files from uploads directory (for audio files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));

// Serve static files from recordings directory (for processed audio from Python)
// This serves from root /recordings folder where Python saves processed audio
app.use('/recordings', express.static(path.join(__dirname, '..', 'recordings'), staticOptions));

// Also serve from src/recordings for raw video/audio files
app.use('/recordings', express.static(path.join(__dirname, 'recordings'), staticOptions));

// Log static file requests for debugging
app.use('/recordings', (req, res, next) => {
    Logger.info(`[Static] Request for: /recordings${req.path}`);
    next();
});

// IMPORTANT: Recording routes MUST come BEFORE global body parsers
// to prevent corruption of binary chunk data
app.use('/api/recording', recordingRoutes);

// Python AI processing routes
app.use('/api/python', pythonRoutes);

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// User routes
app.use('/api/v1/users', userRoutes);

// Normal JSON and URL encoded parsers for other APIs
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// All other API routes
app.use('/api', apiRoutes);

httpServer.listen(ServerConfig.PORT, () => {
    console.log(`Successfully started server on PORT ${ServerConfig.PORT}`);
    Logger.info("Server started");
    Logger.info("Socket.IO server ready for frontend connections");
});