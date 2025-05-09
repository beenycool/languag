// Manages user-related metrics and usage analytics
// TODO: Implement user metrics collection and reporting

export interface UserEvent {
  userId: string;
  eventName: string;
  timestamp: Date;
  properties?: Record<string, any>;
  sessionId?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  eventCount: number;
}

export class UserMetrics {
  private userEvents: UserEvent[];
  private activeSessions: Map<string, UserSession>; // Keyed by sessionId

  constructor() {
    this.userEvents = [];
    this.activeSessions = new Map();
    // Initialize user metrics monitoring
  }

  public trackEvent(userId: string, eventName: string, properties?: Record<string, any>, sessionId?: string): void {
    const event: UserEvent = {
      userId,
      eventName,
      timestamp: new Date(),
      properties,
      sessionId,
    };
    this.userEvents.push(event);
    // Optional: Limit the size of the in-memory event store
    if (this.userEvents.length > 10000) {
      this.userEvents.shift();
    }

    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.eventCount += 1;
      }
    }
    console.log(`User event tracked: User '${userId}', Event '${eventName}'`);
  }

  public startSession(userId: string, sessionId: string): UserSession {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`Session ${sessionId} already exists.`);
      return this.activeSessions.get(sessionId)!;
    }
    const session: UserSession = {
      sessionId,
      userId,
      startTime: new Date(),
      isActive: true,
      eventCount: 0,
    };
    this.activeSessions.set(sessionId, session);
    console.log(`User session started: User '${userId}', Session '${sessionId}'`);
    return session;
  }

  public endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      session.isActive = false;
      console.log(`User session ended: Session '${sessionId}'. Duration: ${this.getSessionDuration(sessionId)}ms`);
      // Optionally move to a list of completed sessions
    } else {
      console.warn(`Session ${sessionId} not found to end.`);
    }
  }

  public getSessionDuration(sessionId: string): number | undefined {
    const session = this.activeSessions.get(sessionId);
    if (session && session.endTime) {
      return session.endTime.getTime() - session.startTime.getTime();
    }
    return undefined;
  }

  public getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.isActive);
  }

  public getUserEvents(userId: string): UserEvent[] {
    return this.userEvents.filter(event => event.userId === userId);
  }

  public getEventsByName(eventName: string): UserEvent[] {
    return this.userEvents.filter(event => event.eventName === eventName);
  }

  public getRecentEvents(limit: number = 100): UserEvent[] {
    return this.userEvents.slice(-limit);
  }

  // Example: User logs in
  public userLoggedIn(userId: string, sessionId: string): void {
    this.startSession(userId, sessionId);
    this.trackEvent(userId, 'user_login', undefined, sessionId);
  }

  // Example: User performs an action
  public userPerformedAction(userId: string, actionName: string, details: Record<string, any>, sessionId?: string): void {
    this.trackEvent(userId, `action_${actionName}`, details, sessionId);
  }
}