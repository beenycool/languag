/**
 * @file Manages the lifecycle of child processes.
 */
import { spawn, ChildProcess } from 'child_process';
import { ProcessConfig, ProcessInfo, ProcessState, ProcessId } from '../types/process-types';
import { Message, MessageType } from '../types/message-types';
// Assuming a logger service exists, similar to other parts of the project
// import { logger } from '../../services/logger';

interface ManagedProcess {
  config: ProcessConfig;
  instance?: ChildProcess;
  info: ProcessInfo;
}

export class ProcessManager {
  private processes: Map<ProcessId, ManagedProcess> = new Map();

  constructor() {
    // Initialization, e.g., load process configurations
  }

  /**
   * Starts a new process based on the given configuration.
   * @param config The configuration for the process to start.
   * @returns The ID of the started process, or null if failed.
   */
  async startProcess(config: ProcessConfig): Promise<ProcessId | null> {
    if (this.processes.has(config.id) && this.processes.get(config.id)?.info.state === ProcessState.RUNNING) {
      // logger.warn(`Process ${config.id} is already running.`);
      console.warn(`Process ${config.id} is already running.`);
      return config.id;
    }

    try {
      const childProcessArgs = config.args || [];
      const child: ChildProcess = spawn(config.path, childProcessArgs, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // For IPC communication
      });

      if (!child.pid) {
        // logger.error(`Failed to get PID for process ${config.id}.`);
        console.error(`Failed to get PID for process ${config.id}.`);
        const managedProcessEntry = this.processes.get(config.id);
        if (managedProcessEntry) {
            managedProcessEntry.info.state = ProcessState.ERROR;
        }
        return null;
      }

      const processInfo: ProcessInfo = {
        pid: child.pid,
        state: ProcessState.RUNNING,
        startTime: Date.now(),
      };

      this.processes.set(config.id, { config, instance: child, info: processInfo });
      // logger.info(`Process ${config.id} (PID: ${child.pid}) started.`);
      console.info(`Process ${config.id} (PID: ${child.pid}) started.`);

      child.on('message', (message: Message<unknown>) => this.handleProcessMessage(config.id, message));
      child.on('error', (error: Error) => this.handleProcessError(config.id, error));
      child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => this.handleProcessExit(config.id, code, signal));

      child.stdout?.on('data', (data: Buffer | string) => {
        // logger.info(`[${config.id}-stdout]: ${data.toString().trim()}`);
        console.info(`[${config.id}-stdout]: ${data.toString().trim()}`);
      });
      child.stderr?.on('data', (data: Buffer | string) => {
        // logger.error(`[${config.id}-stderr]: ${data.toString().trim()}`);
        console.error(`[${config.id}-stderr]: ${data.toString().trim()}`);
      });

      return config.id;
    } catch (error: any) {
      // logger.error(`Failed to start process ${config.id}:`, error);
      console.error(`Failed to start process ${config.id}:`, error);
      const managedProcess = this.processes.get(config.id);
      if (managedProcess) {
        managedProcess.info.state = ProcessState.ERROR;
      }
      return null;
    }
  }

  /**
   * Stops a running process.
   * @param id The ID of the process to stop.
   * @returns True if the process was signaled to stop, false otherwise.
   */
  async stopProcess(id: ProcessId): Promise<boolean> {
    const managedProcess = this.processes.get(id);
    if (!managedProcess || !managedProcess.instance) {
      // logger.warn(`Process ${id} not found or not running.`);
      console.warn(`Process ${id} not found or not running.`);
      return false;
    }

    try {
      const killed = managedProcess.instance.kill();
      if (killed) {
        // logger.info(`Sent kill signal to process ${id} (PID: ${managedProcess.info.pid}).`);
        console.info(`Sent kill signal to process ${id} (PID: ${managedProcess.info.pid}).`);
        managedProcess.info.state = ProcessState.STOPPED; // Optimistic update
      } else {
        // logger.warn(`Failed to send kill signal to process ${id}. It might have already exited.`);
        console.warn(`Failed to send kill signal to process ${id}. It might have already exited.`);
      }
      return killed;
    } catch (error) {
      // logger.error(`Error stopping process ${id}:`, error);
      console.error(`Error stopping process ${id}:`, error);
      managedProcess.info.state = ProcessState.ERROR;
      return false;
    }
  }

  /**
   * Restarts a process.
   * @param id The ID of the process to restart.
   * @returns The ID of the restarted process, or null if failed.
   */
  async restartProcess(id: ProcessId): Promise<ProcessId | null> {
    const managedProcess = this.processes.get(id);
    if (!managedProcess) {
      // logger.warn(`Process ${id} not found for restart.`);
      console.warn(`Process ${id} not found for restart.`);
      return null;
    }
    await this.stopProcess(id);
    // Add a small delay to ensure the process has fully stopped
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.startProcess(managedProcess.config);
  }

  /**
   * Sends a message to a specific process.
   * @param targetProcessId The ID of the target process.
   * @param message The message to send.
   * @returns True if the message was sent, false otherwise.
   */
  sendMessage<T>(targetProcessId: ProcessId, message: Message<T>): boolean {
    const managedProcess = this.processes.get(targetProcessId);
    if (!managedProcess || !managedProcess.instance || !managedProcess.instance.send) {
      // logger.warn(`Process ${targetProcessId} not found or IPC not available.`);
      console.warn(`Process ${targetProcessId} not found or IPC not available.`);
      return false;
    }

    try {
      managedProcess.instance.send(message);
      // logger.debug(`Message sent to process ${targetProcessId}:`, message.header.type);
      console.debug(`Message sent to process ${targetProcessId}:`, message.header.type);
      return true;
    } catch (error) {
      // logger.error(`Failed to send message to process ${targetProcessId}:`, error);
      console.error(`Failed to send message to process ${targetProcessId}:`, error);
      return false;
    }
  }

  /**
   * Retrieves information about a specific process.
   * @param id The ID of the process.
   * @returns ProcessInfo or undefined if not found.
   */
  getProcessInfo(id: ProcessId): ProcessInfo | undefined {
    return this.processes.get(id)?.info;
  }

  /**
   * Retrieves information for all managed processes.
   * @returns A map of ProcessId to ProcessInfo.
   */
  getAllProcessInfo(): Map<ProcessId, ProcessInfo> {
    const allInfo = new Map<ProcessId, ProcessInfo>();
    this.processes.forEach((proc, id) => {
      allInfo.set(id, proc.info);
    });
    return allInfo;
  }

  private handleProcessMessage(processId: ProcessId, message: Message) {
    // logger.debug(`Message received from process ${processId}:`, message);
    console.debug(`Message received from process ${processId}:`, message);
    // Potentially forward to a message bus or handle directly
    // Example: if (message.header.type === MessageType.EVENT) { this.messageBus.publish(message); }
  }

  private handleProcessError(processId: ProcessId, error: Error) {
    // logger.error(`Process ${processId} encountered an error:`, error);
    console.error(`Process ${processId} encountered an error:`, error);
    const managedProcess = this.processes.get(processId);
    if (managedProcess) {
      managedProcess.info.state = ProcessState.ERROR;
    }
  }

  private handleProcessExit(processId: ProcessId, code: number | null, signal: NodeJS.Signals | null) {
    // logger.info(`Process ${processId} exited with code ${code} and signal ${signal}.`);
    console.info(`Process ${processId} exited with code ${code} and signal ${signal}.`);
    const managedProcess = this.processes.get(processId);
    if (managedProcess) {
      managedProcess.info.state = ProcessState.STOPPED;
      // Clean up
      managedProcess.instance?.removeAllListeners();
      // Optionally remove from map or mark as stopped for potential restart
      // this.processes.delete(processId);
    }
  }

  /**
   * Stops all managed processes.
   */
  async stopAllProcesses(): Promise<void> {
    // logger.info('Stopping all managed processes...');
    console.info('Stopping all managed processes...');
    const stopPromises: Promise<boolean>[] = [];
    this.processes.forEach((_proc, id) => {
      stopPromises.push(this.stopProcess(id));
    });
    await Promise.all(stopPromises);
    // logger.info('All managed processes have been signaled to stop.');
    console.info('All managed processes have been signaled to stop.');
  }
}