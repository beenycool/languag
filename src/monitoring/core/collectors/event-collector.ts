interface MonitoredEvent {
  type: string; // e.g., 'error', 'warning', 'info', 'user_action'
  timestamp: Date;
  details: Record<string, any>; // Arbitrary data associated with the event
  source?: string; // Optional: module or component that emitted the event
}

export class EventCollector {
  private events: MonitoredEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 1000) {
    if (maxEvents <= 0) {
      throw new Error('maxEvents must be a positive number.');
    }
    this.maxEvents = maxEvents;
  }

  recordEvent(type: string, details: Record<string, any>, source?: string): MonitoredEvent {
    if (!type || type.trim() === '') {
      throw new Error('Event type cannot be empty.');
    }

    const event: MonitoredEvent = {
      type,
      details,
      source,
      timestamp: new Date(),
    };

    if (this.events.length >= this.maxEvents) {
      this.events.shift(); // Remove the oldest event to make space
    }
    this.events.push(event);
    return event;
  }

  getEvents(filterType?: string): MonitoredEvent[] {
    if (filterType) {
      return this.events.filter(event => event.type === filterType);
    }
    return [...this.events]; // Return a copy
  }

  countEvents(filterType?: string): number {
    if (filterType) {
      return this.events.filter(event => event.type === filterType).length;
    }
    return this.events.length;
  }

  clearEvents(): void {
    this.events = [];
  }
}