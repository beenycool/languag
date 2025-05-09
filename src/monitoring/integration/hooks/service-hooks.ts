import { MetricCollector } from '../../core/collectors/metric-collector';
import { EventCollector } from '../../core/collectors/event-collector'; // For service events

// Placeholder types for service calls
interface ServiceRequest {
  serviceName: string;
  methodName: string;
  requestId?: string; // Optional unique ID for the request
  payload?: any;
}

interface ServiceResponse {
  requestId?: string; // Correlate with request
  data?: any;
  error?: any;
  statusCode?: number; // e.g., HTTP status code
}

export class ServiceHooks {
  private metricCollector: MetricCollector;
  private eventCollector?: EventCollector; // Optional, for richer event logging

  constructor(metricCollector: MetricCollector, eventCollector?: EventCollector) {
    this.metricCollector = metricCollector;
    this.eventCollector = eventCollector;
  }

  beforeServiceCall(request: ServiceRequest): string /* timerName */ {
    const timerName = `service_call_${request.serviceName}_${request.methodName}${request.requestId ? `_${request.requestId}` : ''}`;
    this.metricCollector.getTimingMetrics().start(timerName);
    this.metricCollector.getPerformanceMetrics().record(`service_call_invoked_${request.serviceName}_${request.methodName}`, 1, 'count');
    
    this.eventCollector?.recordEvent(
        'service_call_start',
        { service: request.serviceName, method: request.methodName, requestId: request.requestId, payload: request.payload },
        'ServiceHooks'
    );
    console.log(`[Hook] Before service call: ${request.serviceName}.${request.methodName} (ID: ${request.requestId || 'N/A'})`);
    return timerName;
  }

  afterServiceCall(timerName: string, request: ServiceRequest, response: ServiceResponse): void {
    const timing = this.metricCollector.getTimingMetrics().stop(timerName);
    if (timing) {
      console.log(`[Hook] After service call: ${request.serviceName}.${request.methodName}. Time: ${timing.durationMs.toFixed(2)}ms`);
      if (response.statusCode) {
        this.metricCollector.getPerformanceMetrics().record(`service_call_status_${request.serviceName}_${request.methodName}_${response.statusCode}`, 1, 'count');
      }
    } else {
      console.warn(`[Hook] Timer ${timerName} was not properly stopped for service call: ${request.serviceName}.${request.methodName}`);
    }

    if (response.error) {
      this.metricCollector.getPerformanceMetrics().record(`service_call_error_${request.serviceName}_${request.methodName}`, 1, 'count');
      this.eventCollector?.recordEvent(
          'service_call_error',
          { service: request.serviceName, method: request.methodName, requestId: request.requestId, error: response.error },
          'ServiceHooks'
      );
    } else {
       this.metricCollector.getPerformanceMetrics().record(`service_call_success_${request.serviceName}_${request.methodName}`, 1, 'count');
       this.eventCollector?.recordEvent(
          'service_call_success',
          { service: request.serviceName, method: request.methodName, requestId: request.requestId, responseData: response.data },
          'ServiceHooks'
      );
    }
  }

  // This is a more specific error hook if the call itself throws before a response object is formed
  onServiceCallException(timerName: string, request: ServiceRequest, exception: any): void {
    // Attempt to stop timer if it was started
    if (this.metricCollector.getTimingMetrics()['activeTimers']?.has(timerName)) {
        this.metricCollector.getTimingMetrics().stop(timerName);
        console.warn(`[Hook] Force-stopped timer ${timerName} due to service call exception.`);
    }

    this.metricCollector.getPerformanceMetrics().record(`service_call_exception_${request.serviceName}_${request.methodName}`, 1, 'count');
    this.eventCollector?.recordEvent(
        'service_call_exception',
        { service: request.serviceName, method: request.methodName, requestId: request.requestId, exception },
        'ServiceHooks'
    );
    console.error(`[Hook] Exception during service call ${request.serviceName}.${request.methodName}:`, exception);
  }
}

// Example Usage (conceptual):
/*
const metricCollector = new MetricCollector();
const eventCollector = new EventCollector();
const serviceHooks = new ServiceHooks(metricCollector, eventCollector);

async function callMyService(payload: any): Promise<any> {
  const request: ServiceRequest = { serviceName: 'MyAPI', methodName: 'getData', payload, requestId: 'req123' };
  const timerName = serviceHooks.beforeServiceCall(request);
  let responseData: any;
  try {
    // responseData = await actualMyApiService.getData(payload);
    // Forcing example:
    responseData = { data: "some data", statusCode: 200};
    serviceHooks.afterServiceCall(timerName, request, responseData);
    return responseData.data;
  } catch (e) {
    serviceHooks.onServiceCallException(timerName, request, e);
    throw e;
  }
}
*/