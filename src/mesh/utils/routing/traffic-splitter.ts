// src/mesh/utils/routing/traffic-splitter.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
// ServiceInstance might be needed if the splitter also resolves to specific instances,
// but often it just decides on a target service/version based on weights.
// import { ServiceInstance } from '../../core/control/service-registry'; 

export interface TrafficSplitTarget {
  serviceId: string;    // Target service (e.g., "productpage-v1", "productpage-v2")
  port?: number;         // Optional specific port for this target
  weight: number;        // A number representing the proportion of traffic (e.g., 0-100)
  // Additional selectors for this target if needed (e.g., specific version, tags)
  // version?: string; 
  // tags?: string[];
}

export interface TrafficSplitDecision {
  selectedTarget: TrafficSplitTarget;
  // Could include original request context or a tracking ID for why this target was chosen.
}

export interface ITrafficSplitter {
  /**
   * Selects a target from a list of weighted targets based on their weights.
   * @param targets - An array of TrafficSplitTarget objects.
   * @param requestContext - Optional context about the request (e.g., headers for sticky sessions, user ID).
   * @returns The selected TrafficSplitTarget, or null if no target could be selected.
   */
  selectTarget(targets: TrafficSplitTarget[], requestContext?: Record<string, any>): TrafficSplitDecision | null;
}

/**
 * Implements weighted traffic splitting logic.
 * Given a set of targets with weights, it probabilistically selects one.
 */
export class TrafficSplitter implements ITrafficSplitter {
  private logger?: ILoggingService;

  constructor(logger?: ILoggingService) {
    this.logger = logger;
    this.log(LogLevel.INFO, 'TrafficSplitter initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[TrafficSplitter] ${message}`, context);
  }

  public selectTarget(targets: TrafficSplitTarget[], requestContext?: Record<string, any>): TrafficSplitDecision | null {
    if (!targets || targets.length === 0) {
      this.log(LogLevel.WARN, 'No targets provided for traffic splitting.');
      return null;
    }

    const totalWeight = targets.reduce((sum, target) => sum + (target.weight || 0), 0);

    if (totalWeight <= 0) {
      this.log(LogLevel.WARN, 'Total weight of targets is zero or negative. Cannot split traffic. Defaulting to first target if any.', { targets });
      // Fallback: return the first target if weights are invalid but targets exist.
      // Or return null if strict adherence to weights is required.
      return targets.length > 0 ? { selectedTarget: targets[0] } : null;
    }

    let randomWeight = Math.random() * totalWeight; // A random number between 0 and totalWeight
    
    this.log(LogLevel.DEBUG, `Attempting to select target. Total weight: ${totalWeight}, Random draw: ${randomWeight.toFixed(2)}`, { targetsCount: targets.length });

    for (const target of targets) {
      if (target.weight <= 0) continue; // Skip targets with no weight

      if (randomWeight < target.weight) {
        this.log(LogLevel.INFO, `Selected target: ${target.serviceId} with weight ${target.weight}`, { target });
        return { selectedTarget: target };
      }
      randomWeight -= target.weight; // Subtract current target's weight and try next
    }

    // Should not be reached if totalWeight > 0 and targets have positive weights,
    // but as a fallback (e.g., due to floating point inaccuracies or all zero weights missed by initial check).
    this.log(LogLevel.ERROR, 'Failed to select a target through weighted random logic. This should not happen with valid inputs. Defaulting to first valid target.', { targets, totalWeight, randomWeight });
    const firstValidTarget = targets.find(t => t.weight > 0);
    return firstValidTarget ? { selectedTarget: firstValidTarget } : null;
  }
}