document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const permissionBtn = document.getElementById('permissionBtn');
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  const debugInfo = document.getElementById('debug-info');
  
  // Debug logging function
  function logDebug(message) {
    console.log(message);
    const timestamp = new Date().toLocaleTimeString();
    debugInfo.innerHTML += `[${timestamp}] ${message}<br>`;
    debugInfo.scrollTop = debugInfo.scrollHeight;
  }
  
  // Log browser and environment info
  logDebug(`Browser: ${navigator.userAgent}`);
  logDebug(`Speech Recognition API: ${window.SpeechRecognition ? 'Native' : (window.webkitSpeechRecognition ? 'Webkit' : 'Not supported')}`);
  
  // Check if browser supports speech recognition
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    status.textContent = 'Speech recognition is not supported in your browser. Try Chrome.';
    logDebug('ERROR: Speech recognition not supported in this browser');
    startBtn.disabled = true;
    return;
  }
  
  // Initialize speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  // Configure speech recognition
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US'; // Default language
  recognition.maxAlternatives = 1;
  
  logDebug('Speech recognition configured with:');
  logDebug(`- continuous: ${recognition.continuous}`);
  logDebug(`- interimResults: ${recognition.interimResults}`);
  logDebug(`- lang: ${recognition.lang}`);
  
  // Variables to track state
  let isRecording = false;
  let finalTranscript = '';
  let interimTranscript = '';
  let restartCount = 0;
  const MAX_AUTO_RESTARTS = 3;
  let permissionGranted = false;
  let microphoneStream = null;
  
  // Check microphone permission status directly
  function checkMicrophonePermission() {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' })
        .then(permissionStatus => {
          logDebug(`Current microphone permission state: ${permissionStatus.state}`);
          
          if (permissionStatus.state === 'granted') {
            permissionGranted = true;
            chrome.storage.local.set({ microphonePermission: true });
            permissionBtn.style.display = 'none';
          } else {
            permissionGranted = false;
            permissionBtn.style.display = 'block';
          }
          
          // Listen for permission changes
          permissionStatus.onchange = function() {
            logDebug(`Microphone permission state changed to: ${this.state}`);
            permissionGranted = (this.state === 'granted');
            chrome.storage.local.set({ microphonePermission: permissionGranted });
            
            if (permissionGranted) {
              permissionBtn.style.display = 'none';
            } else {
              permissionBtn.style.display = 'block';
            }
          };
        })
        .catch(error => {
          logDebug(`ERROR: Could not query permission status: ${error.message}`);
        });
    }
  }
  
  // Check if permission was previously granted
  chrome.storage.local.get(['microphonePermission'], function(result) {
    if (result.microphonePermission === true) {
      logDebug('Microphone permission was previously granted according to storage');
      permissionGranted = true;
      permissionBtn.style.display = 'none';
    } else {
      // Double-check with the permissions API
      checkMicrophonePermission();
    }
  });
  
  // Event listeners for buttons
  startBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  copyBtn.addEventListener('click', copyText);
  clearBtn.addEventListener('click', clearText);
  permissionBtn.addEventListener('click', openPermissionPage);
  
  // Add test microphone link to debug section
  const testMicLink = document.createElement('a');
  testMicLink.href = '#';
  testMicLink.textContent = 'Test Microphone in New Tab';
  testMicLink.style.display = 'block';
  testMicLink.style.marginTop = '10px';
  testMicLink.style.color = '#4285f4';
  testMicLink.addEventListener('click', function(e) {
    e.preventDefault();
    openMicrophoneTestPage();
  });
  debugInfo.parentNode.insertBefore(testMicLink, debugInfo);
  
  // Function to open the permission page
  function openPermissionPage() {
    logDebug('Opening permission page...');
    chrome.tabs.create({ url: 'permission.html' });
  }
  
  // Function to open the microphone test page
  function openMicrophoneTestPage() {
    logDebug('Opening microphone test page...');
    chrome.tabs.create({ url: 'microphone-test.html' });
  }
  
  // Speech recognition event handlers
  recognition.onstart = function() {
    logDebug('Speech recognition started');
    isRecording = true;
    status.textContent = 'Listening...';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    result.classList.add('recording');
    restartCount = 0; // Reset restart count when manually started
  };
  
  recognition.onresult = function(event) {
    logDebug(`Speech result received: ${event.results.length} results`);
    interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
        logDebug(`Final transcript: "${event.results[i][0].transcript}"`);
      } else {
        interimTranscript += event.results[i][0].transcript;
        logDebug(`Interim transcript: "${event.results[i][0].transcript}"`);
      }
    }
    
    result.value = finalTranscript + interimTranscript;
    result.scrollTop = result.scrollHeight;
  };
  
  recognition.onerror = function(event) {
    logDebug(`ERROR: Speech recognition error: ${event.error}`);
    
    // Handle specific error types
    switch(event.error) {
      case 'not-allowed':
        status.textContent = 'Error: Microphone permission denied. Please use the "Grant Microphone Permission" button.';
        logDebug('Showing permission button');
        permissionBtn.style.display = 'block';
        permissionGranted = false;
        chrome.storage.local.set({ microphonePermission: false });
        break;
      case 'audio-capture':
        status.textContent = 'Error: No microphone detected. Please connect a microphone and try again.';
        break;
      case 'network':
        status.textContent = 'Error: Network issue. Please check your internet connection.';
        break;
      case 'aborted':
        status.textContent = 'Recognition aborted. Restarting...';
        break;
      default:
        status.textContent = 'Error: ' + event.error + '. Trying to restart...';
    }
  };
  
  recognition.onend = function() {
    logDebug(`Speech recognition ended. isRecording: ${isRecording}`);
    
    if (isRecording) {
      // If it ended unexpectedly while still recording, try to restart it
      if (restartCount < MAX_AUTO_RESTARTS) {
        restartCount++;
        logDebug(`Attempting to restart recognition (${restartCount}/${MAX_AUTO_RESTARTS})`);
        status.textContent = `Recognition stopped unexpectedly. Restarting (${restartCount}/${MAX_AUTO_RESTARTS})...`;
        
        // Add a small delay before restarting
        setTimeout(() => {
          try {
            recognition.start();
            logDebug('Recognition restarted after delay');
          } catch (error) {
            logDebug(`ERROR: Failed to restart recognition: ${error.message}`);
            status.textContent = 'Failed to restart recognition. Please try again manually.';
            isRecording = false;
            startBtn.disabled = false;
            stopBtn.disabled = true;
            result.classList.remove('recording');
          }
        }, 300);
      } else {
        logDebug('Max auto-restarts reached');
        status.textContent = 'Recognition stopped after multiple restart attempts. Please try again.';
        isRecording = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        result.classList.remove('recording');
      }
    } else {
      status.textContent = 'Voice recognition stopped.';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      result.classList.remove('recording');
    }
  };
  
  // Function to keep microphone active during recognition
  async function keepMicrophoneActive() {
    if (microphoneStream) {
      // Already have an active stream
      return true;
    }
    
    try {
      // Get microphone stream with specific constraints for better compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Store the stream
      microphoneStream = stream;
      logDebug('Microphone stream acquired and kept active');
      
      // Update permission status
      permissionGranted = true;
      chrome.storage.local.set({ microphonePermission: true });
      permissionBtn.style.display = 'none';
      
      return true;
    } catch (error) {
      logDebug(`ERROR: Failed to keep microphone active: ${error.message}`);
      return false;
    }
  }
  
  // Function to release microphone when done
  function releaseMicrophone() {
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
      logDebug('Microphone stream released');
    }
  }
  
  // Function to request microphone permission explicitly
  async function requestMicrophonePermission() {
    logDebug('Requesting microphone permission...');
    
    // If permission was previously granted, skip the request
    if (permissionGranted) {
      logDebug('Using previously granted permission');
      return true;
    }
    
    try {
      // Create an audio context first (helps with permission issues in some browsers)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      logDebug('Audio context created');
      
      // Request microphone access with specific constraints for better compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Keep the stream active for a moment to ensure permission is properly registered
      setTimeout(() => {
        // Then stop all tracks
        stream.getTracks().forEach(track => track.stop());
        logDebug('Microphone stream stopped after successful permission');
      }, 1000);
      
      logDebug('Microphone permission granted successfully');
      permissionGranted = true;
      chrome.storage.local.set({ microphonePermission: true });
      permissionBtn.style.display = 'none';
      
      // Update permission status
      checkMicrophonePermission();
      
      return true;
    } catch (error) {
      logDebug(`ERROR: Microphone permission error: ${error.message}`);
      
      status.textContent = 'Error: Microphone permission denied. Please use the "Grant Microphone Permission" button.';
      permissionBtn.style.display = 'block';
      return false;
    }
  }
  
  // Function to start recording
  async function startRecording() {
    logDebug('Start recording button clicked');
    
    // First ensure we have microphone permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission && !permissionGranted) {
      logDebug('Cannot start recording: microphone permission denied');
      
      // Try a different approach - keep microphone active during recognition
      const micActive = await keepMicrophoneActive();
      if (!micActive) {
        logDebug('Failed to activate microphone, showing permission button');
        status.textContent = 'Error: Could not access microphone. Please use the "Grant Microphone Permission" button.';
        permissionBtn.style.display = 'block';
        return;
      }
    }
    
    finalTranscript = result.value || '';
    interimTranscript = '';
    isRecording = true; // Set this before starting recognition
    restartCount = 0;
    
    try {
      logDebug('Starting speech recognition...');
      recognition.start();
    } catch (error) {
      logDebug(`ERROR: Error starting recognition: ${error.message}`);
      
      // Try one more time with a delay
      logDebug('Trying again with delay...');
      setTimeout(() => {
        try {
          recognition.start();
          logDebug('Delayed recognition start successful');
        } catch (retryError) {
          logDebug(`ERROR: Retry failed: ${retryError.message}`);
          status.textContent = 'Error starting recognition. Please reload the extension and try again.';
          isRecording = false;
          startBtn.disabled = false;
          releaseMicrophone();
        }
      }, 500);
    }
  }
  
  // Function to stop recording
  function stopRecording() {
    logDebug('Stop recording button clicked');
    isRecording = false;
    try {
      recognition.stop();
      logDebug('Recognition stopped');
      releaseMicrophone();
    } catch (error) {
      logDebug(`ERROR: Error stopping recognition: ${error.message}`);
    }
  }
  
  // Function to copy text to clipboard
  function copyText() {
    if (result.value) {
      navigator.clipboard.writeText(result.value)
        .then(() => {
          status.textContent = 'Text copied to clipboard!';
          logDebug('Text copied to clipboard');
          setTimeout(() => {
            if (!isRecording) {
              status.textContent = 'Click \'Start Recording\' to begin';
            }
          }, 2000);
        })
        .catch(err => {
          logDebug(`ERROR: Failed to copy text: ${err.message}`);
          status.textContent = 'Failed to copy text.';
        });
    } else {
      status.textContent = 'Nothing to copy.';
      logDebug('Copy attempted but no text available');
    }
  }
  
  // Function to clear text
  function clearText() {
    result.value = '';
    finalTranscript = '';
    interimTranscript = '';
    status.textContent = 'Text cleared.';
    logDebug('Text cleared');
    setTimeout(() => {
      if (!isRecording) {
        status.textContent = 'Click \'Start Recording\' to begin';
      }
    }, 2000);
  }
  
  // Check for permission status on load
  checkMicrophonePermission();
}); 