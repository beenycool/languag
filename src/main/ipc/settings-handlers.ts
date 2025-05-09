import { ipcMain } from 'electron';
import { configManager } from '../services/config-manager';
import logger from '../services/logger';
import { IPCChannels } from '../../shared/types/ipc'; // Assuming IPCChannels will be defined here

// Ensure IPCChannels enum is defined, or define it if not already present in a shared location.
// For now, we'll use string literals and assume IPCChannels.GET_SETTINGS and IPCChannels.UPDATE_SETTINGS
// will be replaced by actual enum members later.

ipcMain.handle(IPCChannels.GET_SETTINGS, async (_event, key?: string) => {
  try {
    logger.info(`IPC: Received ${IPCChannels.GET_SETTINGS} for key: ${key || 'all'}`);
    const settings = key ? configManager.get(key) : configManager.get('/');
    return settings;
  } catch (error) {
    logger.error(`IPC: Error handling ${IPCChannels.GET_SETTINGS}:`, error);
    throw error; // Rethrow to send error to renderer
  }
});

ipcMain.handle(IPCChannels.UPDATE_SETTINGS, async (_event, settingsToUpdate: { [key: string]: any }) => {
  try {
    logger.info(`IPC: Received ${IPCChannels.UPDATE_SETTINGS} with data:`, settingsToUpdate);
    for (const key in settingsToUpdate) {
      if (Object.prototype.hasOwnProperty.call(settingsToUpdate, key)) {
        configManager.set(key, settingsToUpdate[key]);
      }
    }
    // Optionally, save immediately after setting, or rely on ConfigManager's persistence strategy
    await configManager.save(); // Assuming save is async
    logger.info('IPC: Settings updated and saved.');
    // Optionally, broadcast settings_changed if other parts of the app need to know
    // event.sender.send(IPCChannels.SETTINGS_CHANGED, configManager.get('/'));
    return { success: true };
  } catch (error) {
    logger.error(`IPC: Error handling ${IPCChannels.UPDATE_SETTINGS}:`, error);
    return { success: false, error: (error as Error).message };
  }
});

logger.info('Settings IPC handlers initialized.');