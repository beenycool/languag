import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { configManager } from './main/services/config-manager';
import logger from './main/services/logger';
import { getLlmService } from './main/services/llm-service';
import { getLlmCacheService } from './main/services/cache-service';
import './main/ipc/settings-handlers'; // Initialize settings IPC handlers
import './main/ipc/ui-state-handlers'; // Initialize UI state IPC handlers

interface StoreSchema {
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isMaximized: boolean;
}

// Define a schema for the store
const schema: import('electron-store').Schema<StoreSchema> = {
  windowBounds: {
    type: 'object',
    properties: {
      width: { type: 'number', default: 1200 },
      height: { type: 'number', default: 800 },
      x: { type: 'number', default: undefined },
      y: { type: 'number', default: undefined },
    },
    default: {
      width: 1200,
      height: 800,
    },
  },
  isMaximized: {
    type: 'boolean',
    default: false,
  },
};

const store: Store<StoreSchema> = new Store<StoreSchema>({ schema });

async function createWindow() {
  logger.info('Application starting...');
  logger.debug('Current config in main:', configManager.get('/'));

  const llmService = getLlmService();
  if (llmService.getActiveProvider()) {
    logger.info(`LLM Service initialized. Active provider: ${llmService.getActiveProvider()?.providerName}`);
    try {
      const models = await llmService.listModels();
      logger.debug('Available models from active provider:', models.map(m => m.id));
    } catch (error) {
      logger.error('Failed to list models from active provider:', error);
    }
  } else {
    logger.warn('LLM Service initialized, but no active provider is available or configured.');
  }

  const llmCacheService = getLlmCacheService();
  logger.info(`LLM Cache service initialized. Current cache size: ${llmCacheService['cache'].size}`);

  const savedBounds = store.get('windowBounds') as { width?: number; height?: number; x?: number; y?: number };
  const isMaximized = store.get('isMaximized') as boolean;

  const mainWindow = new BrowserWindow({
    width: savedBounds.width || 1200,
    height: savedBounds.height || 800,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Corrected to .js as per tsconfig output
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged, // Enable DevTools only in development
    },
    show: false, // Don't show until ready
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window state before closing
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
    store.set('isMaximized', mainWindow.isMaximized());
    logger.info('Window state saved.');
  });

  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  mainWindow.on('moved', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });


  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    // In development, load from the Vite dev server if you're using one,
    // or load the HTML file directly.
    // This assumes your `outDir` in `vite.config.js` (or similar) is `dist`
    // and `index.html` is at the root of `dist/renderer`.
    // Adjust if your dev server URL or file path is different.
    // For now, loading directly as per original plan.
    const indexPath = path.join(__dirname, '../renderer/index.html');
    logger.info(`Loading index.html from: ${indexPath}`);
    mainWindow.loadFile(indexPath);
    mainWindow.webContents.openDevTools(); // Open DevTools in development
  }


  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    logger.info('All windows closed, quitting application.');
    app.quit();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Quitting application.');
  app.quit();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Quitting application.');
  app.quit();
});