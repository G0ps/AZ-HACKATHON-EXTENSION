// Background script to help with microphone permissions
chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice to Text Converter extension installed');
  
  // Check if we already have microphone permission
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' })
      .then(permissionStatus => {
        console.log('Initial microphone permission state:', permissionStatus.state);
        
        // Store the permission state
        chrome.storage.local.set({ 
          microphonePermission: permissionStatus.state === 'granted' 
        });
        
        // Listen for changes to the permission
        permissionStatus.onchange = function() {
          console.log('Microphone permission state changed to:', this.state);
          chrome.storage.local.set({ 
            microphonePermission: this.state === 'granted' 
          });
        };
      })
      .catch(error => {
        console.error('Error checking microphone permission:', error);
      });
  }
});

// Function to request microphone permission
async function requestMicrophonePermission() {
  try {
    console.log('Background script attempting to request microphone permission');
    
    // Create an audio context first (helps with permission issues in some browsers)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Request microphone access with specific constraints for better compatibility
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    // Keep the stream active for a moment to ensure Chrome registers the permission
    setTimeout(() => {
      // Then stop all tracks
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone stream stopped after successful permission in background');
    }, 1000);
    
    console.log('Microphone permission granted from background');
    
    // Store the permission state
    chrome.storage.local.set({ microphonePermission: true });
    
    return { success: true };
  } catch (error) {
    console.error('Microphone permission error from background:', error);
    return { success: false, error: error.message, errorName: error.name };
  }
}

// Listen for messages from the popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle microphone access request
  if (request.action === 'requestMicrophoneAccess') {
    console.log('Background script received microphone access request');
    
    // Try to get microphone access from the background context
    requestMicrophonePermission()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error in background permission request:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          errorName: error.name
        });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  // Handle notification that microphone permission was granted
  if (request.action === 'microphonePermissionGranted') {
    console.log('Background script received notification that microphone permission was granted');
    
    // Store the permission state
    chrome.storage.local.set({ microphonePermission: true }, () => {
      console.log('Microphone permission state updated in storage');
    });
    
    // No response needed
    return false;
  }
}); 