// Mock for a TelemetryData Source (e.g., TelemetryCollector or a direct DB connection)
const mockTelemetrySource = {
  queryTelemetryHistory: jest.fn(), // (deviceId, metricName, startTime, endTime, options?) => Promise<Array<{ value: any; timestamp: Date }>>
  getDeviceList: jest.fn(), // () => Promise<string[]> (optional, for batch analysis)
};

// Mock for an InsightsStorage (to store analysis results)
const mockInsightsStorage = {
  storeInsight: jest.fn(), // (insight: AnalysisInsight) => Promise<void>
  getInsights: jest.fn(), // (filters: { deviceId?: string; type?: InsightType }) => Promise<AnalysisInsight[]>
};

// Placeholder for actual DataAnalyzer implementation
// import { DataAnalyzer } from '../../../../utils/analytics/data-analyzer';

type InsightType = 'trend_detection' | 'anomaly_detection' | 'pattern_recognition' | 'correlation';
interface AnalysisInsight {
  id: string;
  deviceId?: string; // Optional if insight is global or across multiple devices
  metricName?: string;
  type: InsightType;
  timestamp: Date; // When the insight was generated
  timeRange?: { start: Date; end: Date }; // Data range analyzed
  confidence?: number; // 0.0 to 1.0
  summary: string;
  details?: Record<string, any>; // e.g., trend slope, anomaly score, correlated metrics
}

interface TimeSeriesDataPoint {
    value: number; // Assuming numeric values for simplicity in analysis examples
    timestamp: Date;
}

class DataAnalyzer {
  constructor(
    private telemetrySource: typeof mockTelemetrySource,
    private insightsStorage?: typeof mockInsightsStorage
  ) {}

  private generateInsightId(type: InsightType, deviceId?: string): string {
    return `insight-${type}-${deviceId || 'global'}-${Date.now()}`;
  }

  // Example: Simple Anomaly Detection (e.g., value outside 3 standard deviations)
  async detectAnomalies(
    deviceId: string,
    metricName: string,
    timeRange: { start: Date; end: Date },
    stdDevFactor: number = 3
  ): Promise<AnalysisInsight[]> {
    if (!deviceId || !metricName || !timeRange) throw new Error('Device ID, metric name, and time range are required.');
    const dataPoints: TimeSeriesDataPoint[] = await this.telemetrySource.queryTelemetryHistory(deviceId, metricName, timeRange.start, timeRange.end);
    if (dataPoints.length < 10) { // Need enough data for meaningful stats
        console.warn(`Not enough data points for ${deviceId}/${metricName} in range for anomaly detection.`);
        return [];
    }

    const values = dataPoints.map(dp => dp.value);
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);

    const anomalies: AnalysisInsight[] = [];
    for (const dp of dataPoints) {
      if (Math.abs(dp.value - mean) > stdDevFactor * stdDev) {
        const insight: AnalysisInsight = {
          id: this.generateInsightId('anomaly_detection', deviceId),
          deviceId, metricName, type: 'anomaly_detection', timestamp: new Date(), timeRange,
          summary: `Anomaly detected for ${metricName}: value ${dp.value} at ${dp.timestamp.toISOString()} is outside ${stdDevFactor} std devs from mean (${mean.toFixed(2)}).`,
          details: { value: dp.value, timestamp: dp.timestamp, mean, stdDev, factor: stdDevFactor },
          confidence: 0.8 // Example confidence
        };
        anomalies.push(insight);
        if (this.insightsStorage) await this.insightsStorage.storeInsight(insight);
      }
    }
    return anomalies;
  }

  // Example: Simple Trend Detection (linear regression slope)
  async detectTrend(
    deviceId: string,
    metricName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<AnalysisInsight | null> {
    if (!deviceId || !metricName || !timeRange) throw new Error('Device ID, metric name, and time range are required.');
    const dataPoints: TimeSeriesDataPoint[] = await this.telemetrySource.queryTelemetryHistory(deviceId, metricName, timeRange.start, timeRange.end);
    if (dataPoints.length < 5) { // Need at least a few points for a trend
        console.warn(`Not enough data points for ${deviceId}/${metricName} in range for trend detection.`);
        return null;
    }

    // Simplified linear regression (slope calculation)
    // X = time (milliseconds from start), Y = value
    const xValues = dataPoints.map(dp => dp.timestamp.getTime() - dataPoints[0].timestamp.getTime());
    const yValues = dataPoints.map(dp => dp.value);
    const n = dataPoints.length;

    const sumX = xValues.reduce((s, v) => s + v, 0);
    const sumY = yValues.reduce((s, v) => s + v, 0);
    const sumXY = xValues.reduce((s, v, i) => s + v * yValues[i], 0);
    const sumXX = xValues.reduce((s, v) => s + v * v, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let trendType: string;
    if (Math.abs(slope) < 1e-9) trendType = 'stable'; // Arbitrary small threshold for "stable"
    else if (slope > 0) trendType = 'increasing';
    else trendType = 'decreasing';

    if (trendType === 'stable' && Math.abs(slope) > 1e-10) { /* only significant slopes */ }


    const insight: AnalysisInsight = {
      id: this.generateInsightId('trend_detection', deviceId),
      deviceId, metricName, type: 'trend_detection', timestamp: new Date(), timeRange,
      summary: `Trend for ${metricName}: ${trendType} (slope: ${slope.toExponential(3)} units/ms).`,
      details: { slope, trendType, firstValue: yValues[0], lastValue: yValues[n-1] },
      confidence: Math.min(0.5 + n * 0.05, 0.95) // Simplistic confidence based on data points
    };
    if (this.insightsStorage) await this.insightsStorage.storeInsight(insight);
    return insight;
  }
}

// Need crypto for generateInsightId if not importing from Node.js 'crypto' directly in class
import * as crypto from 'crypto';


describe('DataAnalyzer', () => {
  let dataAnalyzer: DataAnalyzer;
  const deviceId = 'analyzer-dev-1';
  const metricName = 'pressure';
  const timeRange = { start: new Date(Date.now() - 3600000), end: new Date() };

  beforeEach(() => {
    mockTelemetrySource.queryTelemetryHistory.mockReset();
    mockTelemetrySource.getDeviceList.mockReset();
    if (mockInsightsStorage) {
        mockInsightsStorage.storeInsight.mockReset();
        mockInsightsStorage.getInsights.mockReset();
    }
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    dataAnalyzer = new DataAnalyzer(mockTelemetrySource, mockInsightsStorage);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies when values are outside stdDevFactor * stdDev', async () => {
      const data: TimeSeriesDataPoint[] = [
        { timestamp: new Date(timeRange.start.getTime() + 0), value: 100 },
        { timestamp: new Date(timeRange.start.getTime() + 1000), value: 102 },
        { timestamp: new Date(timeRange.start.getTime() + 2000), value: 99 },
        { timestamp: new Date(timeRange.start.getTime() + 3000), value: 101 },
        { timestamp: new Date(timeRange.start.getTime() + 4000), value: 150 }, // Anomaly
        { timestamp: new Date(timeRange.start.getTime() + 5000), value: 98 },
        { timestamp: new Date(timeRange.start.getTime() + 6000), value: 103 },
        { timestamp: new Date(timeRange.start.getTime() + 7000), value: 100 },
        { timestamp: new Date(timeRange.start.getTime() + 8000), value: 50 },  // Anomaly
        { timestamp: new Date(timeRange.start.getTime() + 9000), value: 102 },
      ];
      mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(data);
      if(mockInsightsStorage) mockInsightsStorage.storeInsight.mockResolvedValue(undefined);

      const anomalies = await dataAnalyzer.detectAnomalies(deviceId, metricName, timeRange, 2); // Using 2 stdDevs for easier testing
      
      expect(anomalies.length).toBe(2);
      expect(anomalies[0].details?.value).toBe(150);
      expect(anomalies[1].details?.value).toBe(50);
      if(mockInsightsStorage) expect(mockInsightsStorage.storeInsight).toHaveBeenCalledTimes(2);
    });

    it('should return no anomalies if data is stable', async () => {
      const data: TimeSeriesDataPoint[] = Array(10).fill(0).map((_, i) => ({ timestamp: new Date(timeRange.start.getTime() + i*1000), value: 100 + Math.random() * 2 - 1})); // +/- 1 from 100
      mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(data);
      const anomalies = await dataAnalyzer.detectAnomalies(deviceId, metricName, timeRange, 3);
      expect(anomalies.length).toBe(0);
    });
    
    it('should return empty array and warn if not enough data points', async () => {
        mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(Array(5).fill({value:0, timestamp: new Date()})); // Only 5 points
        const anomalies = await dataAnalyzer.detectAnomalies(deviceId, metricName, timeRange);
        expect(anomalies.length).toBe(0);
        expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('detectTrend', () => {
    it('should detect an increasing trend', async () => {
      const data: TimeSeriesDataPoint[] = Array(10).fill(0).map((_, i) => ({ timestamp: new Date(timeRange.start.getTime() + i*1000), value: 10 + i * 0.5 }));
      mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(data);
      if(mockInsightsStorage) mockInsightsStorage.storeInsight.mockResolvedValue(undefined);

      const trendInsight = await dataAnalyzer.detectTrend(deviceId, metricName, timeRange);
      expect(trendInsight).not.toBeNull();
      expect(trendInsight?.type).toBe('trend_detection');
      expect(trendInsight?.details?.trendType).toBe('increasing');
      expect(trendInsight?.details?.slope).toBeGreaterThan(0);
      if(mockInsightsStorage) expect(mockInsightsStorage.storeInsight).toHaveBeenCalledWith(trendInsight);
    });

    it('should detect a decreasing trend', async () => {
      const data: TimeSeriesDataPoint[] = Array(10).fill(0).map((_, i) => ({ timestamp: new Date(timeRange.start.getTime() + i*1000), value: 100 - i * 0.5 }));
      mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(data);
      const trendInsight = await dataAnalyzer.detectTrend(deviceId, metricName, timeRange);
      expect(trendInsight?.details?.trendType).toBe('decreasing');
      expect(trendInsight?.details?.slope).toBeLessThan(0);
    });
    
    it('should detect a stable trend for flat data', async () => {
      const data: TimeSeriesDataPoint[] = Array(10).fill(0).map((_, i) => ({ timestamp: new Date(timeRange.start.getTime() + i*1000), value: 50 }));
      mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(data);
      const trendInsight = await dataAnalyzer.detectTrend(deviceId, metricName, timeRange);
      expect(trendInsight?.details?.trendType).toBe('stable');
      expect(trendInsight?.details?.slope).toBeCloseTo(0);
    });

    it('should return null and warn if not enough data points for trend', async () => {
        mockTelemetrySource.queryTelemetryHistory.mockResolvedValue(Array(3).fill({value:0, timestamp: new Date()})); // Only 3 points
        const trend = await dataAnalyzer.detectTrend(deviceId, metricName, timeRange);
        expect(trend).toBeNull();
        expect(console.warn).toHaveBeenCalled();
    });
  });
});