export class EdgeRuntime {
  private nodes = new Map<string, EdgeNode>();
  
  registerNode(node: EdgeNode) {
    this.nodes.set(node.id, node);
  }

  executeTask(task: EdgeTask): Promise<any> {
    const node = this.selectNode(task);
    return node.execute(task);
  }

  private selectNode(task: EdgeTask): EdgeNode {
    // Simple round-robin selection
    return Array.from(this.nodes.values())[
      Math.floor(Math.random() * this.nodes.size)
    ];
  }
}

export interface EdgeNode {
  id: string;
  capacity: number;
  execute(task: EdgeTask): Promise<any>;
}

export type EdgeTask = {
  id: string;
  requirements: {
    compute: number;
    memory: number;
  };
  payload: any;
};