import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import logger from '../services/logger';
import { IPCChannels, WindowState, UiStatePayload } from '../../shared/types/ipc';

// Initialize electron-store.

interface StoreSchema {
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isMaximized: boolean;
  // Add other UI state properties here if needed
}

const schema: import('electron-store').Schema<StoreSchema> = {
  windowBounds: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      x: { type: 'number', default: undefined }, // Ensure optional properties can be undefined
      y: { type: 'number', default: undefined }, // Ensure optional properties can be undefined
    },
    default: {
      width: 1200,
      height: 800,
      // x and y will be undefined by default if not set
    },
  },
  isMaximized: {
    type: 'boolean',
    default: false,
  },
};

// When using import * as Store, the constructor might be on Store.default
// or directly on Store depending on the module's structure.
const store = new Store<StoreSchema>({ schema });

ipcMain.handle(IPCChannels.GET_UI_STATE, async (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      logger.warn(`IPC: ${IPCChannels.GET_UI_STATE} called from non-window context.`);
      return null;
    }
    const bounds = store.get('windowBounds') as WindowState;
    const isMaximized = store.get('isMaximized') as boolean;

    logger.info(`IPC: Received ${IPCChannels.GET_UI_STATE}. Returning:`, { bounds, isMaximized });
    return {
      windowBounds: bounds,
      isMaximized: isMaximized,
    };
  } catch (error) {
    logger.error(`IPC: Error handling ${IPCChannels.GET_UI_STATE}:`, error);
    throw error;
  }
});

ipcMain.handle(IPCChannels.UPDATE_UI_STATE, async (event, payload: UiStatePayload) => {
  try {
    logger.info(`IPC: Received ${IPCChannels.UPDATE_UI_STATE} with payload:`, payload);
    const window = BrowserWindow.fromWebContents(event.sender);

    if (payload.windowBounds) {
      store.set('windowBounds', payload.windowBounds);
      if (window && !window.isMaximized() && !window.isMinimized()) {
        window.setBounds(payload.windowBounds);
      }
    }
    if (typeof payload.isMaximized === 'boolean') {
      store.set('isMaximized', payload.isMaximized);
      if (window) {
        if (payload.isMaximized) {
          window.maximize();
        } else {
          // If unmaximizing, restore to stored bounds
          const bounds = store.get('windowBounds') as WindowState;
          if (bounds) window.setBounds(bounds);
          else window.unmaximize(); // Fallback
        }
      }
    }
    // Potentially broadcast changes if other windows/parts need to know
    // event.sender.send(IPCChannels.WINDOW_STATE_CHANGE, { type: 'update', ...payload });
    return { success: true };
  } catch (error) {
    logger.error(`IPC: Error handling ${IPCChannels.UPDATE_UI_STATE}:`, error);
    return { success: false, error: (error as Error).message };
  }
});


// These handlers are for direct window manipulation if needed,
// though saving/restoring state is primarily handled in main.ts window events.
ipcMain.on(IPCChannels.SET_WINDOW_STATE, (event, state: Partial<WindowState>) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (state.isMaximized === true) window.maximize();
    else if (state.isMaximized === false) window.unmaximize();
    // Add other state changes like minimize, setFullScreen, etc.
  }
});


logger.info('UI State IPC handlers initialized.');