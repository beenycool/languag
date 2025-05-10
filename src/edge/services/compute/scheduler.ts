export class EdgeScheduler {
  private taskQueue: EdgeTask[] = [];
  
  addTask(task: EdgeTask) {
    this.taskQueue.push(task);
    this.optimizeQueue();
  }

  private optimizeQueue() {
    this.taskQueue.sort((a, b) => 
      b.requirements.compute - a.requirements.compute || 
      b.requirements.memory - a.requirements.memory
    );
  }

  getNextTask(): EdgeTask | undefined {
    return this.taskQueue.shift();
  }

  getQueueSize(): number {
    return this.taskQueue.length;
  }
}

export type EdgeTask = {
  id: string;
  requirements: {
    compute: number;
    memory: number;
  };
  payload: any;
};