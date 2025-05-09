import { EventEmitter } from 'events';

export class StateManager extends EventEmitter {
  private states: Map<string, any> = new Map();
  private currentState: string = 'idle';

  constructor() {
    super();
    this.setState('idle');
  }

  setState(newState: string, data?: any): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;
    this.states.set(newState, data);

    this.emit('state-change', {
      oldState,
      newState,
      data
    });
  }

  getState(): string {
    return this.currentState;
  }

  getStateData(state?: string): any {
    return this.states.get(state || this.currentState);
  }

  isInState(state: string): boolean {
    return this.currentState === state;
  }
}