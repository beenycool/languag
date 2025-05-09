import { EventEmitter } from 'events';
import { ClipboardMonitor } from '../../core/clipboard-monitor';
import { EventDispatcher } from '../../events/dispatchers/event-dispatcher';
import { NotificationDispatcher } from '../../events/dispatchers/notification-dispatcher';
import { ContentAnalyzer } from '../../processing/analyzers/content-analyzer';
import { SecurityFilter } from '../../processing/filters/security-filter';

export class ServiceManager extends EventEmitter {
  private monitor: ClipboardMonitor;
  private eventDispatcher: EventDispatcher;
  private notificationDispatcher: NotificationDispatcher;
  private analyzer: ContentAnalyzer;
  private securityFilter: SecurityFilter;
  private isRunning = false;

  constructor() {
    super();
    this.monitor = new ClipboardMonitor();
    this.eventDispatcher = new EventDispatcher();
    this.notificationDispatcher = new NotificationDispatcher(this.eventDispatcher);
    this.analyzer = new ContentAnalyzer();
    this.securityFilter = new SecurityFilter();

    this.setupEventHandlers();
  }

  start(): void {
    if (this.isRunning) return;
    
    this.monitor.start();
    this.isRunning = true;
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.monitor.stop();
    this.isRunning = false;
    this.emit('stopped');
  }

  private setupEventHandlers(): void {
    this.monitor.on('change', (event: ClipboardEvent & { content: any }) => {
      const securityCheck = this.securityFilter.check(event.content);
      if (!securityCheck.safe) {
        this.notificationDispatcher.notify({
          type: 'error',
          error: new Error('Security check failed'),
          timestamp: Date.now(),
          operation: 'security-check'
        });
        return;
      }

      const analysis = this.analyzer.analyze(event.content);
      const enhancedEvent = {
        type: 'change' as const,
        content: event.content,
        timestamp: Date.now(),
        metadata: analysis
      };
      this.eventDispatcher.dispatch(enhancedEvent);
    });

    this.monitor.on('error', (error: unknown) => {
      this.eventDispatcher.dispatchError(error, 'clipboard-monitor');
    });
  }

  get status(): { running: boolean } {
    return { running: this.isRunning };
  }
}