/**
 * @file Protocol Handler
 *
 * This file defines the protocol handler for enterprise integrations.
 * It is responsible for managing and processing messages according to various
 * communication protocols (e.g., HTTP, gRPC, AMQP, MQTT).
 *
 * Focus areas:
 * - Reliability: Ensures messages are processed correctly according to protocol specs.
 * - Performance monitoring: Tracks message processing times and throughput.
 * - Error handling: Manages protocol-specific errors and retries.
 */

interface IProtocolAdapter {
  /**
   * The name of the protocol this adapter handles (e.g., 'http', 'grpc').
   */
  protocolName: string;

  /**
   * Parses an incoming message according to the protocol.
   * @param rawMessage The raw incoming message data.
   * @returns A promise that resolves with the parsed message.
   */
  parseMessage(rawMessage: any): Promise<any>;

  /**
   * Formats an outgoing message according to the protocol.
   * @param messageData The message data to format.
   * @returns A promise that resolves with the formatted raw message.
   */
  formatMessage(messageData: any): Promise<any>;

  /**
   * Sends a message using the protocol.
   * @param targetAddress The address of the target service.
   * @param formattedMessage The protocol-formatted message to send.
   * @returns A promise that resolves with the response from the target.
   */
  sendMessage(targetAddress: string, formattedMessage: any): Promise<any>;

  /**
   * Handles protocol-specific errors.
   * @param error The error object.
   * @param originalMessage Optional original message that caused the error.
   */
  handleError(error: Error, originalMessage?: any): Promise<void>;
}

export class ProtocolHandler {
  private adapters: Map<string, IProtocolAdapter> = new Map();

  constructor() {
    console.log('Protocol Handler initialized.');
    // TODO: Optionally pre-load common protocol adapters
  }

  /**
   * Registers a protocol adapter.
   * @param adapter The protocol adapter instance.
   */
  public registerAdapter(adapter: IProtocolAdapter): void {
    if (this.adapters.has(adapter.protocolName)) {
      console.warn(`Protocol adapter for ${adapter.protocolName} already registered. Overwriting.`);
    }
    this.adapters.set(adapter.protocolName, adapter);
    console.log(`Protocol adapter for ${adapter.protocolName} registered.`);
  }

  /**
   * Retrieves a registered protocol adapter.
   * @param protocolName The name of the protocol.
   * @returns The adapter instance or undefined if not found.
   */
  public getAdapter(protocolName: string): IProtocolAdapter | undefined {
    return this.adapters.get(protocolName);
  }

  /**
   * Processes an incoming message using the appropriate protocol adapter.
   * @param protocolName The name of the protocol.
   * @param rawMessage The raw incoming message.
   * @returns A promise that resolves with the parsed message.
   * @throws Error if no adapter is found for the protocol.
   */
  public async processIncomingMessage(protocolName: string, rawMessage: any): Promise<any> {
    const adapter = this.getAdapter(protocolName);
    if (!adapter) {
      throw new Error(`No protocol adapter found for ${protocolName}.`);
    }
    try {
      return await adapter.parseMessage(rawMessage);
    } catch (error: any) {
      await adapter.handleError(error, rawMessage);
      throw error; // Re-throw after handling or transform into a standard error
    }
  }

  /**
   * Prepares and sends an outgoing message using the appropriate protocol adapter.
   * @param protocolName The name of the protocol.
   * @param targetAddress The address to send the message to.
   * @param messageData The data for the message.
   * @returns A promise that resolves with the response.
   * @throws Error if no adapter is found for the protocol.
   */
  public async sendOutgoingMessage(protocolName: string, targetAddress: string, messageData: any): Promise<any> {
    const adapter = this.getAdapter(protocolName);
    if (!adapter) {
      throw new Error(`No protocol adapter found for ${protocolName}.`);
    }
    try {
      const formattedMessage = await adapter.formatMessage(messageData);
      return await adapter.sendMessage(targetAddress, formattedMessage);
    } catch (error: any) {
      await adapter.handleError(error, messageData);
      throw error; // Re-throw after handling or transform
    }
  }
}

// Example usage (conceptual)
// class HttpAdapter implements IProtocolAdapter {
//   protocolName = 'http';
//   async parseMessage(rawMessage: any) { /* ... */ return {}; }
//   async formatMessage(messageData: any) { /* ... */ return {}; }
//   async sendMessage(targetAddress: string, formattedMessage: any) { /* ... */ return {}; }
//   async handleError(error: Error) { console.error("HTTP Error:", error); }
// }

// const handler = new ProtocolHandler();
// handler.registerAdapter(new HttpAdapter());
// handler.processIncomingMessage('http', { body: 'raw http data' });