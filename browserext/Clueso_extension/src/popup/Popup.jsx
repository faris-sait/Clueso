// src/popup/Popup.jsx
import { useEffect, useRef, useState } from 'react';

const FRONTEND_URL = 'http://localhost:3001'; // Your Next.js frontend URL

export default function Popup() {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [authState, setAuthState] = useState({ 
    loading: true, 
    authenticated: false, 
    user: null,
    error: null 
  });
  const countdownRef = useRef(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
    
    // Get initial recording state from storage
    chrome.storage.local.get(['isRecording', 'authUser'], (res) => {
      setRecording(!!res.isRecording);
    });

    // Listen for status updates from background
    const handler = (msg) => {
      if (msg?.type === 'RECORDING_STATUS') {
        setRecording(!!msg.isRecording);
        if (!msg.isRecording) {
          setCountdown(0);
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      try { chrome.runtime.onMessage.removeListener(handler); } catch (e) {}
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`${FRONTEND_URL}/api/extension/auth`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.authenticated && data.user) {
        await chrome.storage.local.set({ authUser: data.user });
        setAuthState({ loading: false, authenticated: true, user: data.user, error: null });
      } else {
        await chrome.storage.local.remove('authUser');
        setAuthState({ loading: false, authenticated: false, user: null, error: null });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await chrome.storage.local.remove('authUser');
      setAuthState({ 
        loading: false, 
        authenticated: false, 
        user: null, 
        error: 'Could not connect to Clueso. Make sure the app is running.'
      });
    }
  };

  const openSignIn = () => {
    chrome.tabs.create({ url: `${FRONTEND_URL}/sign-in` });
    window.close(); // Close popup after opening sign-in
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: FRONTEND_URL });
  };

  const signOut = async () => {
    await chrome.storage.local.remove('authUser');
    setAuthState({ loading: false, authenticated: false, user: null, error: null });
  };

  const start = async () => {
    // If not authenticated, redirect to sign in immediately
    if (!authState.authenticated) {
      openSignIn();
      return;
    }

    if (recording || countdown > 0) return;

    let counter = 3;
    setCountdown(counter);

    const id = setInterval(() => {
      counter -= 1;
      if (counter <= 0) {
        clearInterval(id);
        countdownRef.current = null;
        setCountdown(0);

        try {
          chrome.runtime.sendMessage({ 
            type: 'START_RECORDING',
            user: authState.user
          });
          setRecording(true);
        } catch (err) {
          console.error('start error', err);
        }
      } else {
        setCountdown(counter);
      }
    }, 1000);

    countdownRef.current = id;
  };

  const stop = () => {
    try {
      chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      setRecording(false);
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    } catch (err) {
      console.error('stop error', err);
    }
  };

  // Loading state
  if (authState.loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.logo}>✦</span>
          <h2 style={styles.title}>Clueso</h2>
        </div>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (authState.error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.logo}>✦</span>
          <h2 style={styles.title}>Clueso</h2>
        </div>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <p style={styles.errorText}>{authState.error}</p>
          <button onClick={checkAuth} style={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated - show prominent sign-in prompt
  if (!authState.authenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.logo}>✦</span>
          <h2 style={styles.title}>Clueso</h2>
        </div>
        
        <div style={styles.notAuthContainer}>
          {/* Status indicator */}
          <div style={styles.statusBadge}>
            <span style={styles.statusDot}></span>
            Not signed in
          </div>

          <div style={styles.authIcon}>🔐</div>
          
          <h3 style={styles.authTitle}>Sign in required</h3>
          <p style={styles.authDescription}>
            Sign in to your Clueso account to start recording and save your videos.
          </p>

          <button onClick={openSignIn} style={styles.signInButtonLarge}>
            Sign In to Clueso
          </button>

          <p style={styles.signUpText}>
            Don't have an account?{' '}
            <button 
              onClick={() => chrome.tabs.create({ url: `${FRONTEND_URL}/sign-up` })}
              style={styles.signUpLink}
            >
              Sign up
            </button>
          </p>

          <button onClick={checkAuth} style={styles.refreshButtonSmall}>
            ↻ Already signed in? Refresh
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - show recorder
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>✦</span>
        <h2 style={styles.title}>Clueso</h2>
      </div>

      {/* User info with green status */}
      <div style={styles.userInfo}>
        <div style={styles.userLeft}>
          {authState.user.imageUrl ? (
            <img src={authState.user.imageUrl} alt="" style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {(authState.user.firstName?.[0] || authState.user.email?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div style={styles.userDetails}>
            <span style={styles.userName}>
              {authState.user.firstName || authState.user.email?.split('@')[0]}
            </span>
            <div style={styles.connectedBadge}>
              <span style={styles.connectedDot}></span>
              Connected
            </div>
          </div>
        </div>
        <button onClick={signOut} style={styles.signOutButton}>Sign out</button>
      </div>

      <p style={styles.description}>
        Record your screen with audio narration
      </p>

      {countdown > 0 && !recording && (
        <div style={styles.countdown}>
          Starting in {countdown}...
        </div>
      )}

      <div style={styles.buttonGroup}>
        <button
          onClick={start}
          disabled={recording || countdown > 0}
          style={{
            ...styles.button,
            ...styles.startButton,
            opacity: (recording || countdown > 0) ? 0.5 : 1,
            cursor: (recording || countdown > 0) ? 'not-allowed' : 'pointer',
          }}
        >
          {countdown > 0 ? 'Starting...' : recording ? 'Recording...' : '● Start Recording'}
        </button>
        <button
          onClick={stop}
          disabled={!recording}
          style={{
            ...styles.button,
            ...styles.stopButton,
            opacity: !recording ? 0.5 : 1,
            cursor: !recording ? 'not-allowed' : 'pointer',
          }}
        >
          ■ Stop
        </button>
      </div>

      {recording && (
        <div style={styles.recordingIndicator}>
          <span style={styles.recordingDot}></span>
          Recording in progress...
        </div>
      )}

      <button onClick={openDashboard} style={styles.dashboardLink}>
        Open Dashboard →
      </button>
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
    width: '320px',
    boxSizing: 'border-box',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    backgroundColor: '#0f0f14',
    color: '#f5f5f7',
    minHeight: '200px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #27272a',
  },
  logo: {
    fontSize: '24px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
  },
  
  // Loading styles
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 0',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #27272a',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '12px',
    color: '#a1a1aa',
    fontSize: '14px',
  },

  // Error styles
  errorContainer: {
    textAlign: 'center',
    padding: '20px 0',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  errorText: {
    color: '#f87171',
    fontSize: '13px',
    marginBottom: '16px',
    lineHeight: '1.4',
  },
  retryButton: {
    backgroundColor: '#27272a',
    color: '#f5f5f7',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },

  // Not authenticated styles
  notAuthContainer: {
    textAlign: 'center',
    padding: '10px 0',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '16px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#f87171',
    borderRadius: '50%',
  },
  authIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  authTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  authDescription: {
    color: '#a1a1aa',
    fontSize: '13px',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  signInButtonLarge: {
    width: '100%',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  signUpText: {
    color: '#71717a',
    fontSize: '13px',
    marginBottom: '16px',
  },
  signUpLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  refreshButtonSmall: {
    background: 'none',
    border: 'none',
    color: '#52525b',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // Authenticated user styles
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#1a1a24',
    borderRadius: '10px',
    marginBottom: '16px',
  },
  userLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
  },
  avatarPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#4ade80',
  },
  connectedDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#4ade80',
    borderRadius: '50%',
  },
  signOutButton: {
    background: 'none',
    border: '1px solid #3f3f46',
    color: '#a1a1aa',
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },

  // Recording controls
  description: {
    color: '#a1a1aa',
    fontSize: '13px',
    marginBottom: '16px',
  },
  countdown: {
    color: '#f59e0b',
    fontWeight: '500',
    marginBottom: '12px',
    textAlign: 'center',
    fontSize: '15px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    flex: 1,
    padding: '14px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    transition: 'all 0.2s',
  },
  startButton: {
    backgroundColor: '#6366f1',
    color: 'white',
  },
  stopButton: {
    backgroundColor: '#dc2626',
    color: 'white',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '12px',
    color: '#f87171',
    fontSize: '13px',
    fontWeight: '500',
  },
  recordingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  },
  dashboardLink: {
    display: 'block',
    width: '100%',
    marginTop: '16px',
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'center',
  },
};
