// Mock for a data source (e.g., a message broker subscription, direct device connection)
const mockDataSource = {
  onData: jest.fn(), // (callback: (deviceId: string, metricName: string, value: any, timestamp: Date) => void) => void
  subscribeToDevice: jest.fn(), // (deviceId, metricPattern?) => Promise<void>
  unsubscribeFromDevice: jest.fn(), // (deviceId) => Promise<void>
};

// Mock for a time-series database or storage for telemetry data
const mockTelemetryStorage = {
  storeDataPoint: jest.fn(), // (deviceId, metricName, value, timestamp) => Promise<void>
  getLatestDataPoint: jest.fn(), // (deviceId, metricName) => Promise<{ value: any; timestamp: Date } | null>
  queryDataPoints: jest.fn(), // (deviceId, metricName, startTime, endTime, aggregation?) => Promise<Array<{ value: any; timestamp: Date }>>
};

// Placeholder for actual TelemetryCollector implementation
// import { TelemetryCollector } from '../../../../utils/monitoring/telemetry-collector';

interface TelemetryDataPoint {
  deviceId: string;
  metricName: string;
  value: any;
  timestamp: Date;
}

class TelemetryCollector {
  private dataSources: (typeof mockDataSource)[] = [];
  constructor(private storage: typeof mockTelemetryStorage) {}

  addDataSource(source: typeof mockDataSource): void {
    this.dataSources.push(source);
    source.onData(async (deviceId, metricName, value, timestamp) => {
      await this.handleIncomingData({ deviceId, metricName, value, timestamp });
    });
  }

  async handleIncomingData(dataPoint: TelemetryDataPoint): Promise<void> {
    if (!dataPoint || !dataPoint.deviceId || !dataPoint.metricName || dataPoint.value === undefined || !dataPoint.timestamp) {
      console.error('Invalid telemetry data point received:', dataPoint);
      return;
    }
    // console.log('Storing telemetry:', dataPoint);
    await this.storage.storeDataPoint(dataPoint.deviceId, dataPoint.metricName, dataPoint.value, dataPoint.timestamp);
    // Optionally, could also push to a real-time stream/cache here
  }

  async getLatestTelemetry(deviceId: string, metricName: string): Promise<{ value: any; timestamp: Date } | null> {
    if (!deviceId || !metricName) throw new Error('Device ID and metric name are required.');
    return this.storage.getLatestDataPoint(deviceId, metricName);
  }

  async queryTelemetryHistory(
    deviceId: string,
    metricName: string,
    startTime: Date,
    endTime: Date,
    aggregation?: { intervalSeconds: number; type: 'avg' | 'sum' | 'min' | 'max' | 'count' }
  ): Promise<Array<{ value: any; timestamp: Date }>> {
    if (!deviceId || !metricName || !startTime || !endTime) {
      throw new Error('Device ID, metric name, start time, and end time are required.');
    }
    if (startTime >= endTime) throw new Error('Start time must be before end time.');
    return this.storage.queryDataPoints(deviceId, metricName, startTime, endTime, aggregation);
  }

  // Methods to manage subscriptions on data sources if collector is responsible
  async startCollectingFromDevice(deviceId: string, metricPattern?: string): Promise<void> {
    for (const source of this.dataSources) {
      await source.subscribeToDevice(deviceId, metricPattern);
    }
  }

  async stopCollectingFromDevice(deviceId: string): Promise<void> {
    for (const source of this.dataSources) {
      await source.unsubscribeFromDevice(deviceId);
    }
  }
}

describe('TelemetryCollector', () => {
  let telemetryCollector: TelemetryCollector;
  const deviceId = 'sensor-collector-1';
  const metricName = 'temperature';

  beforeEach(() => {
    mockDataSource.onData.mockReset();
    mockDataSource.subscribeToDevice.mockReset();
    mockDataSource.unsubscribeFromDevice.mockReset();
    mockTelemetryStorage.storeDataPoint.mockReset();
    mockTelemetryStorage.getLatestDataPoint.mockReset();
    mockTelemetryStorage.queryDataPoints.mockReset();
    
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error for invalid data tests

    telemetryCollector = new TelemetryCollector(mockTelemetryStorage);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addDataSource and handleIncomingData', () => {
    it('should register a data source and store data points received from it', async () => {
      let onDataCallback: (deviceId: string, metricName: string, value: any, timestamp: Date) => void = () => {};
      mockDataSource.onData.mockImplementation((cb) => { onDataCallback = cb; });
      mockTelemetryStorage.storeDataPoint.mockResolvedValue(undefined);

      telemetryCollector.addDataSource(mockDataSource);
      expect(mockDataSource.onData).toHaveBeenCalled();

      const timestamp = new Date();
      const value = 25.5;
      // Simulate data coming from the source
      await onDataCallback(deviceId, metricName, value, timestamp);

      expect(mockTelemetryStorage.storeDataPoint).toHaveBeenCalledWith(deviceId, metricName, value, timestamp);
    });

    it('should not store invalid data points and log an error', async () => {
      telemetryCollector.addDataSource(mockDataSource); // onData callback is set up
      const invalidData: any = { deviceId, metricName, timestamp: new Date() }; // Missing value
      
      await telemetryCollector.handleIncomingData(invalidData);
      
      expect(mockTelemetryStorage.storeDataPoint).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Invalid telemetry data point received:', invalidData);
    });
  });

  describe('getLatestTelemetry', () => {
    it('should retrieve the latest data point for a device and metric', async () => {
      const dataPoint = { value: 30, timestamp: new Date() };
      mockTelemetryStorage.getLatestDataPoint.mockResolvedValue(dataPoint);

      const result = await telemetryCollector.getLatestTelemetry(deviceId, metricName);
      expect(result).toEqual(dataPoint);
      expect(mockTelemetryStorage.getLatestDataPoint).toHaveBeenCalledWith(deviceId, metricName);
    });

    it('should return null if no data point is found', async () => {
      mockTelemetryStorage.getLatestDataPoint.mockResolvedValue(null);
      const result = await telemetryCollector.getLatestTelemetry(deviceId, metricName);
      expect(result).toBeNull();
    });
  });

  describe('queryTelemetryHistory', () => {
    const startTime = new Date(Date.now() - 3600 * 1000);
    const endTime = new Date();
    const dataPoints = [{ value: 20, timestamp: startTime }, { value: 22, timestamp: endTime }];

    it('should query historical data points within a time range', async () => {
      mockTelemetryStorage.queryDataPoints.mockResolvedValue(dataPoints);
      const result = await telemetryCollector.queryTelemetryHistory(deviceId, metricName, startTime, endTime);
      expect(result).toEqual(dataPoints);
      expect(mockTelemetryStorage.queryDataPoints).toHaveBeenCalledWith(deviceId, metricName, startTime, endTime, undefined);
    });

    it('should pass aggregation options to storage query', async () => {
      const aggregation = { intervalSeconds: 60, type: 'avg' as const };
      mockTelemetryStorage.queryDataPoints.mockResolvedValue([]);
      await telemetryCollector.queryTelemetryHistory(deviceId, metricName, startTime, endTime, aggregation);
      expect(mockTelemetryStorage.queryDataPoints).toHaveBeenCalledWith(deviceId, metricName, startTime, endTime, aggregation);
    });

    it('should throw error if start time is not before end time', async () => {
        await expect(telemetryCollector.queryTelemetryHistory(deviceId, metricName, endTime, startTime))
            .rejects.toThrow('Start time must be before end time.');
    });
  });

  describe('startCollectingFromDevice & stopCollectingFromDevice', () => {
    it('should call subscribeToDevice on all data sources', async () => {
        const source1 = {...mockDataSource};
        const source2 = {...mockDataSource};
        telemetryCollector.addDataSource(source1);
        telemetryCollector.addDataSource(source2);

        await telemetryCollector.startCollectingFromDevice(deviceId, 'temp/*');
        expect(source1.subscribeToDevice).toHaveBeenCalledWith(deviceId, 'temp/*');
        expect(source2.subscribeToDevice).toHaveBeenCalledWith(deviceId, 'temp/*');
    });

    it('should call unsubscribeFromDevice on all data sources', async () => {
        const source1 = {...mockDataSource};
        telemetryCollector.addDataSource(source1);

        await telemetryCollector.stopCollectingFromDevice(deviceId);
        expect(source1.unsubscribeFromDevice).toHaveBeenCalledWith(deviceId);
    });
  });
});