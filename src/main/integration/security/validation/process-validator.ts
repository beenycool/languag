/**
 * @file Performs security validation related to processes.
 */
// import { logger } from '../../../services/logger';
import { SecurityManager } from '../../common/security-manager';
import { ProcessConfig, ProcessInfo, ProcessState } from '../../types/process-types';
import { SecurityPrincipal, PermissionLevel, SecurityContext } from '../../types/security-types';
// import { ResourceMonitor, MonitoredProcessInfo } from '../../services/process/resource-monitor'; // If checking resource limits

export interface ProcessValidationOptions {
  expectedContext?: SecurityContext;
  maxCpuPercentage?: number; // Requires ResourceMonitor integration
  maxMemoryMb?: number;      // Requires ResourceMonitor integration
  allowedPaths?: RegExp[];   // For validating process executable path
  disallowedPaths?: RegExp[];
}

export interface ProcessValidationResult {
  isValid: boolean;
  issues: string[];
}

const DEFAULT_PROCESS_VALIDATION_OPTIONS: Partial<ProcessValidationOptions> = {
  // No default CPU/memory limits here, should be configured per process type
  allowedPaths: [/^(\/usr\/bin\/|C:\\Program Files\\)/], // Example: only allow from standard locations
  disallowedPaths: [/(\/tmp\/|\/var\/tmp\/|C:\\Users\\.*\\AppData\\Local\\Temp\\)/], // Example: disallow from temp dirs
};

export class ProcessValidator {
  private securityManager: SecurityManager;
  // private resourceMonitor?: ResourceMonitor;

  constructor(
    securityManager: SecurityManager
    // resourceMonitor?: ResourceMonitor
  ) {
    this.securityManager = securityManager;
    // this.resourceMonitor = resourceMonitor;
    // logger.info('ProcessValidator initialized.');
    console.info('ProcessValidator initialized.');
  }

  /**
   * Validates a process configuration before it's started.
   * @param processConfig The configuration of the process to be started.
   * @param principal The principal attempting to start the process.
   * @param options Validation options.
   * @returns A ProcessValidationResult object.
   */
  async validateConfig(
    processConfig: ProcessConfig,
    principal: SecurityPrincipal, // Principal attempting to start the process
    options?: ProcessValidationOptions
  ): Promise<ProcessValidationResult> {
    const effectiveOptions = { ...DEFAULT_PROCESS_VALIDATION_OPTIONS, ...options };
    const issues: string[] = [];

    // 1. Permission Check: Can the principal start this type of process?
    // Resource could be "process://start/${processConfig.name}" or based on path
    const resourceString = `process://config/${processConfig.name || processConfig.path}`;
    if (!this.securityManager.canAccess(principal, resourceString, PermissionLevel.EXECUTE)) {
      issues.push(`Principal ${principal.id} (${principal.context}) lacks EXECUTE permission for process resource ${resourceString}.`);
    }

    // 2. Path Validation
    if (effectiveOptions.allowedPaths) {
      if (!effectiveOptions.allowedPaths.some(pattern => pattern.test(processConfig.path))) {
        issues.push(`Process path '${processConfig.path}' is not in allowed locations.`);
      }
    }
    if (effectiveOptions.disallowedPaths) {
      if (effectiveOptions.disallowedPaths.some(pattern => pattern.test(processConfig.path))) {
        issues.push(`Process path '${processConfig.path}' is in a disallowed location.`);
      }
    }

    // 3. Expected Context (if the process is meant to run in a specific security context)
    // This is more about the nature of the process itself, less about the 'principal' starting it.
    // For instance, a 'worker' process should have a config that reflects it's a worker.
    // This might be better handled by ProcessManager or by having typed ProcessConfigs.
    if (effectiveOptions.expectedContext) {
        // This check is conceptual: how do we know the 'intended' context from ProcessConfig alone?
        // It might be part of processConfig.name, or a custom property in a more specific ProcessConfig type.
        // logger.debug(`ProcessValidator: Expected context check for ${processConfig.id} - ${effectiveOptions.expectedContext} (conceptual).`);
        console.debug(`ProcessValidator: Expected context check for ${processConfig.id} - ${effectiveOptions.expectedContext} (conceptual).`);
    }


    const isValid = issues.length === 0;
    if (isValid) {
      // logger.info(`ProcessValidator: Process configuration for '${processConfig.id}' passed validation.`);
      console.info(`ProcessValidator: Process configuration for '${processConfig.id}' passed validation.`);
    } else {
      // logger.warn(`ProcessValidator: Process configuration for '${processConfig.id}' failed validation.`, { issues });
      console.warn(`ProcessValidator: Process configuration for '${processConfig.id}' failed validation.`, { issues });
    }
    return { isValid, issues };
  }

  /**
   * Validates a running process's state or resource usage.
   * Requires ResourceMonitor for CPU/memory checks.
   * @param processInfo Information about the running process.
   * @param options Validation options.
   * @returns A ProcessValidationResult object.
   */
  async validateRunningProcess(
    processInfo: ProcessInfo, // Potentially MonitoredProcessInfo if enriched by ResourceMonitor
    options?: ProcessValidationOptions
  ): Promise<ProcessValidationResult> {
    const effectiveOptions = { ...DEFAULT_PROCESS_VALIDATION_OPTIONS, ...options };
    const issues: string[] = [];

    if (processInfo.state === ProcessState.ERROR) {
      issues.push(`Process ${processInfo.pid} is in an error state.`);
    }

    // Resource limit checks (conceptual, needs ResourceMonitor integration)
    // const monitoredInfo = processInfo as MonitoredProcessInfo;
    // if (this.resourceMonitor && processInfo.pid) {
    //    const currentUsage = await this.resourceMonitor.getProcessResourceInfo(processInfo.pid);
    //    if (effectiveOptions.maxCpuPercentage && currentUsage.cpuUsagePercentage && currentUsage.cpuUsagePercentage > effectiveOptions.maxCpuPercentage) {
    //      issues.push(`Process ${processInfo.pid} CPU usage (${currentUsage.cpuUsagePercentage}%) exceeds limit (${effectiveOptions.maxCpuPercentage}%).`);
    //    }
    //    if (effectiveOptions.maxMemoryMb && currentUsage.memoryUsageMB && currentUsage.memoryUsageMB > effectiveOptions.maxMemoryMb) {
    //      issues.push(`Process ${processInfo.pid} Memory usage (${currentUsage.memoryUsageMB}MB) exceeds limit (${effectiveOptions.maxMemoryMb}MB).`);
    //    }
    // } else if (effectiveOptions.maxCpuPercentage || effectiveOptions.maxMemoryMb) {
    //    logger.warn('ProcessValidator: Resource limits specified but ResourceMonitor not available for running process check.');
    //    console.warn('ProcessValidator: Resource limits specified but ResourceMonitor not available for running process check.');
    // }


    const isValid = issues.length === 0;
     if (isValid) {
      // logger.info(`ProcessValidator: Running process ${processInfo.pid} passed validation checks.`);
      console.info(`ProcessValidator: Running process ${processInfo.pid} passed validation checks.`);
    } else {
      // logger.warn(`ProcessValidator: Running process ${processInfo.pid} failed validation checks.`, { issues });
      console.warn(`ProcessValidator: Running process ${processInfo.pid} failed validation checks.`, { issues });
    }
    return { isValid, issues };
  }
}