// Placeholder for actual MessageBroker implementation
// For testing, we'll create a simple in-memory mock broker.
// import { MessageBroker } from '../../../../services/communication/message-broker';

type MessagePayload = Record<string, any> | string | Buffer;
type BrokerMessageCallback = (topic: string, message: MessagePayload) => void | Promise<void>;

interface Subscription {
  id: string;
  topicPattern: string; // Can include wildcards e.g., 'devices/+/data' or 'devices/sensor-123/alerts'
  callback: BrokerMessageCallback;
}

class InMemoryMessageBroker {
  private subscriptions: Map<string, Subscription>; // subscriptionId -> Subscription
  private topicSubscribers: Map<string, Set<string>>; // topicPattern -> Set of subscriptionIds

  constructor() {
    this.subscriptions = new Map();
    this.topicSubscribers = new Map();
  }

  async publish(topic: string, message: MessagePayload): Promise<void> {
    if (!topic) throw new Error('Topic is required to publish a message.');
    // console.log(`Publishing to ${topic}:`, message);

    // Iterate over all subscription patterns to find matches
    // This is a simplified matching logic. Real brokers have more complex wildcard handling.
    this.subscriptions.forEach((sub) => {
      if (this.topicMatchesPattern(topic, sub.topicPattern)) {
        try {
            // console.log(`Delivering to subId ${sub.id} for pattern ${sub.topicPattern}`);
            Promise.resolve(sub.callback(topic, message)).catch(err => {
                console.error(`Error in subscriber callback for topic ${topic} (subId: ${sub.id}):`, err);
            });
        } catch (error) {
            console.error(`Synchronous error in subscriber callback for topic ${topic} (subId: ${sub.id}):`, error);
        }
      }
    });
  }

  // Simple topic matching: exact match or single-level wildcard '+'
  // Example: 'devices/+/status' matches 'devices/sensor1/status' but not 'devices/sensor1/foo/status'
  // Example: 'devices/#' matches 'devices/foo' and 'devices/foo/bar' (not implemented here for simplicity)
  private topicMatchesPattern(topic: string, pattern: string): boolean {
    if (pattern.includes('#')) { // Basic multi-level wildcard (simplified)
        const basePattern = pattern.substring(0, pattern.indexOf('#'));
        return topic.startsWith(basePattern);
    }
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');
    if (topicParts.length !== patternParts.length && !pattern.endsWith('/#')) { // Adjust for '#' if fully implemented
      return false;
    }
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '+') continue;
      if (patternParts[i] === '#') return i === patternParts.length -1; // '#' must be last part
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return true;
  }

  async subscribe(topicPattern: string, callback: BrokerMessageCallback): Promise<string> {
    if (!topicPattern) throw new Error('Topic pattern is required for subscription.');
    if (typeof callback !== 'function') throw new Error('Callback function is required for subscription.');

    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const subscription: Subscription = { id: subscriptionId, topicPattern, callback };
    this.subscriptions.set(subscriptionId, subscription);

    if (!this.topicSubscribers.has(topicPattern)) {
      this.topicSubscribers.set(topicPattern, new Set());
    }
    this.topicSubscribers.get(topicPattern)!.add(subscriptionId);
    // console.log(`Subscribed ${subscriptionId} to ${topicPattern}`);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!subscriptionId) throw new Error('Subscription ID is required to unsubscribe.');
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription ID ${subscriptionId} not found for unsubscribe.`);
      return;
    }

    this.subscriptions.delete(subscriptionId);
    const patternSubscribers = this.topicSubscribers.get(subscription.topicPattern);
    if (patternSubscribers) {
      patternSubscribers.delete(subscriptionId);
      if (patternSubscribers.size === 0) {
        this.topicSubscribers.delete(subscription.topicPattern);
      }
    }
    // console.log(`Unsubscribed ${subscriptionId}`);
  }

  // Helper for tests to clear all subscriptions
  clearAllSubscriptions(): void {
    this.subscriptions.clear();
    this.topicSubscribers.clear();
  }
}

describe('InMemoryMessageBroker', () => {
  let messageBroker: InMemoryMessageBroker;

  beforeEach(() => {
    messageBroker = new InMemoryMessageBroker();
    // Spy on console.error to check for callback errors without failing tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    messageBroker.clearAllSubscriptions();
    jest.restoreAllMocks(); // Restore console.error and console.warn
  });

  describe('publish and subscribe', () => {
    it('should deliver a message to a subscriber with an exact topic match', async () => {
      const topic = 'devices/sensor-A/temperature';
      const message = { value: 25, unit: 'C' };
      const callback = jest.fn();

      await messageBroker.subscribe(topic, callback);
      await messageBroker.publish(topic, message);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(topic, message);
    });

    it('should deliver a message to multiple subscribers for the same topic', async () => {
      const topic = 'alerts/system';
      const message = { level: 'critical', service: 'auth' };
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await messageBroker.subscribe(topic, callback1);
      await messageBroker.subscribe(topic, callback2);
      await messageBroker.publish(topic, message);

      expect(callback1).toHaveBeenCalledWith(topic, message);
      expect(callback2).toHaveBeenCalledWith(topic, message);
    });

    it('should deliver messages to subscribers with single-level wildcard (+)', async () => {
      const pattern = 'devices/+/status';
      const topic1 = 'devices/sensor-A/status';
      const topic2 = 'devices/actuator-B/status';
      const nonMatchingTopic = 'devices/sensor-A/data';
      const message1 = { online: true };
      const message2 = { active: false };
      const callback = jest.fn();

      await messageBroker.subscribe(pattern, callback);
      await messageBroker.publish(topic1, message1);
      await messageBroker.publish(topic2, message2);
      await messageBroker.publish(nonMatchingTopic, { value: 123 });


      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(topic1, message1);
      expect(callback).toHaveBeenCalledWith(topic2, message2);
      expect(callback).not.toHaveBeenCalledWith(nonMatchingTopic, { value: 123 });
    });

    it('should deliver messages to subscribers with multi-level wildcard (#)', async () => {
        const pattern = 'logs/#'; // Match all topics starting with 'logs/'
        const topic1 = 'logs/system/info';
        const topic2 = 'logs/application/error/detail';
        const nonMatchingTopic = 'data/system';
        const message1 = "System started";
        const message2 = { code: 500, stack: "..." };
        const callback = jest.fn();

        await messageBroker.subscribe(pattern, callback);
        await messageBroker.publish(topic1, message1);
        await messageBroker.publish(topic2, message2);
        await messageBroker.publish(nonMatchingTopic, "some data");

        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith(topic1, message1);
        expect(callback).toHaveBeenCalledWith(topic2, message2);
        expect(callback).not.toHaveBeenCalledWith(nonMatchingTopic, "some data");
    });


    it('should not deliver messages if topic does not match pattern', async () => {
      const pattern = 'commands/light';
      const topic = 'commands/fan';
      const message = { action: 'toggle' };
      const callback = jest.fn();

      await messageBroker.subscribe(pattern, callback);
      await messageBroker.publish(topic, message);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle asynchronous subscriber callbacks without crashing', async () => {
        const topic = 'async/test';
        const message = { data: 'payload' };
        const asyncCallback = jest.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
        });

        await messageBroker.subscribe(topic, asyncCallback);
        await messageBroker.publish(topic, message); // Publish and don't wait

        // Wait for the callback to likely have been called
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(asyncCallback).toHaveBeenCalledWith(topic, message);
        expect(console.error).not.toHaveBeenCalled(); // Check no errors logged from promise rejection
    });

    it('should catch and log errors from synchronous subscriber callbacks', async () => {
        const topic = 'error/sync';
        const message = { data: 'payload' };
        const errorCallback = jest.fn(() => {
            throw new Error("Synchronous subscriber error");
        });

        await messageBroker.subscribe(topic, errorCallback);
        await messageBroker.publish(topic, message);

        expect(errorCallback).toHaveBeenCalledWith(topic, message);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining(`Synchronous error in subscriber callback for topic ${topic}`),
            expect.any(Error)
        );
    });

     it('should catch and log errors from asynchronous subscriber callback rejections', async () => {
        const topic = 'error/async';
        const message = { data: 'payload' };
        const errorAsyncCallback = jest.fn().mockRejectedValue(new Error("Async subscriber rejection"));

        await messageBroker.subscribe(topic, errorAsyncCallback);
        await messageBroker.publish(topic, message);

        // Wait for the promise in publish to potentially resolve and catch error
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(errorAsyncCallback).toHaveBeenCalledWith(topic, message);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error in subscriber callback for topic ${topic}`),
            expect.any(Error)
        );
    });

  });

  describe('unsubscribe', () => {
    it('should stop delivering messages after unsubscribing', async () => {
      const topic = 'updates/software';
      const message = { version: '1.1.0' };
      const callback = jest.fn();

      const subscriptionId = await messageBroker.subscribe(topic, callback);
      await messageBroker.publish(topic, message); // Delivered
      expect(callback).toHaveBeenCalledTimes(1);

      await messageBroker.unsubscribe(subscriptionId);
      await messageBroker.publish(topic, message); // Should not be delivered
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle unsubscribing a non-existent ID gracefully', async () => {
      await expect(messageBroker.unsubscribe('non-existent-sub-id')).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith('Subscription ID non-existent-sub-id not found for unsubscribe.');
    });

    it('should correctly remove subscription from internal structures', async () => {
        const topic = 'test/cleanup';
        const subId = await messageBroker.subscribe(topic, jest.fn());
        // @ts-expect-error Accessing private members for test verification
        expect(messageBroker.subscriptions.has(subId)).toBe(true);
        // @ts-expect-error
        expect(messageBroker.topicSubscribers.get(topic)?.has(subId)).toBe(true);

        await messageBroker.unsubscribe(subId);

        // @ts-expect-error
        expect(messageBroker.subscriptions.has(subId)).toBe(false);
        // @ts-expect-error
        expect(messageBroker.topicSubscribers.has(topic)).toBe(false); // if it was the only one
    });
  });

  describe('Error Handling for subscribe/publish', () => {
    it('publish should throw error if topic is not provided', async () => {
        // @ts-expect-error testing invalid input
        await expect(messageBroker.publish(null, {})).rejects.toThrow('Topic is required to publish a message.');
    });
    it('subscribe should throw error if topic pattern is not provided', async () => {
        // @ts-expect-error testing invalid input
        await expect(messageBroker.subscribe(null, jest.fn())).rejects.toThrow('Topic pattern is required for subscription.');
    });
    it('subscribe should throw error if callback is not a function', async () => {
        // @ts-expect-error testing invalid input
        await expect(messageBroker.subscribe('test/topic', null)).rejects.toThrow('Callback function is required for subscription.');
    });
  });
});