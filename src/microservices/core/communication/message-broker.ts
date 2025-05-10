// src/microservices/core/communication/message-broker.ts

/**
 * @interface IMessage
 * Represents a generic message structure.
 */
export interface IMessage<T = any> {
  id: string; // Unique message identifier
  topic: string; // Topic or queue name
  payload: T;
  timestamp: number;
  metadata?: Record<string, any>; // For correlation IDs, sender info, etc.
}

/**
 * @type MessageHandler
 * Defines the signature for a message handling function.
 * @param message - The message received.
 * @returns A promise that resolves when message processing is complete.
 */
export type MessageHandler<T = any> = (message: IMessage<T>) => Promise<void>;

/**
 * @interface IMessageBroker
 * Defines the contract for a message broker.
 */
export interface IMessageBroker {
  /**
   * Publishes a message to a specific topic.
   * @param topic - The topic to publish the message to.
   * @param payload - The message payload.
   * @param metadata - Optional metadata for the message.
   * @returns A promise that resolves when the message is successfully published.
   */
  publish<T = any>(topic: string, payload: T, metadata?: Record<string, any>): Promise<void>;

  /**
   * Subscribes to a topic to receive messages.
   * @param topic - The topic to subscribe to.
   * @param handler - The function to call when a message is received on this topic.
   * @param groupId - Optional consumer group ID for load balancing among subscribers.
   * @returns A promise that resolves to an unsubscribe function.
   */
  subscribe<T = any>(topic: string, handler: MessageHandler<T>, groupId?: string): Promise<() => Promise<void>>;

  /**
   * Connects to the message broker.
   * @returns A promise that resolves when the connection is established.
   */
  connect(): Promise<void>;

  /**
   * Disconnects from the message broker.
   * @returns A promise that resolves when the disconnection is complete.
   */
  disconnect(): Promise<void>;
}

/**
 * @class InMemoryMessageBroker
 * A basic in-memory implementation of a message broker.
 * Suitable for local development and testing, not for production.
 * For production, consider using Kafka, RabbitMQ, Redis Streams, etc.
 */
export class InMemoryMessageBroker implements IMessageBroker {
  private topics: Map<string, Set<MessageHandler<any>>>;
  // For group-based subscriptions (simplified for this example)
  private groupSubscribers: Map<string, Map<string, MessageHandler<any>[]>>; // topic -> groupId -> handlers[]
  private isConnected: boolean;

  constructor() {
    this.topics = new Map();
    this.groupSubscribers = new Map();
    this.isConnected = false;
    console.log('InMemoryMessageBroker initialized.');
  }

  public async connect(): Promise<void> {
    this.isConnected = true;
    console.log('InMemoryMessageBroker connected.');
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('InMemoryMessageBroker disconnected.');
    // In a real broker, this would involve cleaning up connections, resources, etc.
    this.topics.clear();
    this.groupSubscribers.clear();
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Message broker is not connected. Call connect() first.');
    }
  }

  public async publish<T = any>(topic: string, payload: T, metadata?: Record<string, any>): Promise<void> {
    this.ensureConnected();
    const message: IMessage<T> = {
      id: this.generateMessageId(),
      topic,
      payload,
      timestamp: Date.now(),
      metadata,
    };

    console.log(`Publishing message to topic "${topic}":`, message.id);

    // Handle direct subscribers
    if (this.topics.has(topic)) {
      this.topics.get(topic)!.forEach(handler => {
        handler(message).catch(err => console.error(`Error in direct subscriber for topic ${topic}:`, err));
      });
    }

    // Handle group subscribers (simplified round-robin for groups)
    if (this.groupSubscribers.has(topic)) {
      const groups = this.groupSubscribers.get(topic)!;
      groups.forEach((handlers, groupId) => {
        if (handlers.length > 0) {
          // Simple round-robin: pick one handler from the group
          // A real broker would have more sophisticated group management
          const handlerIndex = (this.getMessageCountForGroup(topic, groupId) || 0) % handlers.length;
          const selectedHandler = handlers[handlerIndex];
          selectedHandler(message).catch(err => console.error(`Error in group subscriber (${groupId}) for topic ${topic}:`, err));
          this.incrementMessageCountForGroup(topic, groupId);
        }
      });
    }
  }

  public async subscribe<T = any>(
    topic: string,
    handler: MessageHandler<T>,
    groupId?: string
  ): Promise<() => Promise<void>> {
    this.ensureConnected();
    console.log(`Subscribing to topic "${topic}"${groupId ? ` with group "${groupId}"` : ''}`);

    if (groupId) {
      if (!this.groupSubscribers.has(topic)) {
        this.groupSubscribers.set(topic, new Map());
      }
      if (!this.groupSubscribers.get(topic)!.has(groupId)) {
        this.groupSubscribers.get(topic)!.set(groupId, []);
      }
      this.groupSubscribers.get(topic)!.get(groupId)!.push(handler);
    } else {
      if (!this.topics.has(topic)) {
        this.topics.set(topic, new Set());
      }
      this.topics.get(topic)!.add(handler);
    }

    return async () => {
      console.log(`Unsubscribing from topic "${topic}"${groupId ? ` with group "${groupId}"` : ''}`);
      if (groupId) {
        if (this.groupSubscribers.has(topic) && this.groupSubscribers.get(topic)!.has(groupId)) {
          const handlers = this.groupSubscribers.get(topic)!.get(groupId)!;
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
          if (handlers.length === 0) {
            this.groupSubscribers.get(topic)!.delete(groupId);
            if (this.groupSubscribers.get(topic)!.size === 0) {
              this.groupSubscribers.delete(topic);
            }
          }
        }
      } else {
        if (this.topics.has(topic)) {
          this.topics.get(topic)!.delete(handler);
          if (this.topics.get(topic)!.size === 0) {
            this.topics.delete(topic);
          }
        }
      }
    };
  }

  private generateMessageId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Helper for simplified group round-robin
  private messageCountsForGroups: Map<string, number> = new Map(); // key: topic:groupId
  private getMessageCountForGroup(topic: string, groupId: string): number {
    return this.messageCountsForGroups.get(`${topic}:${groupId}`) || 0;
  }
  private incrementMessageCountForGroup(topic: string, groupId: string): void {
    const key = `${topic}:${groupId}`;
    this.messageCountsForGroups.set(key, (this.messageCountsForGroups.get(key) || 0) + 1);
  }
}