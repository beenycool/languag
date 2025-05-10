type MessageHandler = (topic: string, payload: unknown) => Promise<void>;

export class EdgeMessageBroker {
  private subscriptions = new Map<string, MessageHandler[]>();

  subscribe(topic: string, handler: MessageHandler): void {
    const handlers = this.subscriptions.get(topic) || [];
    this.subscriptions.set(topic, [...handlers, handler]);
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    const handlers = this.subscriptions.get(topic) || [];
    await Promise.all(handlers.map(h => h(topic, payload)));
  }

  clearSubscriptions(topic?: string): void {
    topic ? this.subscriptions.delete(topic) : this.subscriptions.clear();
  }
}