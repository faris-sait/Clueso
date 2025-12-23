const startBtn = document.getElementById("start-recording");
const stopBtn = document.getElementById("stop-recording");
const statusEl = document.getElementById("status");

// Update UI based on recording state
async function updateUI() {
  const { isRecording } = await chrome.storage.local.get("isRecording");

  if (isRecording) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.classList.add("disabled");
    stopBtn.classList.remove("disabled");
    if (statusEl) statusEl.textContent = "Recording...";
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.classList.remove("disabled");
    stopBtn.classList.add("disabled");
    if (statusEl) statusEl.textContent = "Ready";
  }
}

// Listen for recording status changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RECORDING_STATUS") {
    updateUI();
  }

  if (msg.type === "RECORDING_ERROR") {
    console.error("[popup] Recording error:", msg.error);
    if (statusEl) statusEl.textContent = `Error: ${msg.error}`;
    alert(`Recording failed: ${msg.error}\n\nPlease try again.`);
  }
});

// Start recording - request permissions in popup (has user gesture)
startBtn.onclick = async () => {
  console.log("[popup] START button clicked");

  if (statusEl) statusEl.textContent = "Requesting permissions...";

  try {
    // Request permissions HERE in popup (user gesture is still active)
    console.log("[popup] Requesting microphone permission...");
    
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      const audioTrack = micStream.getAudioTracks()[0];
      console.log("[popup] ✓ Microphone permission granted:", audioTrack?.label);
    } catch (micErr) {
      console.error("[popup] Microphone permission error:", micErr);
      throw new Error(`Microphone: ${micErr.message}`);
    }

    // Request screen permission - CRITICAL: Must happen immediately after mic
    console.log("[popup] Requesting screen permission...");
    if (statusEl) statusEl.textContent = "Select screen to share...";
    
    let screenStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor'
        },
        audio: false,
        preferCurrentTab: false
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      console.log("[popup] ✓ Screen permission granted:", settings?.displaySurface);
    } catch (screenErr) {
      console.error("[popup] Screen permission error:", screenErr);
      
      // Clean up mic stream
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
      }
      
      if (screenErr.name === 'NotAllowedError') {
        throw new Error("Screen sharing was cancelled. Please try again and select a screen.");
      } else if (screenErr.name === 'NotFoundError') {
        throw new Error("No screen available to share.");
      } else {
        throw new Error(`Screen sharing failed: ${screenErr.message}`);
      }
    }

    // Permissions granted! Now send START_RECORDING with stream IDs
    console.log("[popup] Sending START_RECORDING message");
    chrome.runtime.sendMessage({
      type: "START_RECORDING",
      permissionsGranted: true,
      micLabel: micStream.getAudioTracks()[0]?.label,
      screenLabel: screenStream.getVideoTracks()[0]?.label
    });

    // Keep streams alive longer to maintain permissions
    // Offscreen will request new streams using granted permissions
    setTimeout(() => {
      console.log("[popup] Closing temporary permission streams");
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    }, 10000);

    if (statusEl) statusEl.textContent = "Starting recording...";
  } catch (err) {
    console.error("[popup] Permission error:", err);

    let errorMsg = err.message || "Permission denied";
    
    if (statusEl) statusEl.textContent = `Error: ${errorMsg}`;
    alert(`Recording failed:\n\n${errorMsg}\n\nPlease try again.`);
    
    // Reset UI
    updateUI();
  }
};

// Stop recording
stopBtn.onclick = () => {
  console.log("[popup] STOP button clicked");

  try {
    chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
    console.log("[popup] STOP_RECORDING message sent");

    if (statusEl) statusEl.textContent = "Stopping recording...";
  } catch (err) {
    console.error("[popup] Error sending STOP_RECORDING:", err);
  }
};

// Initialize UI on popup open
updateUI();
console.log("[popup] Popup initialized");

// Debug: Check if screen capture API is available
if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
  console.log("[popup] ✓ Screen capture API available");
} else {
  console.error("[popup] ✗ Screen capture API NOT available");
  if (statusEl) statusEl.textContent = "Screen capture not supported";
}

// Debug: Log available media devices
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    console.log("[popup] Available devices:", devices.length);
    devices.forEach(device => {
      console.log(`  - ${device.kind}: ${device.label || 'unlabeled'}`);
    });
  })
  .catch(err => console.error("[popup] Error enumerating devices:", err));