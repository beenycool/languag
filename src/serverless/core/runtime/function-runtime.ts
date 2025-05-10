interface ExecutionContext {
  requestId: string;
  memoryLimit?: string;
}

interface ExecutionMetrics {
  duration: number;
  memoryUsed: number;
  coldStart: boolean;
  executionId: string;
}

export class FunctionRuntime {
  private activeExecutions = new Set<string>();

  execute(id: string, fn: Function, context: ExecutionContext) {
    const startTime = Date.now();
    const execContext = {
      ...context,
      memoryLimit: context.memoryLimit || process.env.MEMORY_LIMIT || '256MB'
    };

    this.activeExecutions.add(id);

    try {
      const result = fn();
      return {
        result,
        metrics: this.getMetrics(startTime, execContext.requestId)
      };
    } catch (error) {
      throw error;
    } finally {
      this.activeExecutions.delete(id);
    }
  }

  private getMetrics(start: number, requestId: string): ExecutionMetrics {
    return {
      duration: Date.now() - start,
      memoryUsed: process.memoryUsage().heapUsed,
      coldStart: this.isColdStart(),
      executionId: requestId
    };
  }

  private isColdStart(): boolean {
    return this.activeExecutions.size === 0;
  }
}