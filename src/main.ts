import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { configManager } from './main/services/config-manager';
import logger from './main/services/logger'; // Default import
import { getLlmService } from './main/services/llm-service';
import { getLlmCacheService, getGenericCacheService } from './main/services/cache-service';

async function createWindow() {
  // Config is loaded synchronously in constructor for now, or use await configManager.load();
  logger.info('Application starting...');
  logger.debug('Current config in main:', configManager.get('/')); // Get whole config

  const llmService = getLlmService();
  // Example: Check if active provider is available
  if (llmService.getActiveProvider()) {
    logger.info(`LLM Service initialized. Active provider: ${llmService.getActiveProvider()?.providerName}`);
    const models = await llmService.listModels();
    logger.debug('Available models from active provider:', models.map(m => m.id));
  } else {
    logger.warn('LLM Service initialized, but no active provider is available or configured.');
  }

  // Decide which cache service to use here, or use both if needed.
  // For LLM related caching, use getLlmCacheService.
  // For generic caching, use getGenericCacheService.
  const llmCacheService = getLlmCacheService();
  logger.info(`LLM Cache service initialized. Current cache size: ${llmCacheService['cache'].size}`);

  // Example of using generic cache if needed:
  // const genericCacheService = getGenericCacheService();
  // logger.info(`Generic Cache service initialized. Current cache size: ${genericCacheService['cache'].size}`);


  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // We'll create this later
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load a dummy HTML file or a blank page for now
  // mainWindow.loadFile('index.html'); // We'll create this later
  mainWindow.loadURL('about:blank');


  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// IPC Example: Listen for a 'ping' message and respond with 'pong'
ipcMain.on('ping', (event) => {
  logger.info('Received ping from renderer');
  event.reply('pong', 'Hello from main process!');
});