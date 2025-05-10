// src/microservices/core/communication/rpc-handler.ts

/**
 * @interface IRpcRequest
 * Represents a generic RPC request.
 */
export interface IRpcRequest<TParams = any> {
  id: string; // Unique request identifier
  method: string; // The method name to be called on the remote service
  params: TParams; // Parameters for the method
  timestamp: number;
  metadata?: Record<string, any>; // For headers, auth tokens, etc.
}

/**
 * @interface IRpcResponse
 * Represents a generic RPC response.
 */
export interface IRpcResponse<TResult = any, TError = any> {
  id: string; // Corresponds to the request ID
  result?: TResult; // The result of the RPC call
  error?: {
    code: number; // Error code (e.g., -32601 for Method not found)
    message: string; // Error message
    data?: TError; // Additional error data
  };
  timestamp: number;
}

/**
 * @type RpcMethodHandler
 * Defines the signature for a function that handles an RPC method.
 * @param params - The parameters received for the method.
 * @param requestContext - Optional context of the original request (e.g., metadata).
 * @returns A promise that resolves to the result of the method.
 * @throws An error if the method execution fails.
 */
export type RpcMethodHandler<TParams = any, TResult = any> = (
  params: TParams,
  requestContext?: IRpcRequest<TParams>
) => Promise<TResult>;

/**
 * @interface IRpcServer
 * Defines the contract for an RPC server that can expose methods.
 */
export interface IRpcServer {
  /**
   * Registers a method handler for a given method name.
   * @param methodName - The name of the method to expose.
   * @param handler - The function to handle calls to this method.
   */
  registerMethod<TParams = any, TResult = any>(methodName: string, handler: RpcMethodHandler<TParams, TResult>): void;

  /**
   * Starts listening for incoming RPC requests.
   * This would typically involve setting up a network listener (e.g., HTTP, WebSockets).
   * @returns A promise that resolves when the server has started.
   */
  start(): Promise<void>;

  /**
   * Stops the RPC server.
   * @returns A promise that resolves when the server has stopped.
   */
  stop(): Promise<void>;

  /**
   * Directly handles a raw request string or object (e.g., from an HTTP body).
   * This is useful for integrating with transport layers.
   * @param rawRequest - The raw request data.
   * @returns A promise that resolves to the raw response data.
   */
  handleRequest(rawRequest: any): Promise<any>;
}

/**
 * @interface IRpcClient
 * Defines the contract for an RPC client that can call remote methods.
 */
export interface IRpcClient {
  /**
   * Calls a remote method.
   * @param methodName - The name of the remote method to call.
   * @param params - The parameters for the remote method.
   * @param metadata - Optional metadata to send with the request.
   * @returns A promise that resolves to the result of the remote method call.
   * @throws An error if the remote call fails or returns an error.
   */
  call<TParams = any, TResult = any>(
    methodName: string,
    params: TParams,
    metadata?: Record<string, any>
  ): Promise<TResult>;

  /**
   * Connects to the RPC server (if applicable, e.g., for WebSockets).
   * @returns A promise that resolves when connected.
   */
  connect?(): Promise<void>;

  /**
   * Disconnects from the RPC server.
   * @returns A promise that resolves when disconnected.
   */
  disconnect?(): Promise<void>;
}

/**
 * @class InMemoryRpcHandler
 * A very basic in-memory RPC handler for demonstration.
 * This simulates both client and server aspects within the same process.
 * In a real microservices architecture, client and server would be separate,
 * communicating over a network (e.g., HTTP/REST, gRPC, WebSockets with JSON-RPC).
 */
export class InMemoryRpcHandler implements IRpcServer, IRpcClient {
  private methods: Map<string, RpcMethodHandler<any, any>>;
  private isServerStarted: boolean;

  constructor() {
    this.methods = new Map();
    this.isServerStarted = false;
    console.log('InMemoryRpcHandler initialized.');
  }

  // --- IRpcServer Implementation ---

  public registerMethod<TParams = any, TResult = any>(
    methodName: string,
    handler: RpcMethodHandler<TParams, TResult>
  ): void {
    if (this.methods.has(methodName)) {
      console.warn(`RPC method "${methodName}" is being overridden.`);
    }
    this.methods.set(methodName, handler);
    console.log(`RPC method registered: ${methodName}`);
  }

  public async start(): Promise<void> {
    this.isServerStarted = true;
    console.log('InMemoryRpcHandler (Server) started.');
    // No actual network listening for in-memory version
  }

  public async stop(): Promise<void> {
    this.isServerStarted = false;
    console.log('InMemoryRpcHandler (Server) stopped.');
    // Clear methods on stop? Or keep them for potential restart?
    // this.methods.clear();
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Simulates handling an incoming RPC request.
   * In a real system, rawRequest would be parsed from a network request.
   */
  public async handleRequest(rawRequest: any): Promise<any> {
    if (!this.isServerStarted) {
      return this.createErrorResponse(rawRequest.id || this.generateId(), -32000, 'Server not started');
    }

    let request: IRpcRequest;
    try {
      // Assuming rawRequest is already a parsed IRpcRequest object for simplicity
      // In a real scenario, you'd parse JSON string here.
      if (typeof rawRequest === 'string') {
        request = JSON.parse(rawRequest);
      } else {
        request = rawRequest as IRpcRequest;
      }
      if (!request.id || !request.method) {
        throw new Error('Invalid RPC request structure: missing id or method.');
      }
    } catch (e: any) {
      return this.createErrorResponse(this.generateId(), -32700, 'Parse error', e.message);
    }

    const handler = this.methods.get(request.method);
    if (!handler) {
      return this.createErrorResponse(request.id, -32601, `Method not found: ${request.method}`);
    }

    try {
      const result = await handler(request.params, request);
      return this.createSuccessResponse(request.id, result);
    } catch (error: any) {
      console.error(`Error executing RPC method "${request.method}":`, error);
      // Customize error code and message based on the type of error
      return this.createErrorResponse(request.id, error.code || -32000, error.message || 'Internal server error', error.data);
    }
  }

  private createSuccessResponse<TResult>(id: string, result: TResult): IRpcResponse<TResult> {
    return {
      id,
      result,
      timestamp: Date.now(),
    };
  }

  private createErrorResponse<TError>(
    id: string,
    code: number,
    message: string,
    data?: TError
  ): IRpcResponse<never, TError> {
    return {
      id,
      error: { code, message, data },
      timestamp: Date.now(),
    };
  }

  // --- IRpcClient Implementation ---

  /**
   * Simulates calling a remote method by directly invoking the registered handler.
   */
  public async call<TParams = any, TResult = any>(
    methodName: string,
    params: TParams,
    metadata?: Record<string, any>
  ): Promise<TResult> {
    if (!this.isServerStarted) { // Or if client is not "connected" to a specific server instance
      throw new Error('RPC client cannot call method: server not available or not started.');
    }

    const requestId = this.generateId();
    const request: IRpcRequest<TParams> = {
      id: requestId,
      method: methodName,
      params,
      timestamp: Date.now(),
      metadata,
    };

    console.log(`RPC Client: Calling method "${methodName}" with id ${requestId}`);

    // Simulate sending request and receiving response by calling handleRequest
    const response = await this.handleRequest(request) as IRpcResponse<TResult>;

    if (response.error) {
      console.error(`RPC Client: Call to "${methodName}" failed:`, response.error);
      const error: any = new Error(response.error.message);
      error.code = response.error.code;
      error.data = response.error.data;
      throw error;
    }

    if (response.id !== requestId) {
        console.error(`RPC Client: Response ID mismatch. Expected ${requestId}, got ${response.id}`);
        throw new Error('RPC response ID mismatch.');
    }

    return response.result as TResult;
  }

  // connect/disconnect for client are no-op for this in-memory version
  public async connect(): Promise<void> {
    console.log('InMemoryRpcHandler (Client) connected (no-op).');
  }

  public async disconnect(): Promise<void> {
    console.log('InMemoryRpcHandler (Client) disconnected (no-op).');
  }
}

// Example Usage (conceptual, would be in different services normally)
async function example() {
  const rpcHandler = new InMemoryRpcHandler();

  // Server side: Register a method
  rpcHandler.registerMethod<{ a: number; b: number }, number>('add', async (params) => {
    if (typeof params.a !== 'number' || typeof params.b !== 'number') {
      throw { code: -32602, message: 'Invalid params: a and b must be numbers.' };
    }
    return params.a + params.b;
  });
  rpcHandler.registerMethod('greet', async (params: { name: string }) => `Hello, ${params.name}!`);

  await rpcHandler.start(); // Start the "server"

  // Client side: Call the method
  try {
    const sum = await rpcHandler.call('add', { a: 5, b: 3 });
    console.log('Result of add(5, 3):', sum); // Output: 8

    const greeting = await rpcHandler.call('greet', { name: 'World' });
    console.log('Result of greet("World"):', greeting); // Output: Hello, World!

    // Example of calling a non-existent method
    await rpcHandler.call('subtract', { x: 10, y: 2 });
  } catch (error: any) {
    console.error('RPC call failed:', { code: error.code, message: error.message, data: error.data });
  }

  try {
    // Example of invalid params
    await rpcHandler.call('add', { a: 'five', b: 3 });
  } catch (error: any) {
    console.error('RPC call with invalid params failed:', { code: error.code, message: error.message, data: error.data });
  }


  await rpcHandler.stop(); // Stop the "server"
}

// To run the example:
// example().catch(console.error);