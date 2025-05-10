// src/mesh/utils/routing/route-manager.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { ConfigurationManager } from '../../core/control/configuration-manager'; // To fetch routing rules

export interface HttpHeaderMatch {
  name: string;          // Header name (case-insensitive match usually)
  exactValue?: string;   // Exact value match
  prefixValue?: string;  // Prefix match
  suffixValue?: string;  // Suffix match
  regexValue?: string;   // Regex match against header value
  present?: boolean;     // Check for header presence (true) or absence (false)
}

export interface HttpQueryParamMatch {
  name: string;
  exactValue?: string;
  regexValue?: string;
}

export interface HttpRouteMatch {
  pathPrefix?: string;
  pathExact?: string;
  pathRegex?: string;
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS')[];
  headers?: HttpHeaderMatch[];
  queryParams?: HttpQueryParamMatch[];
  // scheme?: 'http' | 'https';
  // authority?: string; // e.g., host:port
}

export interface HttpRouteAction {
  targetService: string; // The serviceId to route to
  targetPort?: number;    // Optional: specific port on the target service
  // For weighted routing, multiple targets might be specified, handled by TrafficSplitter
  // For now, single target.
  rewrite?: {
    pathPrefix?: string;     // Rewrite the matched path prefix to this value
    pathFull?: string;       // Rewrite the full path to this value
    hostAuthority?: string;  // Rewrite the Host/Authority header
  };
  timeoutMs?: number;        // Per-route timeout
  retryPolicy?: string;      // Name of a retry policy to apply (details in RetryHandler)
  // Other actions: redirect, direct_response, mirror, fault_injection, etc.
}

export interface RouteRule {
  id: string; // Unique ID for the route rule
  priority?: number; // Lower numbers processed first
  matches: HttpRouteMatch[]; // One or more match conditions (usually one for simplicity)
  action: HttpRouteAction;
  // metadata?: Record<string, any>; // For custom annotations
}

export interface ResolvedRoute {
  matchedRule: RouteRule;
  // Effective action after considering rewrites, etc.
  // This might be the same as rule.action or slightly modified.
  effectiveAction: HttpRouteAction; 
  // Any captured variables from regex path matching, etc.
  pathParams?: Record<string, string>; 
}

export interface IRouteManager {
  /**
   * Finds the best matching route rule for a given HTTP-like request context.
   * @param requestContext - Simplified representation of request properties to match against.
   * @returns The ResolvedRoute if a match is found, otherwise null.
   */
  findMatch(requestContext: {
    path: string;
    method: string;
    headers?: Record<string, string | string[] | undefined>; // Raw headers
    queryParams?: Record<string, string | string[] | undefined>; // Raw query params
  }): Promise<ResolvedRoute | null>;

  /**
   * Loads or reloads routing rules, typically from ConfigurationManager.
   */
  loadRoutingRules(): Promise<void>;
}

/**
 * Manages and evaluates routing rules for the mesh.
 * Fetches rules from ConfigurationManager and provides a way to match requests to routes.
 */
export class RouteManager implements IRouteManager {
  private logger?: ILoggingService;
  private configManager: ConfigurationManager;
  private routingRules: RouteRule[]; // Sorted by priority

  constructor(configManager: ConfigurationManager, logger?: ILoggingService) {
    this.logger = logger;
    this.configManager = configManager;
    this.routingRules = [];
    this.log(LogLevel.INFO, 'RouteManager initialized.');
    // this.loadRoutingRules().catch(err => this.log(LogLevel.ERROR, "Failed to load initial routing rules", { error: err.message }));
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[RouteManager] ${message}`, context);
  }

  public async loadRoutingRules(): Promise<void> {
    this.log(LogLevel.INFO, 'Loading routing rules...');
    try {
      // Assume routing rules are stored under a specific key in ConfigurationManager
      const config = await this.configManager.getGlobalConfig(); // Or a specific key like 'meshRoutingRules'
      
      if (config && config.routingRules && Array.isArray(config.routingRules)) {
        this.routingRules = (config.routingRules as RouteRule[])
          .sort((a, b) => (a.priority || Infinity) - (b.priority || Infinity)); // Sort by priority
        this.log(LogLevel.INFO, `Successfully loaded and sorted ${this.routingRules.length} routing rules.`);
      } else {
        this.log(LogLevel.WARN, 'No routing rules found or in unexpected format in configuration.');
        this.routingRules = [];
      }
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'Failed to load routing rules', { error: error.message });
      this.routingRules = [];
    }
  }

  public async findMatch(requestContext: {
    path: string;
    method: string;
    headers?: Record<string, string | string[] | undefined>;
    queryParams?: Record<string, string | string[] | undefined>;
  }): Promise<ResolvedRoute | null> {
    this.log(LogLevel.DEBUG, 'Finding match for request context:', requestContext);

    for (const rule of this.routingRules) {
      for (const matchCondition of rule.matches) { // Iterate through OR conditions if multiple matches defined per rule
        if (this.evaluateMatchCondition(requestContext, matchCondition)) {
          this.log(LogLevel.INFO, `Request matched rule ID: ${rule.id}`, { ruleAction: rule.action });
          // TODO: Implement path parameter extraction from regex if used
          return { matchedRule: rule, effectiveAction: rule.action /* Placeholder */ };
        }
      }
    }

    this.log(LogLevel.DEBUG, 'No matching route rule found for request.');
    return null;
  }

  private evaluateMatchCondition(
    request: { path: string; method: string; headers?: Record<string, any>; queryParams?: Record<string, any> },
    condition: HttpRouteMatch
  ): boolean {
    // Method match
    if (condition.methods && !condition.methods.map(m => m.toUpperCase()).includes(request.method.toUpperCase())) {
      return false;
    }

    // Path match (simplified: only one path condition type is typically used per match block)
    if (condition.pathExact && request.path !== condition.pathExact) return false;
    if (condition.pathPrefix && !request.path.startsWith(condition.pathPrefix)) return false;
    if (condition.pathRegex) {
      try {
        if (!new RegExp(condition.pathRegex).test(request.path)) return false;
      } catch (e) {
        this.log(LogLevel.ERROR, `Invalid regex in route match: ${condition.pathRegex}`, e);
        return false; // Treat invalid regex as non-match
      }
    }
    
    // Header match
    if (condition.headers && request.headers) {
      for (const headerMatch of condition.headers) {
        const headerValue = request.headers[headerMatch.name.toLowerCase()]; // Normalize header name
        if (headerMatch.present === true && headerValue === undefined) return false;
        if (headerMatch.present === false && headerValue !== undefined) return false;
        if (headerValue !== undefined) { // Only check value if header is present
            const valueStr = Array.isArray(headerValue) ? headerValue[0] : headerValue; // Take first if array
            if (headerMatch.exactValue && valueStr !== headerMatch.exactValue) return false;
            if (headerMatch.prefixValue && !valueStr.startsWith(headerMatch.prefixValue)) return false;
            if (headerMatch.suffixValue && !valueStr.endsWith(headerMatch.suffixValue)) return false;
            if (headerMatch.regexValue) {
                try {
                    if (!new RegExp(headerMatch.regexValue).test(valueStr)) return false;
                } catch (e) { this.log(LogLevel.ERROR, `Invalid regex for header ${headerMatch.name}: ${headerMatch.regexValue}`, e); return false; }
            }
        } else if (headerMatch.exactValue || headerMatch.prefixValue || headerMatch.suffixValue || headerMatch.regexValue) {
            // If a value match is specified, but header is not present, it's not a match
            return false;
        }
      }
    } else if (condition.headers && !request.headers) { // Headers required by policy but not present in request
        return false;
    }


    // Query Param match
    if (condition.queryParams && request.queryParams) {
      for (const queryMatch of condition.queryParams) {
        const queryValue = request.queryParams[queryMatch.name];
        if (queryValue === undefined) return false; // Query param must be present
        const valueStr = Array.isArray(queryValue) ? queryValue[0] : queryValue; // Take first if array
        if (queryMatch.exactValue && valueStr !== queryMatch.exactValue) return false;
        if (queryMatch.regexValue) {
            try {
                if (!new RegExp(queryMatch.regexValue).test(valueStr)) return false;
            } catch (e) { this.log(LogLevel.ERROR, `Invalid regex for query param ${queryMatch.name}: ${queryMatch.regexValue}`, e); return false; }
        }
      }
    } else if (condition.queryParams && !request.queryParams) { // Query params required by policy but not present
        return false;
    }

    return true; // All conditions in this HttpRouteMatch passed
  }
}