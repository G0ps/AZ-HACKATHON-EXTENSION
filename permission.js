document.addEventListener('DOMContentLoaded', function() {
  const permissionBtn = document.getElementById('permissionBtn');
  const status = document.getElementById('status');
  const permissionStatus = document.getElementById('permissionStatus');
  
  // Function to update permission status display
  function updatePermissionStatusDisplay(state) {
    permissionStatus.textContent = 'Current permission status: ' + state;
    if (state === 'granted') {
      permissionStatus.style.backgroundColor = '#d4edda';
      permissionStatus.style.color = '#155724';
    } else if (state === 'denied') {
      permissionStatus.style.backgroundColor = '#f8d7da';
      permissionStatus.style.color = '#721c24';
    } else {
      permissionStatus.style.backgroundColor = '#f5f5f5';
      permissionStatus.style.color = '#666';
    }
  }
  
  // Check if permission was previously granted
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' })
      .then(permissionStatus => {
        console.log('Current microphone permission state:', permissionStatus.state);
        updatePermissionStatusDisplay(permissionStatus.state);
        
        if (permissionStatus.state === 'granted') {
          status.textContent = 'Microphone permission is already granted! You can close this tab and use the extension.';
          status.className = 'success';
          permissionBtn.textContent = 'Permission Already Granted';
          permissionBtn.disabled = true;
          
          // Store the permission status
          chrome.storage.local.set({ microphonePermission: true }, function() {
            console.log('Permission saved to storage');
          });
        }
        
        // Listen for permission changes
        permissionStatus.onchange = function() {
          console.log('Permission state changed to:', this.state);
          updatePermissionStatusDisplay(this.state);
          
          if (this.state === 'granted') {
            status.textContent = 'Microphone permission granted! You can close this tab and use the extension.';
            status.className = 'success';
            permissionBtn.textContent = 'Permission Granted';
            permissionBtn.disabled = true;
            
            // Store the permission status
            chrome.storage.local.set({ microphonePermission: true }, function() {
              console.log('Permission saved to storage');
            });
          }
        };
      });
  } else {
    permissionStatus.textContent = 'Cannot check permission status: Permissions API not supported';
  }
  
  permissionBtn.addEventListener('click', async function() {
    status.textContent = 'Requesting microphone permission...';
    status.className = '';
    
    try {
      // Force a user gesture to trigger the permission dialog
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
        console.log('Microphone stream stopped after successful permission');
      }, 1000);
      
      // Save the permission status
      chrome.storage.local.set({ microphonePermission: true }, function() {
        console.log('Permission saved to storage');
      });
      
      status.textContent = 'Microphone permission granted! You can now close this tab and use the extension.';
      status.className = 'success';
      permissionBtn.textContent = 'Permission Granted';
      permissionBtn.disabled = true;
      
      // Update the permission status display
      updatePermissionStatusDisplay('granted');
    } catch (error) {
      console.error('Microphone permission error:', error);
      status.textContent = 'Error: ' + error.message + '. Please check the instructions below.';
      status.className = 'error';
      
      // Show specific instructions based on the error
      if (error.name === 'NotAllowedError') {
        status.textContent += ' You denied permission to use the microphone. Please click the lock icon in the address bar and change the microphone setting to "Allow".';
      }
      
      // Update the permission status display
      updatePermissionStatusDisplay('denied');
    }
  });
}); 