/**
 * @file Provides a cross-process messaging bus.
 */
import { Message, MessageHeader, MessageType } from '../types/message-types';
import { SecurityPrincipal } from '../types/security-types';
// import { logger } from '../../services/logger';
// import { SecurityManager } from './security-manager'; // Assuming SecurityManager for permission checks

type MessageHandler<T = unknown> = (message: Message<T>, sender?: SecurityPrincipal) => Promise<void> | void;

interface Subscription<T = unknown> {
  handler: MessageHandler<T>;
  sourceProcess?: string; // Optional: filter messages from a specific source process
}

export class MessageBus {
  private subscriptions: Map<string, Set<Subscription<any>>> = new Map();
  // private securityManager: SecurityManager;

  constructor(/*securityManager: SecurityManager*/) {
    // this.securityManager = securityManager;
    // logger.info('MessageBus initialized.');
    console.info('MessageBus initialized.');
  }

  /**
   * Subscribes a handler to a specific message type or topic.
   * @param messageTopic The topic or message type to subscribe to (e.g., 'user:created', MessageType.EVENT).
   * @param handler The function to call when a message on the topic is published.
   * @param sourceProcess Optional: The identifier of the source process to filter messages from.
   */
  subscribe<T>(messageTopic: string, handler: MessageHandler<T>, sourceProcess?: string): void {
    if (!this.subscriptions.has(messageTopic)) {
      this.subscriptions.set(messageTopic, new Set());
    }
    this.subscriptions.get(messageTopic)!.add({ handler, sourceProcess });
    // logger.debug(`Handler subscribed to topic: ${messageTopic}`, { sourceProcess });
    console.debug(`Handler subscribed to topic: ${messageTopic}`, { sourceProcess });
  }

  /**
   * Unsubscribes a handler from a specific message topic.
   * @param messageTopic The topic to unsubscribe from.
   * @param handler The handler function to remove.
   */
  unsubscribe<T>(messageTopic: string, handler: MessageHandler<T>): void {
    const topicSubscriptions = this.subscriptions.get(messageTopic);
    if (topicSubscriptions) {
      topicSubscriptions.forEach(sub => {
        if (sub.handler === handler) {
          topicSubscriptions.delete(sub);
          // logger.debug(`Handler unsubscribed from topic: ${messageTopic}`);
          console.debug(`Handler unsubscribed from topic: ${messageTopic}`);
        }
      });
      if (topicSubscriptions.size === 0) {
        this.subscriptions.delete(messageTopic);
      }
    }
  }

  /**
   * Publishes a message to all subscribed handlers for the given topic.
   * @param message The message to publish.
   * @param sender Optional: The security principal of the message sender for permission checks.
   */
  async publish<T>(message: Message<T>, sender?: SecurityPrincipal): Promise<void> {
    const { type, source } = message.header;
    const topic = message.header.target || type; // Use target if specified, otherwise message type as topic

    // logger.debug(`Publishing message to topic: ${topic}`, { messageId: message.header.messageId, source });
    console.debug(`Publishing message to topic: ${topic}`, { messageId: message.header.messageId, source });

    const topicSubscriptions = this.subscriptions.get(topic);
    if (topicSubscriptions) {
      for (const sub of topicSubscriptions) {
        // if (sender && sub.sourceProcess && !this.securityManager.canCommunicate(sender, sub.sourceProcess)) {
        //   logger.warn(`Blocked message from ${sender.id} to ${sub.sourceProcess} due to security policy.`, { topic });
        //   continue;
        // }
        if (sub.sourceProcess && sub.sourceProcess !== source) {
          // logger.trace(`Skipping handler for ${topic} as source ${source} doesn't match expected ${sub.sourceProcess}`);
          console.trace(`Skipping handler for ${topic} as source ${source} doesn't match expected ${sub.sourceProcess}`);
          continue;
        }
        try {
          await sub.handler(message, sender);
        } catch (error) {
          // logger.error(`Error in message handler for topic ${topic}:`, error, { messageId: message.header.messageId });
          console.error(`Error in message handler for topic ${topic}:`, error, { messageId: message.header.messageId });
        }
      }
    } else {
      // logger.trace(`No subscriptions found for topic: ${topic}`);
      console.trace(`No subscriptions found for topic: ${topic}`);
    }

    // Also publish to a generic event type if it's an event, command, etc.
    if (topic !== type) {
        const typeSubscriptions = this.subscriptions.get(type);
        if (typeSubscriptions) {
            for (const sub of typeSubscriptions) {
                 if (sub.sourceProcess && sub.sourceProcess !== source) {
                    console.trace(`Skipping handler for ${type} as source ${source} doesn't match expected ${sub.sourceProcess}`);
                    continue;
                 }
                try {
                    await sub.handler(message, sender);
                } catch (error) {
                    console.error(`Error in message handler for type ${type}:`, error, { messageId: message.header.messageId });
                }
            }
        }
    }
  }

  /**
   * Sends a request and waits for a response. This is a simple implementation.
   * A more robust version would handle timeouts, correlation IDs, and specific response topics.
   * @param requestMessage The request message (e.g., QueryMessage).
   * @param responseTopic The topic to listen for the response on.
   * @param timeoutMs Timeout in milliseconds.
   * @returns A promise that resolves with the response message.
   */
  async request<ReqT, ResT>(
    requestMessage: Message<ReqT>,
    responseTopic: string,
    timeoutMs: number = 5000
  ): Promise<Message<ResT>> {
    const correlationId = requestMessage.header.messageId; // Use messageId as correlationId

    // Ensure the request has a target for routing, or the bus knows where to send it.
    if (!requestMessage.header.target) {
        // logger.warn('Request message has no target for routing.', { messageId: correlationId });
        console.warn('Request message has no target for routing.', { messageId: correlationId });
        // Depending on architecture, this might be an error or handled by a default route.
    }


    return new Promise<Message<ResT>>((resolve, reject) => {
      const responseHandler: MessageHandler<ResT> = (responseMsg) => {
        if (responseMsg.header.correlationId === correlationId) {
          this.unsubscribe(responseTopic, responseHandler);
          clearTimeout(timeoutId);
          if (responseMsg.header.type === MessageType.ERROR) {
            // logger.error('Received error response for request:', { correlationId, error: responseMsg.payload });
            console.error('Received error response for request:', { correlationId, error: responseMsg.payload });
            reject(new Error(`Request failed: ${(responseMsg.payload as any)?.message || 'Unknown error'}`));
          } else {
            // logger.debug('Received response for request:', { correlationId });
            console.debug('Received response for request:', { correlationId });
            resolve(responseMsg);
          }
        }
      };

      const timeoutId = setTimeout(() => {
        this.unsubscribe(responseTopic, responseHandler);
        // logger.warn(`Request timed out for topic ${responseTopic} and correlationId ${correlationId}`);
        console.warn(`Request timed out for topic ${responseTopic} and correlationId ${correlationId}`);
        reject(new Error(`Request timed out for ${correlationId}`));
      }, timeoutMs);

      this.subscribe<ResT>(responseTopic, responseHandler);
      this.publish(requestMessage); // Publish the original request
    });
  }

  /**
   * Clears all subscriptions. Useful for testing or shutdown.
   */
  clearAllSubscriptions(): void {
    this.subscriptions.clear();
    // logger.info('All message bus subscriptions cleared.');
    console.info('All message bus subscriptions cleared.');
  }
}