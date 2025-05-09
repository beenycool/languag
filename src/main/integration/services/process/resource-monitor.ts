/**
 * @file Monitors system and process resources.
 */
import { ProcessManager } from '../../common/process-manager';
import { ProcessId, ProcessInfo, ProcessState } from '../../types/process-types';
// import { logger } from '../../../services/logger';
import os from 'os';
import { exec } from 'child_process';

export interface SystemResourceInfo {
  totalMemoryMB: number;
  freeMemoryMB: number;
  cpuLoadPercentage: number; // Average load across all CPUs
  uptimeSeconds: number;
}

export interface MonitoredProcessInfo extends ProcessInfo {
  cpuUsagePercentage?: number; // Process specific CPU usage
  memoryUsageMB?: number;      // Process specific memory usage
}

export class ResourceMonitor {
  private processManager?: ProcessManager;
  private intervalId?: NodeJS.Timeout;
  private monitoringIntervalMs: number;

  constructor(monitoringIntervalMs: number = 5000, processManager?: ProcessManager) {
    this.monitoringIntervalMs = monitoringIntervalMs;
    this.processManager = processManager;
    // logger.info(`ResourceMonitor initialized with interval ${monitoringIntervalMs}ms.`);
    console.info(`ResourceMonitor initialized with interval ${monitoringIntervalMs}ms.`);
  }

  startMonitoring(): void {
    if (this.intervalId) {
      // logger.warn('ResourceMonitor: Monitoring is already active.');
      console.warn('ResourceMonitor: Monitoring is already active.');
      return;
    }
    // logger.info('ResourceMonitor: Starting resource monitoring.');
    console.info('ResourceMonitor: Starting resource monitoring.');
    this.intervalId = setInterval(async () => {
      await this.collectAndLogResourceInfo();
    }, this.monitoringIntervalMs);
    // Initial collection
    this.collectAndLogResourceInfo();
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      // logger.info('ResourceMonitor: Stopped resource monitoring.');
      console.info('ResourceMonitor: Stopped resource monitoring.');
    }
  }

  async getSystemResourceInfo(): Promise<SystemResourceInfo> {
    const totalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemoryMB = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    // Calculate average CPU load (simplified)
    // For a more accurate load, you'd compare cpu times between intervals.
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });
    const avgIdle = totalIdle / cpus.length;
    const avgTotal = totalTick / cpus.length;
    const cpuLoadPercentage = Math.round(((avgTotal - avgIdle) / avgTotal) * 100);


    return {
      totalMemoryMB,
      freeMemoryMB,
      cpuLoadPercentage: isNaN(cpuLoadPercentage) ? 0 : cpuLoadPercentage, // os.loadavg() might be better for system load
      uptimeSeconds: Math.round(os.uptime()),
    };
  }

  async getProcessResourceInfo(pid: number): Promise<Partial<MonitoredProcessInfo>> {
    // This is highly OS-dependent for external processes.
    // Node.js `process.cpuUsage()` and `process.memoryUsage()` are for the current process.
    if (pid === process.pid) {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage(); // Returns user and system CPU time in microseconds
      return {
        memoryUsageMB: Math.round(memUsage.rss / (1024 * 1024)), // Resident Set Size
        // CPU usage percentage requires calculation over an interval.
        // This is instantaneous CPU time, not percentage.
        // cpuUsagePercentage: calculateCpuPercentage(cpuUsage, previousCpuUsage, intervalMs)
      };
    }

    // Placeholder for external process monitoring (requires OS commands or libraries)
    // logger.debug(`ResourceMonitor: Fetching resource info for external PID ${pid} (placeholder).`);
    console.debug(`ResourceMonitor: Fetching resource info for external PID ${pid} (placeholder).`);
    return new Promise((resolve) => {
        if (os.platform() === 'win32') {
            exec(`tasklist /fi "pid eq ${pid}" /fo csv /nh`, (err, stdout) => {
                if (err || !stdout) return resolve({});
                const parts = stdout.trim().split(',');
                if (parts.length >= 5) {
                    const memPart = parts[4].replace(/"/g, '').replace(/[^\d]/g, ''); // "12,345 K" -> "12345"
                    resolve({ memoryUsageMB: Math.round(parseInt(memPart) / 1024) });
                } else resolve({});
            });
        } else { // Linux, macOS
            exec(`ps -p ${pid} -o %cpu,rss --no-headers`, (err, stdout) => {
                if (err || !stdout) return resolve({});
                const parts = stdout.trim().split(/\s+/);
                if (parts.length >= 2) {
                    resolve({
                        cpuUsagePercentage: parseFloat(parts[0]),
                        memoryUsageMB: Math.round(parseInt(parts[1]) / 1024) // RSS is in KB
                    });
                } else resolve({});
            });
        }
    });
  }

  private async collectAndLogResourceInfo(): Promise<void> {
    try {
      const systemInfo = await this.getSystemResourceInfo();
      // logger.info('System Resources:', systemInfo);
      console.info('System Resources:', systemInfo);

      if (this.processManager) {
        const managedProcs = this.processManager.getAllProcessInfo();
        // logger.info(`Monitoring ${managedProcs.size} managed processes.`);
        console.info(`Monitoring ${managedProcs.size} managed processes.`);
        for (const [id, procInfo] of managedProcs) {
          if (procInfo.state === ProcessState.RUNNING && procInfo.pid) {
            const detailedInfo = await this.getProcessResourceInfo(procInfo.pid);
            const monitoredInfo: MonitoredProcessInfo = { ...procInfo, ...detailedInfo };
            // logger.info(`Process [${id}|${procInfo.pid}]: State=${monitoredInfo.state}, CPU=${monitoredInfo.cpuUsagePercentage || 'N/A'}%, Mem=${monitoredInfo.memoryUsageMB || 'N/A'}MB`);
            console.info(`Process [${id}|${procInfo.pid}]: State=${monitoredInfo.state}, CPU=${monitoredInfo.cpuUsagePercentage || 'N/A'}%, Mem=${monitoredInfo.memoryUsageMB || 'N/A'}MB`);
            // Here, you could emit events or trigger alerts if thresholds are exceeded
          }
        }
      } else {
         const mainProcessInfo = await this.getProcessResourceInfo(process.pid);
         // logger.info(`Main Process (PID: ${process.pid}): Mem=${mainProcessInfo.memoryUsageMB || 'N/A'}MB, CPU=${mainProcessInfo.cpuUsagePercentage || 'N/A'}% (Note: CPU% for main needs interval calc)`);
         console.info(`Main Process (PID: ${process.pid}): Mem=${mainProcessInfo.memoryUsageMB || 'N/A'}MB, CPU=${mainProcessInfo.cpuUsagePercentage || 'N/A'}% (Note: CPU% for main needs interval calc)`);
      }
    } catch (error) {
      // logger.error('ResourceMonitor: Error collecting resource info:', error);
      console.error('ResourceMonitor: Error collecting resource info:', error);
    }
  }
}

// Example usage:
// const monitor = new ResourceMonitor(10000); // Check every 10 seconds
// monitor.startMonitoring();
// Later: monitor.stopMonitoring();