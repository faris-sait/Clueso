# Clueso - AI-Powered Product Demo Recording Platform

> Transform screen recordings into professional product demos with AI-powered narration and insights

Clueso is a comprehensive platform that captures user interactions, generates AI-enhanced narration, and provides intelligent insights for product demonstrations. Built with a modern tech stack spanning browser extensions, Node.js backend, Python AI services, and Next.js frontend.

---

## 📚 Documentation

> **For detailed documentation, please refer to:**
> - **User Documentation**: `documentations/CLUESOUSERDOCUMENTATIONf.pdf` - Complete user guide and feature walkthrough
> - **Technical Documentation**: Additional technical guides available in the `documentations/` folder

---

## 🎯 Core Features

### 1. User Onboarding & Authentication
- **Clerk Authentication**: Seamless sign-up/sign-in flows with session management
- **Supabase User Sync**: Automatic user profile synchronization via webhooks
- **Protected Routes**: Middleware-based authentication for secure access
- **Multi-tenant Support**: User-specific data isolation with Row Level Security (RLS)

### 2. Dashboard Experience
- **Modern UI**: Built with Next.js 16, React 19, and Tailwind CSS
- **Navigation**: Intuitive sidebar with Projects, Insights, Trash, and Settings
- **Recording Management**: View, organize, and manage all recordings
- **Folder Organization**: Group recordings into projects/folders
- **Soft Delete**: Trash system with recovery options
- **Real-time Updates**: Live status updates via WebSocket connections

### 3. Browser Extension - Screen Recording
- **Chrome Extension**: Capture screen, audio, and user interactions
- **DOM Event Tracking**: Records clicks, scrolls, inputs, and navigation
- **Screen + Audio Capture**: High-quality video and microphone recording
- **Session Management**: Unique session IDs for tracking recordings
- **Background Processing**: Service worker architecture for reliability
- **Offscreen Document**: Handles media capture without popup interference
- **Event Buffering**: Ensures no data loss during recording

### 4. Real-time Recording Processing
- **WebSocket Communication**: Bi-directional real-time data streaming
- **Session Registration**: Connect frontend to specific recording sessions
- **Live Event Streaming**: Receive DOM events as they happen
- **Video/Audio Streaming**: Progressive loading of media files
- **Instruction Timeline**: Real-time display of user actions
- **Buffered Delivery**: Queue system for offline/delayed connections

### 5. AI-Powered Script Generation
- **RAG-based Processing**: Combines transcript, timing, and DOM events
- **Gemini AI Integration**: Uses Google's Gemini 2.5 Flash for script generation
- **Context-Aware**: Understands UI elements and user actions
- **Filler Word Removal**: Cleans "um", "uh", "like" from transcripts
- **Natural Pacing**: Syncs with timing gaps for professional delivery
- **Production-Ready Output**: Single-paragraph polished narration

### 6. Speech-to-Text Transcription
- **Deepgram Integration**: Real-time audio transcription
- **Word-Level Timing**: Precise timestamps for each word
- **Confidence Scoring**: Quality metrics for transcription accuracy
- **Gap Detection**: Identifies pauses and speaking patterns
- **Multi-format Support**: Handles various audio formats

### 7. Text-to-Speech Generation
- **Deepgram TTS**: High-quality voice synthesis
- **Aura 2 Voice Model**: Natural-sounding narration
- **Chunking Support**: Handles long scripts (>1500 chars)
- **Retry Logic**: Robust error handling with exponential backoff
- **Connection Pooling**: Optimized API performance
- **Timeout Management**: Fast failure detection

### 8. Recording Insights & Analytics
- **AI Summaries**: Automatic generation of recording insights using NVIDIA Qwen AI
- **NVIDIA NIM Integration**: Powered by Qwen3-Next-80B model via NVIDIA API
- **Timeline Analysis**: Breakdown of user actions and timing
- **UI Element Extraction**: Identifies buttons, inputs, and interactions
- **Speaking Rate Analysis**: Words per second metrics
- **Confidence Tracking**: Low-confidence word detection
- **Session Metadata**: URL, viewport, duration tracking
- **Intelligent Analysis**: Concise summaries with key observations

### 9. Feedback Collection System
- **User Feedback**: Collect comments on recordings
- **Recording Association**: Link feedback to specific sessions
- **Timestamp Support**: Contextual feedback at specific moments
- **Database Storage**: Persistent feedback in Supabase
- **User Attribution**: Track feedback by user

### 10. Data Management & Export
- **Supabase Database**: PostgreSQL with RLS policies
- **File Storage**: Organized video/audio file management
- **Export Functionality**: Download recordings and transcripts
- **Soft Delete**: Recoverable deletion with trash system
- **Folder Organization**: Project-based file structure
- **Metadata Storage**: JSONB fields for flexible data

### 11. System Communication & Integration
- **REST API**: Express.js backend with versioned routes
- **WebSocket Server**: Socket.IO for real-time communication
- **Python Microservice**: FastAPI for AI processing
- **CORS Configuration**: Secure cross-origin requests
- **Webhook Handlers**: Clerk user sync automation
- **Service Integration**: Node.js ↔ Python communication

### 12. Frontend Components & UI
- **Synced Video Player**: Timeline-synchronized playback
- **Transcript Panel**: Interactive transcript with timestamps
- **Recording Feedback**: In-app feedback collection
- **Export Button**: One-click download functionality
- **AI Summary Display**: Formatted insights presentation
- **Radial Orbital Timeline**: Visual event timeline
- **Auth Guard**: Protected route components
- **User Button**: Profile management dropdown

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Popup UI   │  │  Background  │  │   Content    │      │
│  │   (React)    │  │   Service    │  │   Script     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Express    │  │   Socket.IO  │  │   Multer     │      │
│  │   REST API   │  │   WebSocket  │  │   Upload     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Python AI Service      │  │   Next.js Frontend       │
│  ┌──────────────┐        │  │  ┌──────────────┐       │
│  │   FastAPI    │        │  │  │   React 19   │       │
│  │   Gemini AI  │        │  │  │   Tailwind   │       │
│  │   Deepgram   │        │  │  │   Socket.IO  │       │
│  └──────────────┘        │  │  └──────────────┘       │
└──────────────────────────┘  └──────────────────────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
                ┌──────────────────────────┐
                │   Supabase Database      │
                │  ┌──────────────┐        │
                │  │  PostgreSQL  │        │
                │  │  Storage     │        │
                │  │  Auth Sync   │        │
                │  └──────────────┘        │
                └──────────────────────────┘
```

---

## 📁 Project Structure

```
clueso/
├── browserext/Clueso_extension/     # Chrome Extension
│   ├── public/
│   │   ├── background.js            # Service worker
│   │   ├── content-script.js        # DOM event capture
│   │   ├── offscreen.html           # Media capture
│   │   └── popup.js                 # Extension UI
│   └── src/popup/Popup.jsx          # React popup component
│
├── Clueso_Node_layer/               # Backend Server
│   ├── src/
│   │   ├── config/                  # Server configuration
│   │   ├── controllers/             # Request handlers
│   │   │   ├── recording-controller.js
│   │   │   ├── frontend-controller.js
│   │   │   ├── export-controller.js
│   │   │   └── python-controller.js
│   │   ├── services/                # Business logic
│   │   │   ├── recording-service.js
│   │   │   ├── frontend-service.js
│   │   │   ├── deepgram-service.js
│   │   │   ├── supabase-service.js
│   │   │   └── python-service.js
│   │   ├── routes/v1/               # API routes
│   │   │   ├── recording-routes.js
│   │   │   ├── feedback-routes.js
│   │   │   ├── user-routes.js
│   │   │   └── auth-routes.js
│   │   ├── middleware/              # Auth & validation
│   │   └── index.js                 # Server entry point
│   ├── recordings/                  # Uploaded files
│   └── uploads/                     # Temp uploads
│
├── ProductAI/                       # Python AI Service
│   └── app/
│       ├── main.py                  # FastAPI server
│       ├── services/
│       │   ├── script_generation_service.py  # RAG script gen
│       │   ├── elevenlabs_service.py         # TTS
│       │   ├── gemini_service.py             # AI text gen
│       │   ├── rag_service.py                # Context building
│       │   └── dom_event_service.py          # Event processing
│       └── models/                  # Pydantic models
│
└── Clueso_Frontend_layer/           # Next.js Frontend
    ├── app/
    │   ├── page.tsx                 # Home page
    │   ├── landing/page.tsx         # Landing page
    │   ├── dashboard/               # Dashboard routes
    │   │   ├── page.tsx             # Main dashboard
    │   │   ├── projects/page.tsx    # Projects view
    │   │   ├── insights/page.tsx    # Insights view
    │   │   ├── trash/page.tsx       # Trash view
    │   │   └── settings/page.tsx    # Settings
    │   ├── sign-in/                 # Auth pages
    │   ├── sign-up/
    │   └── api/                     # API routes
    │       ├── webhooks/clerk/      # Clerk webhooks
    │       ├── user/sync/           # User sync
    │       └── extension/auth/      # Extension auth
    ├── components/
    │   ├── dashboard/Dashboard.tsx
    │   ├── SyncedVideoPlayer.tsx
    │   ├── TranscriptPanel.tsx
    │   ├── RecordingFeedback.tsx
    │   ├── AISummary.tsx
    │   ├── ExportButton.tsx
    │   ├── AuthGuard.tsx
    │   └── ui/                      # UI components
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useWebSocketConnection.ts
    ├── lib/
    │   ├── api.ts                   # API client
    │   ├── supabase.ts              # Supabase client
    │   └── utils.ts                 # Utilities
    └── migrations/                  # Database migrations
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Chrome browser (for extension)
- Clerk account (authentication)
- Supabase account (database)
- Deepgram API key (transcription/TTS)
- Google Gemini API key (AI script generation)
- NVIDIA API key (AI insights generation)

### Installation

#### 1. Clone Repository

```bash
git clone <repository-url>
cd clueso
```

#### 2. Setup Node.js Backend

```bash
cd Clueso_Node_layer
npm install

# Create .env file
cat > .env << EOF
PORT=3000
DEEPGRAM_API_KEY=your_deepgram_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
CLERK_SECRET_KEY=your_clerk_secret_key
PYTHON_SERVICE_URL=http://localhost:8000
NVIDIA_API_KEY=your_nvidia_api_key
EOF

# Start server
npm run dev
```

#### 3. Setup Python AI Service

```bash
cd ProductAI
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Create .env file
cat > .env << EOF
GEMINI_API_KEY=your_gemini_key
DEEPGRAM_API_KEY=your_deepgram_key
NODE_SERVER_URL=http://localhost:3000
EOF

# Start service
uvicorn app.main:app --reload --port 8000
```

#### 4. Setup Next.js Frontend

```bash
cd Clueso_Frontend_layer
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CLERK_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_NODE_SERVER_URL=http://localhost:3000
EOF

# Start frontend
npm run dev
```

#### 5. Setup Browser Extension

```bash
cd browserext/Clueso_extension
npm install
npm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the browserext/Clueso_extension directory
```

#### 6. Setup Supabase Database

1. Create a new Supabase project
2. Run the schema in SQL Editor:

```bash
# Copy schema to Supabase SQL Editor
cat Clueso_Frontend_layer/supabase-schema.sql
```

3. Run migrations:

```bash
cat Clueso_Frontend_layer/migrations/add_soft_delete.sql
cat Clueso_Frontend_layer/migrations/add_folders.sql
cat Clueso_Frontend_layer/migrations/add_recording_insights.sql
```

---

## 📖 Usage Guide

### Recording a Demo

1. **Install Extension**: Load the Chrome extension
2. **Sign In**: Authenticate via the extension popup
3. **Start Recording**: Click "Start Recording" button
4. **Perform Actions**: Navigate and interact with your product
5. **Stop Recording**: Click "Stop Recording" button
6. **Processing**: Wait for AI processing to complete
7. **View Results**: Open dashboard to see recording with AI narration

### Viewing Recordings

1. Navigate to `/dashboard`
2. Browse recordings in the main view
3. Click a recording to view details
4. Play synced video with AI-generated audio
5. View transcript with timestamps
6. See AI-generated insights

### Managing Recordings

- **Organize**: Move recordings into folders/projects
- **Delete**: Soft delete to trash (recoverable)
- **Export**: Download video, audio, and transcript
- **Share**: Generate shareable links (coming soon)
- **Feedback**: Add comments and notes

---

## 🔧 Configuration

### Environment Variables

#### Node.js Backend (.env)
```env
PORT=3000
DEEPGRAM_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
CLERK_SECRET_KEY=your_key
PYTHON_SERVICE_URL=http://localhost:8000
NVIDIA_API_KEY=your_key
```

#### Python Service (.env)
```env
GEMINI_API_KEY=your_key
DEEPGRAM_API_KEY=your_key
NODE_SERVER_URL=http://localhost:3000
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
CLERK_WEBHOOK_SECRET=your_secret
NEXT_PUBLIC_NODE_SERVER_URL=http://localhost:3000
```

---

## 🧪 Testing

### Test Demo Endpoint

```bash
# Send test data to frontend
curl http://localhost:3000/api/v1/frontend/demo-data

# Or use the test script
cd Clueso_Node_layer
node test-send-to-frontend.js
```

### Frontend Testing

See `Clueso_Node_layer/FRONTEND_TESTING_GUIDE.md` for detailed testing instructions.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.IO Client
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Real-time**: Socket.IO
- **File Upload**: Multer
- **Authentication**: Clerk SDK
- **Database**: Supabase JS Client
- **Transcription**: Deepgram SDK
- **Logging**: Winston

### AI Service
- **Framework**: FastAPI
- **AI Models**: 
  - Google Gemini 2.5 Flash (Script Generation)
  - NVIDIA Qwen3-Next-80B (Insights Generation)
- **TTS**: Deepgram Aura 2
- **STT**: Deepgram Nova 2
- **HTTP Client**: Requests with retry logic

### Browser Extension
- **Manifest**: V3
- **UI**: React (Popup)
- **Architecture**: Service Worker + Offscreen Document
- **APIs**: Chrome Extensions API, MediaRecorder

### Database
- **Provider**: Supabase
- **Engine**: PostgreSQL 15
- **Features**: RLS, JSONB, Triggers, Functions
- **Storage**: Supabase Storage (optional)

---

## 📊 API Documentation

### REST Endpoints

#### Recording Routes
- `POST /api/v1/recording/process-recording` - Process new recording
- `GET /api/v1/recording/:sessionId` - Get recording details
- `DELETE /api/v1/recording/:sessionId` - Delete recording

#### Feedback Routes
- `POST /api/v1/feedback` - Submit feedback
- `GET /api/v1/feedback/:recordingId` - Get feedback for recording

#### Insights Routes
- `POST /api/v1/insights/:sessionId` - Generate AI insights for recording
- `GET /api/v1/insights/:sessionId` - Get existing insights

#### User Routes
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update user profile

#### Frontend Routes
- `GET /api/v1/frontend/demo-data` - Send test data via WebSocket

### WebSocket Events

#### Client → Server
- `register` - Register for session updates
- `disconnect` - Clean up session

#### Server → Client
- `registered` - Confirmation of registration
- `video` - Video file data
- `audio` - Audio file data
- `instructions` - DOM event instructions
- `processing_status` - Processing updates

### Python API

#### Endpoints
- `POST /audio-full-process` - Full AI processing pipeline
- `POST /process-recording` - Process DOM events

---

## 🔐 Security

### Authentication
- Clerk handles all user authentication
- JWT tokens for API requests
- Webhook signature verification

### Database Security
- Row Level Security (RLS) policies
- Service role for backend operations
- Anon key for frontend (limited access)

### API Security
- CORS configuration
- Rate limiting (recommended)
- Input validation
- File upload restrictions

---

## 🐛 Troubleshooting

### Common Issues

#### Extension not recording
- Check microphone/screen permissions
- Verify content script injection
- Check background service worker logs

#### Audio generation timeout
- Deepgram API may be slow
- Check network connectivity
- Verify API key validity
- Review retry logic in logs

#### WebSocket not connecting
- Ensure Node.js server is running
- Check CORS configuration
- Verify frontend URL in backend

#### Database errors
- Verify Supabase credentials
- Check RLS policies
- Review migration status

---

## 📝 Documentation

- `CLUESOUSERDOCUMENTATION` - End to End User Documentation
- `SUPABASE_SETUP_GUIDE.md` - End to End Technical Documentation

---
## 🙏 Acknowledgments

- **Clerk** - Authentication platform
- **Supabase** - Database and backend services
- **Deepgram** - Speech-to-text and text-to-speech
- **Google Gemini** - AI script generation
- **NVIDIA NIM** - AI insights generation (Qwen3-Next-80B model)


---





