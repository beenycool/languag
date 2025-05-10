// src/microservices/services/infrastructure/gateway-service.ts

import { ILoadBalancer } from '../../core/framework/load-balancer';
import { IDiscoveryService } from '../../core/framework/discovery-service';
// Assuming a generic HTTP client, this could be 'axios', 'node-fetch', or a custom one.
// For this example, we'll define a simple interface for it.

/**
 * @interface IHttpClient
 * Defines a simple contract for an HTTP client.
 */
export interface IHttpClient {
  request(config: HttpClientRequestConfig): Promise<HttpClientResponse>;
}

export interface HttpClientRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, any>; // URL query parameters
  timeout?: number;
}

export interface HttpClientResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

/**
 * @interface IApiGateway
 * Defines the contract for an API Gateway.
 * It handles incoming requests and routes them to appropriate backend services.
 */
export interface IApiGateway {
  /**
   * Forwards an incoming request to a target service.
   * @param originalRequest - Represents the incoming request (e.g., from an HTTP server like Express).
   *                          This would typically include path, method, headers, body.
   * @param serviceName - The logical name of the target service.
   * @param servicePath - The path on the target service.
   * @returns A promise that resolves to the response from the target service.
   */
  forwardRequest(
    originalRequest: {
      method: string;
      path: string; // The path that the gateway received
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, any>;
      body: any;
    },
    serviceName: string,
    servicePathSuffix: string // e.g., if gateway path /api/users maps to user-service/, and request is /api/users/123, suffix is /123
  ): Promise<HttpClientResponse>;

  /**
   * Starts the API Gateway (e.g., starts an HTTP server to listen for requests).
   * @param port - The port number to listen on.
   */
  start(port: number): Promise<void>;

  /**
   * Stops the API Gateway.
   */
  stop(): Promise<void>;
}

/**
 * @interface RouteConfig
 * Configuration for a route handled by the API Gateway.
 */
export interface RouteConfig {
  pathPrefix: string; // e.g., "/api/users"
  serviceName: string; // e.g., "user-service"
  methods?: string[]; // e.g., ["GET", "POST"], defaults to all if undefined
  // Additional options: authenticationRequired, rateLimit, etc.
  authenticationRequired?: boolean;
  // servicePathPrefix could be used if the service expects a different base path
  // e.g. gateway /api/users maps to user-service/v1/users
  servicePathPrefix?: string;
}


/**
 * @class ApiGateway
 * A simplified API Gateway implementation.
 * Responsibilities:
 * - Routing: Based on path prefixes to target services.
 * - Service Discovery: To find instances of target services.
 * - Load Balancing: To distribute requests among service instances.
 * - Basic request transformation (e.g., stripping path prefixes).
 * - (Optionally) Authentication, Rate Limiting, Logging, Caching - these are advanced features.
 */
export class ApiGateway implements IApiGateway {
  private discoveryService: IDiscoveryService;
  private loadBalancer: ILoadBalancer;
  private httpClient: IHttpClient; // Used to make requests to backend services
  private routes: RouteConfig[];
  // In a real gateway, you'd use a proper HTTP server like Express or Fastify.
  // This is a placeholder for the server instance.
  private server: any | null = null;


  constructor(
    discoveryService: IDiscoveryService,
    loadBalancer: ILoadBalancer,
    httpClient: IHttpClient,
    routes: RouteConfig[] = []
  ) {
    this.discoveryService = discoveryService;
    this.loadBalancer = loadBalancer;
    this.httpClient = httpClient;
    this.routes = routes;
    console.log('ApiGateway initialized.');
  }

  public addRoute(route: RouteConfig): void {
    this.routes.push(route);
    // Sort routes by path prefix length descending to match more specific routes first
    this.routes.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
    console.log(`Route added to API Gateway: ${route.pathPrefix} -> ${route.serviceName}`);
  }

  private findMatchingRoute(requestPath: string, requestMethod: string): { route: RouteConfig; servicePathSuffix: string } | null {
    for (const route of this.routes) {
      if (requestPath.startsWith(route.pathPrefix)) {
        if (route.methods && !route.methods.includes(requestMethod.toUpperCase())) {
          continue; // Method not allowed for this route
        }
        const servicePathSuffix = requestPath.substring(route.pathPrefix.length);
        return { route, servicePathSuffix };
      }
    }
    return null;
  }

  public async forwardRequest(
    originalRequest: {
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, any>;
      body: any;
    },
  ): Promise<HttpClientResponse> {
    const match = this.findMatchingRoute(originalRequest.path, originalRequest.method);

    if (!match) {
      console.warn(`No route found for path: ${originalRequest.path}`);
      return {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
        data: { error: 'No route found for the requested path.' },
      };
    }

    const { route, servicePathSuffix } = match;
    const { serviceName, servicePathPrefix = '' } = route;

    try {
      const targetInstanceUrl = await this.loadBalancer.getNextInstance(serviceName);
      const targetPath = `${servicePathPrefix}${servicePathSuffix}`;
      const fullTargetUrl = `${targetInstanceUrl.replace(/\/$/, '')}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

      // Prepare headers for the downstream request
      // Filter out host, connection, and other hop-by-hop headers
      const downstreamHeaders: Record<string, string> = {};
      for (const key in originalRequest.headers) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'host' && lowerKey !== 'connection' && !lowerKey.startsWith('proxy-')) {
           const headerValue = originalRequest.headers[key];
           if (typeof headerValue === 'string') {
            downstreamHeaders[key] = headerValue;
           } else if (Array.isArray(headerValue)) {
            downstreamHeaders[key] = headerValue.join(', '); // Join multiple headers if necessary
           }
        }
      }
      // Add X-Forwarded-For, X-Forwarded-Proto, etc.
      // downstreamHeaders['X-Forwarded-For'] = originalRequest.sourceIp || 'unknown';
      // downstreamHeaders['X-Forwarded-Proto'] = originalRequest.protocol || 'http';


      console.log(`Forwarding request for ${originalRequest.path} to ${serviceName} (${fullTargetUrl})`);

      const response = await this.httpClient.request({
        method: originalRequest.method.toUpperCase() as HttpClientRequestConfig['method'],
        url: fullTargetUrl,
        headers: downstreamHeaders,
        params: originalRequest.query,
        data: originalRequest.body,
        // timeout: route.timeout || 5000, // Add timeout from route config
      });

      console.log(`Received response from ${serviceName} for ${originalRequest.path}: ${response.status}`);
      return response;

    } catch (error: any) {
      console.error(`Error forwarding request to ${serviceName} for path ${originalRequest.path}:`, error);
      // Handle different types of errors (e.g., service unavailable, timeout)
      if (error.message?.includes('No instances available')) {
        return {
          status: 503, // Service Unavailable
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
          data: { error: `Service ${serviceName} is currently unavailable.` },
        };
      }
      // Check for timeout error, etc.
      // if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      //   return { status: 504, statusText: 'Gateway Timeout', ... };
      // }
      return {
        status: 502, // Bad Gateway
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'application/json' },
        data: { error: `Error communicating with upstream service ${serviceName}.`, details: error.message },
      };
    }
  }

  /**
   * Starts an HTTP server to listen for incoming requests.
   * This is a simplified representation. In a real application, you'd use Express, Fastify, or similar.
   */
  public async start(port: number): Promise<void> {
    // This is where you would initialize and start an actual HTTP server (e.g., Express)
    // For example:
    // const express = require('express');
    // const app = express();
    // app.use(express.json()); // Middleware to parse JSON bodies
    //
    // app.all('*', async (req, res) => {
    //   const originalRequest = {
    //     method: req.method,
    //     path: req.path,
    //     headers: req.headers,
    //     query: req.query,
    //     body: req.body,
    //   };
    //   try {
    //     const serviceResponse = await this.forwardRequest(originalRequest);
    //     res.status(serviceResponse.status).set(serviceResponse.headers).send(serviceResponse.data);
    //   } catch (e) {
    //     // This catch is more for unexpected errors in forwardRequest itself,
    //     // as forwardRequest is designed to return a response object.
    //     res.status(500).send({ error: 'Internal API Gateway Error' });
    //   }
    // });
    //
    // this.server = app.listen(port, () => {
    //   console.log(`API Gateway started on port ${port}`);
    // });

    // Simulating server start for this example
    this.server = { port }; // Placeholder for a real server instance
    console.log(`API Gateway (simulated) started on port ${port}. Implement with a real HTTP server.`);
    // Example: Listen for discovery changes to update routes or clear caches
    // this.discoveryService.watchService('*', (serviceName, instances) => { ... });
  }

  public async stop(): Promise<void> {
    // if (this.server && typeof this.server.close === 'function') {
    //   await new Promise((resolve, reject) => {
    //     this.server.close((err) => {
    //       if (err) return reject(err);
    //       resolve(true);
    //     });
    //   });
    // }
    this.server = null;
    console.log('API Gateway (simulated) stopped.');
  }
}

// --- Example of a simple HttpClient (replace with a real one like axios) ---
export class SimpleHttpClient implements IHttpClient {
  async request(config: HttpClientRequestConfig): Promise<HttpClientResponse> {
    console.log(`SimpleHttpClient: Making ${config.method} request to ${config.url}`);
    // This is a mock. In a real scenario, use fetch, axios, etc.
    // For POST/PUT, config.data would be the body.
    // For GET, config.params would be query parameters.
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      // Simulate different responses based on URL or method for testing
      if (config.url.includes('unavailable')) {
        throw new Error('Simulated connection refused');
      }
      if (config.url.includes('error500')) {
        return {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
          data: { message: 'Simulated internal error from upstream' },
        };
      }

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'x-service-responded': 'true' },
        data: {
          message: `Mock response from ${config.method} ${config.url}`,
          requestPayload: config.data,
          queryParams: config.params,
        },
      };
    } catch (error: any) {
      // Simulate network errors
      console.error(`SimpleHttpClient Error: ${error.message}`);
      // This rethrow will be caught by ApiGateway's forwardRequest error handling
      throw new Error(`Network error while calling ${config.url}: ${error.message}`);
    }
  }
}