/**
 * @file Protocol Adapter
 *
 * This file defines the protocol adapter for converting messages between
 * different communication protocols (e.g., HTTP to AMQP, SOAP to REST).
 * It acts as a bridge between services that use incompatible protocols.
 *
 * This is a more specialized version of the core ProtocolHandler's adapters,
 * potentially used for more complex, stateful, or business-logic-aware adaptations
 * between specific enterprise services or legacy systems.
 *
 * Focus areas:
 * - Reliability: Ensures message integrity during protocol conversion.
 * - Performance monitoring: Tracks latency and throughput of adaptations.
 * - Error handling: Manages errors arising from protocol mismatches or conversion failures.
 */

interface IProtocolConversionRequest {
  sourceProtocol: string;
  sourceMessage: any; // Raw message from the source protocol
  sourceMetadata?: Record<string, any>; // e.g., HTTP headers, AMQP properties

  targetProtocol: string;
  targetServiceAddress?: string; // Optional: if the adapter also sends the message
  transformationHint?: string; // Optional: hint for data transformation if needed alongside protocol adaptation
}

interface IProtocolConversionResponse {
  success: boolean;
  targetMessage?: any; // Message formatted for the target protocol
  targetMetadata?: Record<string, any>; // Metadata for the target protocol
  error?: string;
  details?: any;
}

interface IProtocolAdapterBridge {
  /**
   * Checks if this adapter can handle the requested conversion.
   * @param sourceProtocol The source protocol name.
   * @param targetProtocol The target protocol name.
   * @returns True if the adapter supports this conversion, false otherwise.
   */
  supports(sourceProtocol: string, targetProtocol: string): boolean;

  /**
   * Converts a message from a source protocol to a target protocol.
   * @param request The protocol conversion request details.
   * @returns A promise that resolves with the conversion response.
   */
  convert(request: IProtocolConversionRequest): Promise<IProtocolConversionResponse>;
}

export class ProtocolAdapterRegistry {
  private adapters: IProtocolAdapterBridge[] = [];

  constructor() {
    console.log('Protocol Adapter Registry initialized.');
  }

  registerAdapter(adapter: IProtocolAdapterBridge): void {
    this.adapters.push(adapter);
    console.log(`Registered a protocol adapter bridge.`);
    // TODO: Potentially check for duplicate handling capabilities.
  }

  async adapt(request: IProtocolConversionRequest): Promise<IProtocolConversionResponse> {
    const suitableAdapter = this.adapters.find(
      (adapter) => adapter.supports(request.sourceProtocol, request.targetProtocol)
    );

    if (!suitableAdapter) {
      const errorMessage = `No suitable protocol adapter found for conversion from ${request.sourceProtocol} to ${request.targetProtocol}.`;
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log(`Using adapter for ${request.sourceProtocol} -> ${request.targetProtocol}. Request:`, request);
    try {
      return await suitableAdapter.convert(request);
    } catch (error: any) {
      console.error(`Error during protocol adaptation by ${suitableAdapter.constructor.name}:`, error);
      return { success: false, error: error.message, details: error };
    }
  }
}

/**
 * Example: HTTP to AMQP Adapter
 * This is a conceptual implementation. A real one would involve HTTP parsing
 * and AMQP message construction using respective libraries.
 */
export class HttpToAmqpAdapter implements IProtocolAdapterBridge {
  supports(sourceProtocol: string, targetProtocol: string): boolean {
    return sourceProtocol.toLowerCase() === 'http' && targetProtocol.toLowerCase() === 'amqp';
  }

  async convert(request: IProtocolConversionRequest): Promise<IProtocolConversionResponse> {
    if (!this.supports(request.sourceProtocol, request.targetProtocol)) {
      return { success: false, error: 'Adapter does not support this conversion.' };
    }

    // Assuming request.sourceMessage is a simplified HTTP-like request object
    // e.g., { body: any, headers: Record<string, string> }
    const httpMessage = request.sourceMessage;
    const httpMetadata = request.sourceMetadata || httpMessage.headers;

    // Transform HTTP body to AMQP message payload (e.g., JSON string or Buffer)
    let amqpPayload: Buffer | string;
    if (typeof httpMessage.body === 'string') {
      amqpPayload = httpMessage.body;
    } else if (Buffer.isBuffer(httpMessage.body)) {
      amqpPayload = httpMessage.body;
    } else {
      try {
        amqpPayload = JSON.stringify(httpMessage.body);
      } catch (e: any) {
        return { success: false, error: `Failed to serialize HTTP body to JSON: ${e.message}` };
      }
    }

    // Map HTTP headers to AMQP message properties/headers
    const amqpProperties: Record<string, any> = {
      contentType: httpMetadata?.['content-type'] || 'application/json',
      // Add other relevant properties: correlationId, replyTo, custom headers etc.
      headers: { ...httpMetadata } // Pass through other headers
    };

    if (httpMetadata?.['x-correlation-id']) {
        amqpProperties.correlationId = httpMetadata['x-correlation-id'];
    }


    console.log(`HTTP to AMQP: Converting HTTP body to AMQP payload. Properties:`, amqpProperties);

    return {
      success: true,
      targetMessage: amqpPayload,
      targetMetadata: amqpProperties,
    };
  }
}

// Example usage (conceptual)
// const registry = new ProtocolAdapterRegistry();
// registry.registerAdapter(new HttpToAmqpAdapter());

// async function testAdaptation() {
//   const httpRequest = {
//     sourceProtocol: 'http',
//     targetProtocol: 'amqp',
//     sourceMessage: {
//       body: { message: 'Hello from HTTP' },
//       headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': 'http-corr-123' }
//     },
//     targetServiceAddress: 'my.amqp.queue' // For information, actual sending is separate
//   };

//   const result = await registry.adapt(httpRequest);

//   if (result.success) {
//     console.log('AMQP Message:', result.targetMessage);
//     console.log('AMQP Properties:', result.targetMetadata);
//     // Now this result.targetMessage and result.targetMetadata can be used
//     // by an AMQP client to send the message.
//   } else {
//     console.error('Protocol Adaptation Failed:', result.error);
//   }
// }

// testAdaptation();