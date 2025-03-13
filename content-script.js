// Content script to help with microphone permissions
console.log('Voice to Text Converter content script loaded');

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'requestMicrophoneAccess') {
    console.log('Content script received microphone access request');
    
    // Try to get microphone access from the content script context
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Keep the stream active for a moment
        setTimeout(() => {
          // Then stop all tracks
          stream.getTracks().forEach(track => track.stop());
          console.log('Microphone stream stopped after successful permission in content script');
        }, 500);
        
        console.log('Microphone permission granted from content script');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Microphone permission error from content script:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
}); 