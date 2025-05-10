/**
 * @file Message Broker
 *
 * This file defines the core message broker interface and a basic implementation
 * for handling asynchronous message-based communication within the enterprise.
 * It supports point-to-point (queues) and publish-subscribe (topics) messaging.
 *
 * Focus areas:
 * - Reliability: Ensures message delivery guarantees (e.g., at-least-once, at-most-once).
 * - Scalability: Handles a high volume of messages and numerous connections.
 * - Enterprise security: Secures message transport and access to queues/topics.
 * - Performance monitoring: Tracks message throughput, latency, and queue depths.
 * - Error handling: Manages undeliverable messages (dead-letter queues) and broker errors.
 */

export interface IMessage {
  id: string;
  payload: any;
  contentType?: string; // e.g., 'application/json', 'application/xml', 'text/plain'
  correlationId?: string;
  replyTo?: string; // For request-reply patterns
  timestamp: Date;
  properties?: Record<string, any>; // Custom message headers/properties
  priority?: number;
  expiration?: string; // e.g., '60000' for 60 seconds
}

export interface IQueueConfig {
  name: string;
  durable?: boolean; // Should the queue survive broker restarts?
  exclusive?: boolean; // Used by only one connection and deleted when it closes
  autoDelete?: boolean; // Queue that has had at least one consumer is deleted when all consumers have unsubscribed
  // Add other queue-specific parameters like dead-letter-exchange, message-ttl, etc.
}

export interface ITopicConfig {
  name: string;
  durable?: boolean; // For durable subscriptions
  // Add other topic-specific parameters
}

export interface ISubscriptionOptions {
  ackMode: 'auto' | 'manual'; // Automatic or manual acknowledgement
  prefetchCount?: number; // Max number of unacknowledged messages for a consumer
}

export type MessageHandler = (message: IMessage) => Promise<void>;

interface IMessageBroker {
  /**
   * Connects to the message broker server.
   * @param connectionUri The URI for the broker (e.g., 'amqp://localhost').
   * @param credentials Optional credentials.
   */
  connect(connectionUri: string, credentials?: any): Promise<void>;

  /**
   * Disconnects from the message broker.
   */
  disconnect(): Promise<void>;

  /**
   * Declares a queue.
   * @param config Configuration for the queue.
   */
  declareQueue(config: IQueueConfig): Promise<void>;

  /**
   * Deletes a queue.
   * @param queueName The name of the queue to delete.
   */
  deleteQueue(queueName: string): Promise<void>;

  /**
   * Sends a message to a specific queue.
   * @param queueName The name of the target queue.
   * @param message The message to send.
   * @param options Optional send options (e.g., persistence).
   */
  sendMessageToQueue(queueName: string, message: IMessage, options?: any): Promise<void>;

  /**
   * Subscribes to a queue to receive messages.
   * @param queueName The name of the queue.
   * @param handler The function to process received messages.
   * @param options Subscription options.
   * @returns A promise that resolves with a subscription ID or object.
   */
  subscribeToQueue(queueName: string, handler: MessageHandler, options: ISubscriptionOptions): Promise<string>;

  /**
   * Declares a topic (exchange in AMQP terms).
   * @param config Configuration for the topic.
   */
  declareTopic(config: ITopicConfig): Promise<void>;

  /**
   * Publishes a message to a topic.
   * @param topicName The name of the target topic.
   * @param message The message to publish.
   * @param routingKey Optional routing key for topic-based routing.
   */
  publishToTopic(topicName: string, message: IMessage, routingKey?: string): Promise<void>;

  /**
   * Subscribes to a topic.
   * @param topicName The name of the topic.
   * @param handler The function to process received messages.
   * @param options Subscription options, including binding/routing keys.
   * @param bindingKeys Patterns to bind the subscription to (e.g. for AMQP topics)
   * @returns A promise that resolves with a subscription ID or object.
   */
  subscribeToTopic(topicName: string, handler: MessageHandler, options: ISubscriptionOptions, bindingKeys?: string[]): Promise<string>;

  /**
   * Acknowledges a message (if manual ack mode).
   * @param messageDeliveryTag The delivery tag or ID of the message to acknowledge.
   */
  ackMessage(messageDeliveryTag: any): Promise<void>;

  /**
   * Negatively acknowledges a message (if manual ack mode).
   * @param messageDeliveryTag The delivery tag or ID of the message.
   * @param requeue If true, the message will be requeued.
   */
  nackMessage(messageDeliveryTag: any, requeue: boolean): Promise<void>;

  /**
   * Unsubscribes a consumer.
   * @param subscriptionId The ID of the subscription to cancel.
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Checks the health of the connection to the broker.
   */
  checkHealth(): Promise<{ isConnected: boolean; details?: any }>;
}

// This is a conceptual base class or a very simple in-memory broker.
// Real implementations would wrap a client library for RabbitMQ, Kafka, ActiveMQ, etc.
export class BasicMessageBroker implements IMessageBroker {
  protected isConnectedState: boolean = false;
  protected connectionUri?: string;
  // In-memory structures for simulation
  private queues: Map<string, { config: IQueueConfig, messages: IMessage[] }> = new Map();
  private topics: Map<string, { config: ITopicConfig, subscriptions: Map<string, { handler: MessageHandler, options: ISubscriptionOptions, bindingKeys?: string[]}> }> = new Map();
  private queueSubscriptions: Map<string, { handler: MessageHandler, options: ISubscriptionOptions, queueName: string }> = new Map();
  private nextSubscriptionId = 1;


  constructor() {
    console.log('Basic Message Broker initialized (in-memory simulation).');
  }

  public get isConnected(): boolean {
    return this.isConnectedState;
  }

  async connect(connectionUri: string, credentials?: any): Promise<void> {
    this.connectionUri = connectionUri;
    this.isConnectedState = true;
    console.log(`Connected to message broker at ${connectionUri} (simulated). Credentials:`, credentials ? 'provided' : 'none');
  }

  async disconnect(): Promise<void> {
    this.isConnectedState = false;
    console.log('Disconnected from message broker (simulated).');
  }

  async declareQueue(config: IQueueConfig): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    if (!this.queues.has(config.name)) {
      this.queues.set(config.name, { config, messages: [] });
      console.log(`Queue '${config.name}' declared (simulated). Config:`, config);
    } else {
      console.log(`Queue '${config.name}' already exists (simulated).`);
    }
  }

  async deleteQueue(queueName: string): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    if (this.queues.has(queueName)) {
      this.queues.delete(queueName);
      // Also remove any subscriptions to this queue
      this.queueSubscriptions.forEach((sub, id) => {
        if (sub.queueName === queueName) {
          this.queueSubscriptions.delete(id);
        }
      });
      console.log(`Queue '${queueName}' deleted (simulated).`);
    } else {
      console.warn(`Queue '${queueName}' not found for deletion (simulated).`);
    }
  }

  async sendMessageToQueue(queueName: string, message: IMessage, options?: any): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found (simulated).`);
    }
    queue.messages.push(message);
    console.log(`Message ${message.id} sent to queue '${queueName}' (simulated). Options:`, options);

    // Simulate message delivery for active subscriptions
    this.queueSubscriptions.forEach(async (sub, subId) => {
        if (sub.queueName === queueName && queue.messages.length > 0) {
            const msgToDeliver = queue.messages.shift(); // FIFO
            if (msgToDeliver) {
                try {
                    await sub.handler(msgToDeliver);
                    if (sub.options.ackMode === 'manual') {
                        // In a real broker, this message would wait for ack/nack
                        console.log(`Message ${msgToDeliver.id} delivered to sub ${subId}, awaiting manual ack (simulated).`);
                    }
                } catch (err) {
                    console.error(`Error in handler for subscription ${subId} on queue ${queueName}:`, err);
                    // Requeue or DLQ logic would go here
                    queue.messages.unshift(msgToDeliver); // Simple requeue for simulation
                }
            }
        }
    });
  }

  async subscribeToQueue(queueName: string, handler: MessageHandler, options: ISubscriptionOptions): Promise<string> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    if (!this.queues.has(queueName)) {
      throw new Error(`Queue '${queueName}' not found for subscription (simulated).`);
    }
    const subscriptionId = `qsub-${this.nextSubscriptionId++}`;
    this.queueSubscriptions.set(subscriptionId, { handler, options, queueName });
    console.log(`Subscribed to queue '${queueName}' with ID ${subscriptionId} (simulated). Options:`, options);
    // Simulate delivering existing messages if any
    // This is a simplification; real brokers have more complex delivery mechanisms
    setTimeout(() => this.sendMessageToQueue(queueName, {id: 'flush-trigger', payload: null, timestamp: new Date()}), 0);
    return subscriptionId;
  }

  async declareTopic(config: ITopicConfig): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    if (!this.topics.has(config.name)) {
      this.topics.set(config.name, { config, subscriptions: new Map() });
      console.log(`Topic '${config.name}' declared (simulated). Config:`, config);
    } else {
      console.log(`Topic '${config.name}' already exists (simulated).`);
    }
  }

  async publishToTopic(topicName: string, message: IMessage, routingKey: string = ''): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic '${topicName}' not found (simulated).`);
    }
    console.log(`Message ${message.id} published to topic '${topicName}' with routingKey '${routingKey}' (simulated).`);

    // Simulate message delivery to matching topic subscriptions
    topic.subscriptions.forEach(async (sub, subId) => {
      const matchesBindingKey = sub.bindingKeys?.some(bk => {
        // Simplified wildcard matching: '*' matches one word, '#' matches zero or more words
        // Real AMQP matching is more complex.
        const regex = new RegExp('^' + bk.replace(/\./g, '\\.').replace(/\*/g, '[^.]+').replace(/#/g, '.*') + '$');
        return regex.test(routingKey);
      }) ?? true; // If no binding keys, assume it matches (like a fanout)

      if (matchesBindingKey) {
        try {
          await sub.handler(message);
          if (sub.options.ackMode === 'manual') {
            console.log(`Message ${message.id} delivered to topic sub ${subId}, awaiting manual ack (simulated).`);
          }
        } catch (err) {
          console.error(`Error in handler for topic subscription ${subId} on topic ${topicName}:`, err);
          // DLQ logic for topic messages would be more complex
        }
      }
    });
  }

  async subscribeToTopic(topicName: string, handler: MessageHandler, options: ISubscriptionOptions, bindingKeys?: string[]): Promise<string> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic '${topicName}' not found for subscription (simulated).`);
    }
    const subscriptionId = `tsub-${this.nextSubscriptionId++}`;
    topic.subscriptions.set(subscriptionId, { handler, options, bindingKeys });
    console.log(`Subscribed to topic '${topicName}' with ID ${subscriptionId} (simulated). Bindings: ${bindingKeys?.join(',')}. Options:`, options);
    return subscriptionId;
  }

  async ackMessage(messageDeliveryTag: any): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    console.log(`Message with deliveryTag '${messageDeliveryTag}' acknowledged (simulated).`);
    // In a real broker, this would remove the message from the unacknowledged set.
  }

  async nackMessage(messageDeliveryTag: any, requeue: boolean): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    console.log(`Message with deliveryTag '${messageDeliveryTag}' NACKed. Requeue: ${requeue} (simulated).`);
    // In a real broker, this would requeue or DLQ the message.
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.isConnectedState) throw new Error('Not connected to broker.');
    if (this.queueSubscriptions.has(subscriptionId)) {
      this.queueSubscriptions.delete(subscriptionId);
      console.log(`Unsubscribed queue subscription ${subscriptionId} (simulated).`);
      return;
    }
    let foundInTopic = false;
    this.topics.forEach(topic => {
      if (topic.subscriptions.has(subscriptionId)) {
        topic.subscriptions.delete(subscriptionId);
        foundInTopic = true;
      }
    });
    if (foundInTopic) {
      console.log(`Unsubscribed topic subscription ${subscriptionId} (simulated).`);
    } else {
      console.warn(`Subscription ID ${subscriptionId} not found for unsubscribe (simulated).`);
    }
  }

  async checkHealth(): Promise<{ isConnected: boolean; details?: any }> {
    return {
      isConnected: this.isConnectedState,
      details: this.isConnectedState ? `Connected to ${this.connectionUri} (simulated)` : 'Not connected (simulated)',
    };
  }
}

// Example Usage (Conceptual)
// async function runBrokerExample() {
//   const broker = new BasicMessageBroker();
//   await broker.connect('simulated://localhost:5672');

//   await broker.declareQueue({ name: 'myTestQueue', durable: true });
//   const subId = await broker.subscribeToQueue('myTestQueue', async (msg) => {
//     console.log(`[QUEUE SUB] Received: ${msg.payload.text}, ID: ${msg.id}`);
//     await broker.ackMessage(msg.id); // Simulate ack based on message ID for simplicity
//   }, { ackMode: 'manual' });

//   await broker.sendMessageToQueue('myTestQueue', {
//     id: 'msg1',
//     payload: { text: 'Hello Queue!' },
//     timestamp: new Date(),
//     contentType: 'application/json'
//   });

//   await broker.declareTopic({ name: 'myTestTopic' });
//   const topicSubId = await broker.subscribeToTopic('myTestTopic', async (msg) => {
//     console.log(`[TOPIC SUB] Received on topic: ${msg.payload.data}, ID: ${msg.id}`);
//   }, { ackMode: 'auto' }, ['events.user.*']);

//   await broker.publishToTopic('myTestTopic', {
//     id: 'event1',
//     payload: { data: 'User Created Event' },
//     timestamp: new Date()
//   }, 'events.user.created');

//   // await broker.unsubscribe(subId);
//   // await broker.disconnect();
// }
// runBrokerExample();