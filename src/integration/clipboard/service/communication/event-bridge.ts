import { EventEmitter } from 'events';
import { IpcHandler } from './ipc-handler';

export class EventBridge extends EventEmitter {
  private ipcHandler: IpcHandler;
  private localEvents: Set<string> = new Set();

  constructor(ipcType: 'main' | 'renderer') {
    super();
    this.ipcHandler = new IpcHandler(ipcType);
  }

  registerEvent(eventName: string): void {
    if (this.localEvents.has(eventName)) return;
    
    this.localEvents.add(eventName);
    this.ipcHandler.registerChannel(`event-bridge:${eventName}`);

    // Forward local events to IPC
    this.on(eventName, (...args: any[]) => {
      this.ipcHandler.send(`event-bridge:${eventName}`, ...args);
    });

    // Forward IPC events to local
    this.ipcHandler.on(`event-bridge:${eventName}`, (event, ...args) => {
      super.emit(eventName, ...args);
    });
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    if (typeof eventName === 'string' && this.localEvents.has(eventName)) {
      this.ipcHandler.send(`event-bridge:${eventName}`, ...args);
    }
    return super.emit(eventName, ...args);
  }
}