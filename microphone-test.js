document.addEventListener('DOMContentLoaded', function() {
  const testBtn = document.getElementById('testBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const micInfo = document.getElementById('micInfo');
  const visualizer = document.getElementById('visualizer');
  
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let visualizerBars = [];
  let animationId = null;
  
  // Create visualizer bars
  function createVisualizerBars() {
    visualizer.innerHTML = '';
    const barCount = 64;
    const barWidth = visualizer.clientWidth / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'audio-bar';
      bar.style.left = (i * barWidth) + 'px';
      bar.style.width = (barWidth - 1) + 'px';
      bar.style.height = '0px';
      visualizer.appendChild(bar);
      visualizerBars.push(bar);
    }
  }
  
  // Update visualizer
  function updateVisualizer() {
    if (!analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    for (let i = 0; i < visualizerBars.length; i++) {
      const value = dataArray[i] || 0;
      const percent = value / 255;
      const height = percent * visualizer.clientHeight;
      visualizerBars[i].style.height = height + 'px';
    }
    
    animationId = requestAnimationFrame(updateVisualizer);
  }
  
  // Test microphone
  async function testMicrophone() {
    try {
      status.textContent = 'Requesting microphone access...';
      status.className = 'info';
      
      // Force a user gesture to trigger the permission dialog
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Request microphone access
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Get microphone information
      const tracks = stream.getAudioTracks();
      const trackInfo = tracks.map(track => {
        const settings = track.getSettings();
        return {
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: settings
        };
      });
      
      micInfo.textContent = JSON.stringify(trackInfo, null, 2);
      
      // Set up audio visualizer
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      createVisualizerBars();
      updateVisualizer();
      
      status.textContent = 'Microphone is working! Speak to see the visualizer respond.';
      status.className = 'success';
      testBtn.disabled = true;
      stopBtn.disabled = false;
      
      // Store the permission status if we're in a Chrome extension context
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ microphonePermission: true }, function() {
          console.log('Permission saved to storage');
        });
      }
    } catch (error) {
      console.error('Microphone error:', error);
      status.textContent = 'Error: ' + error.message;
      status.className = 'error';
      micInfo.textContent = 'Error accessing microphone: ' + error.message;
      
      // Show specific instructions based on the error
      if (error.name === 'NotAllowedError') {
        micInfo.textContent += '\n\nYou denied permission to use the microphone. Please click the lock icon in the address bar and change the microphone setting to "Allow".';
      } else if (error.name === 'NotFoundError') {
        micInfo.textContent += '\n\nNo microphone was found. Please check that your microphone is properly connected.';
      }
    }
  }
  
  // Stop microphone test
  function stopTest() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }
    
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    // Reset visualizer
    visualizerBars.forEach(bar => {
      bar.style.height = '0px';
    });
    
    status.textContent = 'Microphone test stopped.';
    status.className = 'info';
    testBtn.disabled = false;
    stopBtn.disabled = true;
  }
  
  // Event listeners
  testBtn.addEventListener('click', testMicrophone);
  stopBtn.addEventListener('click', stopTest);
  
  // Check if microphone permission is already granted
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' })
      .then(permissionStatus => {
        micInfo.textContent = 'Current microphone permission state: ' + permissionStatus.state;
        
        if (permissionStatus.state === 'granted') {
          status.textContent = 'Microphone permission is already granted. Click "Test Microphone" to verify it works.';
          status.className = 'success';
        } else if (permissionStatus.state === 'denied') {
          status.textContent = 'Microphone permission is denied. Please click the lock icon in the address bar and change the setting.';
          status.className = 'error';
        }
        
        // Listen for permission changes
        permissionStatus.onchange = function() {
          micInfo.textContent = 'Microphone permission state changed to: ' + this.state;
          
          if (this.state === 'granted') {
            status.textContent = 'Microphone permission granted! Click "Test Microphone" to verify it works.';
            status.className = 'success';
          } else {
            status.textContent = 'Microphone permission is ' + this.state + '.';
            status.className = this.state === 'denied' ? 'error' : 'info';
          }
        };
      })
      .catch(error => {
        console.error('Error checking permission:', error);
      });
  }
}); 