import { initializeSettings } from './settings';
import { ElectronAPI } from '../preload'; // Assuming preload.ts is one level up

// Augment the Window interface if not already done in settings.ts
// (it's good practice to have it where electronAPI is first used or in a central types file for renderer)
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const appInfoParagraph = document.querySelector('p');
  if (appInfoParagraph) {
    appInfoParagraph.textContent = 'Renderer process loaded. Initializing UI...';
  }

  // Initialize settings UI and logic
  initializeSettings();

  // Example IPC ping
  const pingButton = document.getElementById('ping-button');
  const pongResponse = document.getElementById('pong-response');

  if (pingButton && pongResponse) {
    pingButton.addEventListener('click', () => {
      console.log('Renderer: Sending ping to main...');
      window.electronAPI.sendPing();
      pongResponse.textContent = 'Ping sent. Waiting for pong...';
    });

    const cleanupPongListener = window.electronAPI.onPong((message: string) => {
      console.log('Renderer: Received pong from main:', message);
      if (pongResponse) {
        pongResponse.textContent = `Pong received: ${message}`;
      }
    });

    // Clean up listener on unload
    // window.addEventListener('beforeunload', cleanupPongListener);
  } else {
    console.warn('Ping/pong UI elements not found.');
  }

  // Example: Load and log UI state on startup
  window.electronAPI.getUiState().then(uiState => {
    if (uiState) {
      console.log('Initial UI State from main:', uiState);
      // Here you could apply window size or other UI settings if needed,
      // though window size is primarily handled by main process restoring it.
    } else {
      console.log('No UI state received from main.');
    }
  }).catch(error => {
    console.error('Failed to get UI state:', error);
  });


  console.log('Renderer initialized.');
});