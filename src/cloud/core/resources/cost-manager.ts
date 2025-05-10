type CostEntry = {
  resourceId: string;
  cost: number;
  timestamp: Date;
};

export class CostManager {
  private costs = new Map<string, CostEntry[]>();

  addCost(resourceId: string, cost: number) {
    const entry = { resourceId, cost, timestamp: new Date() };
    const entries = this.costs.get(resourceId) || [];
    entries.push(entry);
    this.costs.set(resourceId, entries);
  }

  getCosts(resourceId: string) {
    return this.costs.get(resourceId) || [];
  }

  getTotalCost(resourceId: string) {
    return this.getCosts(resourceId).reduce((sum, entry) => sum + entry.cost, 0);
  }

  getMonthlyCost(resourceId: string, year: number, month: number) {
    return this.getCosts(resourceId)
      .filter(entry => 
        entry.timestamp.getFullYear() === year && 
        entry.timestamp.getMonth() === month - 1
      )
      .reduce((sum, entry) => sum + entry.cost, 0);
  }
}