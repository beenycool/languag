type ExecutionContext = {
  requestId: string;
  functionVersion: string;
  env: Record<string, string>;
  deadline?: number;
};

export class ContextManager {
  private contexts = new Map<string, ExecutionContext>();
  private activeRequests = new Set<string>();

  create(context: Omit<ExecutionContext, 'requestId'>) {
    const requestId = crypto.randomUUID();
    const fullContext: ExecutionContext = {
      ...context,
      requestId,
      deadline: context.deadline || Date.now() + 15_000
    };
    
    this.contexts.set(requestId, fullContext);
    this.activeRequests.add(requestId);
    return fullContext;
  }

  get(requestId: string) {
    return this.contexts.get(requestId);
  }

  complete(requestId: string) {
    this.activeRequests.delete(requestId);
    this.contexts.delete(requestId);
  }

  getActiveCount() {
    return this.activeRequests.size;
  }
}