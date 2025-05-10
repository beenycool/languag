// src/microservices/core/communication/event-bus.ts

/**
 * @interface IEvent
 * Represents a generic event structure.
 */
export interface IEvent<T = any> {
  id: string; // Unique event identifier
  type: string; // Type of the event, e.g., "UserCreated", "OrderPlaced"
  source: string; // Origin service or component of the event
  payload: T;
  timestamp: number;
  correlationId?: string; // For tracking related events
  metadata?: Record<string, any>;
}

/**
 * @type EventHandler
 * Defines the signature for an event handling function.
 * @param event - The event received.
 * @returns A promise that resolves when event processing is complete.
 */
export type EventHandler<T = any> = (event: IEvent<T>) => Promise<void>;

/**
 * @interface IEventBus
 * Defines the contract for an event bus.
 */
export interface IEventBus {
  /**
   * Publishes an event to the bus.
   * @param eventType - The type of the event.
   * @param source - The source of the event.
   * @param payload - The event payload.
   * @param correlationId - Optional correlation ID.
   * @param metadata - Optional metadata for the event.
   * @returns A promise that resolves when the event is successfully published.
   */
  publish<T = any>(
    eventType: string,
    source: string,
    payload: T,
    correlationId?: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Subscribes to a specific event type.
   * @param eventType - The type of event to subscribe to. Can be a specific type or a wildcard (e.g., "Order.*").
   * @param handler - The function to call when an event of this type is received.
   * @param subscriberId - Optional unique ID for the subscriber (useful for durable subscriptions or logging).
   * @returns A promise that resolves to an unsubscribe function.
   */
  subscribe<T = any>(eventType: string, handler: EventHandler<T>, subscriberId?: string): Promise<() => Promise<void>>;

  /**
   * Connects to the event bus infrastructure (if applicable).
   * @returns A promise that resolves when the connection is established.
   */
  connect(): Promise<void>;

  /**
   * Disconnects from the event bus infrastructure.
   * @returns A promise that resolves when the disconnection is complete.
   */
  disconnect(): Promise<void>;
}

/**
 * @class InMemoryEventBus
 * A basic in-memory implementation of an event bus.
 * Suitable for local development, testing, or simple in-process eventing.
 * Not suitable for distributed systems requiring persistence or inter-service communication across processes/networks.
 * For distributed scenarios, consider using a message broker (like Kafka, RabbitMQ) as the backbone for the event bus.
 */
export class InMemoryEventBus implements IEventBus {
  // Stores handlers: eventType -> Set of handlers
  private handlers: Map<string, Set<EventHandler<any>>>;
  // Stores handlers with wildcards: wildcardPattern -> Set of handlers
  private wildcardHandlers: Map<RegExp, Set<EventHandler<any>>>;
  private isConnected: boolean;

  constructor() {
    this.handlers = new Map();
    this.wildcardHandlers = new Map();
    this.isConnected = false;
    console.log('InMemoryEventBus initialized.');
  }

  public async connect(): Promise<void> {
    this.isConnected = true;
    console.log('InMemoryEventBus connected.');
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('InMemoryEventBus disconnected.');
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Event bus is not connected. Call connect() first.');
    }
  }

  private generateEventId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  public async publish<T = any>(
    eventType: string,
    source: string,
    payload: T,
    correlationId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.ensureConnected();
    const event: IEvent<T> = {
      id: this.generateEventId(),
      type: eventType,
      source,
      payload,
      timestamp: Date.now(),
      correlationId,
      metadata,
    };

    console.log(`Publishing event "${event.type}" (ID: ${event.id}) from source "${event.source}"`);

    // Notify specific handlers
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType)!.forEach(handler => {
        handler(event).catch(err => console.error(`Error in specific event handler for "${eventType}":`, err));
      });
    }

    // Notify wildcard handlers
    this.wildcardHandlers.forEach((handlersSet, pattern) => {
      if (pattern.test(eventType)) {
        handlersSet.forEach(handler => {
          handler(event).catch(err => console.error(`Error in wildcard event handler (pattern: ${pattern}) for "${eventType}":`, err));
        });
      }
    });
  }

  public async subscribe<T = any>(
    eventTypeOrPattern: string,
    handler: EventHandler<T>,
    subscriberId?: string // Not actively used in this simple implementation but good for interface consistency
  ): Promise<() => Promise<void>> {
    this.ensureConnected();
    console.log(`Subscribing to event type/pattern "${eventTypeOrPattern}"${subscriberId ? ` (Subscriber ID: ${subscriberId})` : ''}`);

    const isWildcard = eventTypeOrPattern.includes('*');
    let patternRegExp: RegExp | null = null;

    if (isWildcard) {
      try {
        // Convert simple wildcard to regex: 'Order.*' becomes /^Order\..*$/
        const regexString = '^' + eventTypeOrPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        patternRegExp = new RegExp(regexString);
        if (!this.wildcardHandlers.has(patternRegExp)) {
          this.wildcardHandlers.set(patternRegExp, new Set());
        }
        this.wildcardHandlers.get(patternRegExp)!.add(handler);
      } catch (error) {
        console.error(`Invalid wildcard pattern "${eventTypeOrPattern}":`, error);
        throw new Error(`Invalid wildcard pattern: ${eventTypeOrPattern}`);
      }
    } else {
      if (!this.handlers.has(eventTypeOrPattern)) {
        this.handlers.set(eventTypeOrPattern, new Set());
      }
      this.handlers.get(eventTypeOrPattern)!.add(handler);
    }

    return async () => {
      console.log(`Unsubscribing from event type/pattern "${eventTypeOrPattern}"${subscriberId ? ` (Subscriber ID: ${subscriberId})` : ''}`);
      if (isWildcard && patternRegExp && this.wildcardHandlers.has(patternRegExp)) {
        this.wildcardHandlers.get(patternRegExp)!.delete(handler);
        if (this.wildcardHandlers.get(patternRegExp)!.size === 0) {
          this.wildcardHandlers.delete(patternRegExp);
        }
      } else if (!isWildcard && this.handlers.has(eventTypeOrPattern)) {
        this.handlers.get(eventTypeOrPattern)!.delete(handler);
        if (this.handlers.get(eventTypeOrPattern)!.size === 0) {
          this.handlers.delete(eventTypeOrPattern);
        }
      }
    };
  }
}