/**
 * @file Collects specific events from various sources.
 * Focuses on capturing discrete occurrences rather than continuous data streams.
 */

import { StreamConnector, StreamConnectionParams, StreamDataCallback, StreamErrorCallback } from '../connectors/stream-connector';
import { ApiConnector, ApiConnectionParams } from '../connectors/api-connector';
// Potentially other connectors if events can come from databases or files via polling

export interface EventSourceConfig {
  id: string; // Unique identifier for this event source
  type: 'stream' | 'api-webhook' | 'api-polling';
  params: StreamConnectionParams | ApiConnectionParams;
  // For API polling, might need an endpoint and polling interval
  pollingConfig?: {
    endpoint: string;
    intervalSeconds: number;
    queryParams?: Record<string, string | number>;
    // Function to determine if an API response contains new events
    eventDetectionLogic?: (apiResponse: any, lastKnownState?: any) => { events: any[], newState?: any };
  };
}

export type EventCallback = (eventId: string, eventData: any, sourceId: string) => void;
export type EventErrorCallback = (error: Error, sourceId: string) => void;

export class EventCollector {
  private sources: EventSourceConfig[];
  private activeConnectors: Map<string, StreamConnector | ApiConnector | any> = new Map(); // Store active connectors/pollers
  private onEventCallback?: EventCallback;
  private onErrorCallback?: EventErrorCallback;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastKnownStates: Map<string, any> = new Map(); // For API polling state

  constructor(sources: EventSourceConfig[]) {
    this.sources = sources;
  }

  /**
   * Starts collecting events from all configured sources.
   * @param onEvent Callback function to handle incoming events.
   * @param onError Callback function to handle errors during event collection.
   */
  public start(onEvent: EventCallback, onError: EventErrorCallback): void {
    this.onEventCallback = onEvent;
    this.onErrorCallback = onError;

    this.sources.forEach(sourceConfig => {
      try {
        if (this.activeConnectors.has(sourceConfig.id)) {
          console.warn(`Event source ${sourceConfig.id} is already active.`);
          return;
        }

        switch (sourceConfig.type) {
          case 'stream':
            this.startStreamEventSource(sourceConfig as { id: string; params: StreamConnectionParams });
            break;
          case 'api-webhook':
            // Webhook setup is typically external; this collector might just provide an endpoint
            // or expect events to be pushed to a specific URL handled by another service.
            // For this example, we'll assume webhooks are configured to call a method on this collector.
            console.log(`Webhook event source ${sourceConfig.id} ready. Ensure external service pushes to appropriate endpoint.`);
            break;
          case 'api-polling':
            this.startApiPollingEventSource(sourceConfig as Required<EventSourceConfig>);
            break;
          default:
            this.handleError(new Error(`Unsupported event source type: ${(sourceConfig as any).type}`), sourceConfig.id);
        }
      } catch (error: any) {
        this.handleError(error, sourceConfig.id);
      }
    });
  }

  private async startStreamEventSource(config: { id: string; params: StreamConnectionParams }): Promise<void> {
    const connector = new StreamConnector(config.params);
    this.activeConnectors.set(config.id, connector);

    const handleData: StreamDataCallback = (data) => {
      // Assuming data itself is the event or contains event information
      if (this.onEventCallback) this.onEventCallback(Date.now().toString(), data, config.id);
    };
    const handleError: StreamErrorCallback = (error) => {
      this.handleError(error, config.id);
    };

    try {
      await connector.connect(handleData, handleError);
      console.log(`Event collection started for stream source: ${config.id}`);
    } catch (error: any) {
      this.handleError(error, config.id);
      this.activeConnectors.delete(config.id);
    }
  }

  private async startApiPollingEventSource(config: Required<EventSourceConfig>): Promise<void> {
    const { id, params, pollingConfig } = config;
    if (!pollingConfig) {
      this.handleError(new Error('Polling configuration is missing for API polling source.'), id);
      return;
    }

    const connector = new ApiConnector(params as ApiConnectionParams);
    this.activeConnectors.set(id, connector); // Store connector for potential health checks

    const poll = async () => {
      try {
        const apiResponse = await connector.get(pollingConfig.endpoint, pollingConfig.queryParams);
        let events: any[] = [];
        let newState: any = undefined;

        if (pollingConfig.eventDetectionLogic) {
          const lastState = this.lastKnownStates.get(id);
          const detectionResult = pollingConfig.eventDetectionLogic(apiResponse, lastState);
          events = detectionResult.events;
          newState = detectionResult.newState;
        } else {
          // Default: assume the entire response is a list of events, or a single event
          events = Array.isArray(apiResponse) ? apiResponse : [apiResponse];
        }

        if (newState !== undefined) {
          this.lastKnownStates.set(id, newState);
        }

        events.forEach(event => {
          // Generate a unique ID for the event if not present
          const eventId = event.id || `${id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          if (this.onEventCallback) this.onEventCallback(eventId, event, id);
        });

      } catch (error: any) {
        this.handleError(error, id);
      } finally {
        // Schedule next poll if still active
        if (this.pollingIntervals.has(id)) {
         const timeoutId = setTimeout(poll, pollingConfig.intervalSeconds * 1000);
         this.pollingIntervals.set(id, timeoutId);
        }
      }
    };

    console.log(`Starting API polling for event source: ${id} every ${pollingConfig.intervalSeconds}s`);
    const initialTimeoutId = setTimeout(poll, pollingConfig.intervalSeconds * 1000); // Start after one interval
    this.pollingIntervals.set(id, initialTimeoutId);
    poll(); // Perform initial poll immediately
  }

  /**
   * Handles an incoming event, typically from a webhook.
   * @param sourceId The ID of the source that pushed the event.
   * @param eventData The data of the event.
   */
  public handleWebhookEvent(sourceId: string, eventData: any): void {
    const sourceConfig = this.sources.find(s => s.id === sourceId && s.type === 'api-webhook');
    if (!sourceConfig) {
      console.warn(`Received webhook event for unknown or non-webhook source: ${sourceId}`);
      return;
    }
    console.log(`Received webhook event for ${sourceId}:`, eventData);
    // Generate a unique ID for the event
    const eventId = `${sourceId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    if (this.onEventCallback) {
      this.onEventCallback(eventId, eventData, sourceId);
    }
  }


  private handleError(error: Error, sourceId: string): void {
    console.error(`Error collecting events from source ${sourceId}:`, error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error, sourceId);
    }
  }

  /**
   * Stops collecting events from a specific source or all sources.
   * @param sourceId Optional. If provided, stops only this source. Otherwise, stops all.
   */
  public async stop(sourceId?: string): Promise<void> {
    const sourcesToStop = sourceId ? [sourceId] : Array.from(this.activeConnectors.keys());

    for (const id of sourcesToStop) {
      const connector = this.activeConnectors.get(id);
      if (connector && typeof connector.disconnect === 'function') {
        try {
          await connector.disconnect();
          console.log(`Event collection stopped for source: ${id}`);
        } catch (error: any) {
          this.handleError(error, id);
        }
      }
      const pollingInterval = this.pollingIntervals.get(id);
      if (pollingInterval) {
        clearTimeout(pollingInterval);
        this.pollingIntervals.delete(id);
        this.lastKnownStates.delete(id);
        console.log(`API polling stopped for event source: ${id}`);
      }
      this.activeConnectors.delete(id);
    }
    if (!sourceId) {
        console.log('All event collection stopped.');
    }
  }

  /**
   * Stops all event collection and clears resources.
   */
  public async stopAll(): Promise<void> {
    await this.stop();
    this.pollingIntervals.forEach(timeoutId => clearTimeout(timeoutId));
    this.pollingIntervals.clear();
    this.lastKnownStates.clear();
    this.activeConnectors.clear();
    console.log('All event collectors shut down.');
  }
}