// Content script to help with microphone permissions
console.log('Voice to Text Converter content script loaded');

// Function to request microphone permission
async function requestMicrophonePermission() {
  try {
    console.log('Content script attempting to request microphone permission');
    
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
      console.log('Microphone stream stopped after successful permission in content script');
    }, 1000);
    
    console.log('Microphone permission granted from content script');
    return { success: true };
  } catch (error) {
    console.error('Microphone permission error from content script:', error);
    return { success: false, error: error.message, errorName: error.name };
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'requestMicrophoneAccess') {
    console.log('Content script received microphone access request');
    
    // Request microphone permission
    requestMicrophonePermission()
      .then(result => {
        sendResponse(result);
        
        // If permission was granted, notify the extension
        if (result.success) {
          chrome.runtime.sendMessage({ 
            action: 'microphonePermissionGranted' 
          });
        }
      })
      .catch(error => {
        console.error('Error in content script permission request:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          errorName: error.name
        });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Check if microphone permission is already granted
if (navigator.permissions) {
  navigator.permissions.query({ name: 'microphone' })
    .then(permissionStatus => {
      console.log('Content script detected microphone permission state:', permissionStatus.state);
      
      // If permission is granted, notify the extension
      if (permissionStatus.state === 'granted') {
        chrome.runtime.sendMessage({ 
          action: 'microphonePermissionGranted' 
        });
      }
      
      // Listen for permission changes
      permissionStatus.onchange = function() {
        console.log('Content script detected microphone permission change:', this.state);
        
        // If permission is granted, notify the extension
        if (this.state === 'granted') {
          chrome.runtime.sendMessage({ 
            action: 'microphonePermissionGranted' 
          });
        }
      };
    })
    .catch(error => {
      console.error('Error checking microphone permission in content script:', error);
    });
} 