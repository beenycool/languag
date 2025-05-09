import { EventEmitter } from 'events';
import { IpcMainEvent, IpcRendererEvent } from 'electron';

export class IpcHandler extends EventEmitter {
  private channels: Set<string> = new Set();

  constructor(private ipcType: 'main' | 'renderer') {
    super();
  }

  registerChannel(channel: string): void {
    if (this.channels.has(channel)) return;
    this.channels.add(channel);

    if (this.ipcType === 'main') {
      const { ipcMain } = require('electron');
      ipcMain.on(channel, (event: IpcMainEvent, ...args: any[]) => {
        this.emit(channel, event, ...args);
      });
    } else {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any[]) => {
        this.emit(channel, event, ...args);
      });
    }
  }

  send(channel: string, ...args: any[]): void {
    if (!this.channels.has(channel)) {
      throw new Error(`Channel ${channel} not registered`);
    }

    if (this.ipcType === 'main') {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((window: import('electron').BrowserWindow) => {
        window.webContents.send(channel, ...args);
      });
    } else {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send(channel, ...args);
    }
  }

  unregisterChannel(channel: string): void {
    if (!this.channels.has(channel)) return;

    if (this.ipcType === 'main') {
      const { ipcMain } = require('electron');
      ipcMain.removeAllListeners(channel);
    } else {
      const { ipcRenderer } = require('electron');
      ipcRenderer.removeAllListeners(channel);
    }

    this.channels.delete(channel);
  }
}