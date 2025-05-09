/**
 * @file Defines types related to inter-process communication and management.
 */

export enum ProcessState {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface ProcessInfo {
  pid: number;
  state: ProcessState;
  startTime: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface ProcessConfig {
  id: string;
  name: string;
  path: string;
  args?: string[];
  env?: Record<string, string>;
}

export type ProcessId = string | number;