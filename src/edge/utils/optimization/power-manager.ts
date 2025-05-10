declare global {
  interface BatteryManager {
    charging: boolean;
    level: number;
    addEventListener: (type: string, listener: () => void) => void;
  }
  
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

export class EdgePowerManager {
  private battery: BatteryManager | null = null;

  constructor() {
    if (navigator.getBattery) {
      navigator.getBattery().then((batt: BatteryManager) => this.battery = batt);
    }
  }

  async throttlePerformance(): Promise<'high' | 'medium' | 'low'> {
    if (!this.battery) return 'high';

    const battery = await this.battery;
    return battery.charging ? 'high' : 
      battery.level > 0.2 ? 'medium' : 'low';
  }

  createEfficientInterval(callback: () => void, interval: number) {
    let lastRun = 0;
    
    const check = () => {
      const now = Date.now();
      if (now - lastRun >= interval) {
        lastRun = now;
        callback();
      }
      requestAnimationFrame(check);
    };
    
    requestAnimationFrame(check);
    return () => cancelAnimationFrame(0); // Return cleanup function
  }
}

interface BatteryManager {
  charging: boolean;
  level: number;
  addEventListener: (type: string, listener: () => void) => void;
}