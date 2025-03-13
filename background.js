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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'requestMicrophoneAccess') {
    console.log('Background script received microphone access request');
    
    // Try to get microphone access from the background context
    navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    })
    .then(stream => {
      // Keep the stream active for a moment to ensure Chrome registers the permission
      setTimeout(() => {
        // Then stop all tracks
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted from background');
      }, 1000);
      
      // Immediately respond with success
      sendResponse({ success: true });
      
      // Store the permission state
      chrome.storage.local.set({ microphonePermission: true });
    })
    .catch(error => {
      console.error('Microphone permission error from background:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
}); 