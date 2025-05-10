/**
 * @file Analyzes trends in time-series data.
 * Implements methods for trend identification, forecasting, and seasonality detection.
 */

export interface TimeSeriesDataPoint {
  timestamp: number | Date; // Unix timestamp or Date object
  value: number;
}

export interface TrendAnalyzerOptions {
  movingAverageWindow?: number; // Window size for moving average calculation
  seasonalityPeriod?: number; // Expected period for seasonality (e.g., 7 for daily data with weekly seasonality)
}

export class TrendAnalyzer {
  private options: TrendAnalyzerOptions;

  constructor(options: TrendAnalyzerOptions = {}) {
    this.options = {
      movingAverageWindow: options.movingAverageWindow || 7, // Default to 7-period MA
      seasonalityPeriod: options.seasonalityPeriod,
    };
  }

  /**
   * Sorts time series data by timestamp.
   * @param data Array of TimeSeriesDataPoint objects.
   * @returns Sorted array of TimeSeriesDataPoint objects.
   */
  private sortData(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    return [...data].sort((a, b) => {
      const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : a.timestamp;
      const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : b.timestamp;
      return tsA - tsB;
    });
  }

  /**
   * Calculates the moving average for a time series.
   * @param data Array of TimeSeriesDataPoint objects.
   * @param windowSize The number of data points to include in the moving average window.
   * @returns An array of TimeSeriesDataPoint objects representing the moving average.
   */
  public movingAverage(data: TimeSeriesDataPoint[], windowSize?: number): TimeSeriesDataPoint[] {
    const sortedData = this.sortData(data);
    const k = windowSize || this.options.movingAverageWindow!;
    if (k <= 0 || k > sortedData.length) {
      console.warn(`Invalid window size ${k} for data of length ${sortedData.length}. Returning empty array.`);
      return [];
    }

    const result: TimeSeriesDataPoint[] = [];
    for (let i = 0; i <= sortedData.length - k; i++) {
      const window = sortedData.slice(i, i + k);
      const sum = window.reduce((acc, dp) => acc + dp.value, 0);
      result.push({
        timestamp: window[Math.floor(k / 2)].timestamp, // Use midpoint timestamp
        value: sum / k,
      });
    }
    return result;
  }

  /**
   * Performs simple linear regression to identify the trend line.
   * y = mx + c
   * @param data Array of TimeSeriesDataPoint objects.
   * @returns An object with slope (m), intercept (c), and a function to predict values.
   */
  public linearRegression(data: TimeSeriesDataPoint[]): { slope: number; intercept: number; predict: (x: number) => number } {
    const sortedData = this.sortData(data);
    const n = sortedData.length;
    if (n < 2) return { slope: NaN, intercept: NaN, predict: () => NaN };

    // Use relative time indices for x to simplify calculation and avoid large numbers
    const firstTimestamp = sortedData[0].timestamp instanceof Date ? sortedData[0].timestamp.getTime() : sortedData[0].timestamp;
    const xValues = sortedData.map(dp => (dp.timestamp instanceof Date ? dp.timestamp.getTime() : dp.timestamp) - firstTimestamp);
    const yValues = sortedData.map(dp => dp.value);

    const sumX = xValues.reduce((s, v) => s + v, 0);
    const sumY = yValues.reduce((s, v) => s + v, 0);
    const sumXY = xValues.reduce((s, v, i) => s + v * yValues[i], 0);
    const sumXX = xValues.reduce((s, v) => s + v * v, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predict = (timestamp: number): number => {
        const relativeX = timestamp - firstTimestamp; // timestamp is already a number (epoch time)
        return slope * relativeX + intercept;
    };

    return { slope, intercept, predict };
  }

  /**
   * Decomposes a time series into trend, seasonality, and residuals (simplified).
   * This is a very basic decomposition. More advanced methods like STL decomposition exist.
   * @param data Array of TimeSeriesDataPoint objects.
   * @param period The seasonal period (e.g., 7 for daily data with weekly seasonality).
   * @returns An object containing trend, seasonal, and residual components.
   */
  public decompose(data: TimeSeriesDataPoint[], period?: number): {
    trend: TimeSeriesDataPoint[],
    seasonal: TimeSeriesDataPoint[],
    residual: TimeSeriesDataPoint[]
  } {
    const p = period || this.options.seasonalityPeriod;
    if (!p || p <= 1) {
      console.warn('Seasonality period not provided or invalid. Cannot perform decomposition.');
      const emptyResult = { timestamp: new Date(0), value: NaN };
      return { trend: [emptyResult], seasonal: [emptyResult], residual: [emptyResult] };
    }

    const sortedData = this.sortData(data);

    // 1. Estimate Trend (using moving average centered for seasonality)
    // For seasonality, a centered moving average of length 'p' is often used.
    // If p is even, use a 2xp-MA. If odd, p-MA.
    const trendWindow = p % 2 === 0 ? p + 1 : p; // Simplified: ensure odd window for centering
    const trendComponent = this.movingAverage(sortedData, trendWindow);

    // Align trend with original data (this is tricky and simplified here)
    // For a proper alignment, interpolation or more careful indexing is needed.
    // This example will have fewer trend points than original data.

    // 2. Detrend: Subtract trend from original series (Y - T)
    // This requires trendComponent to be aligned and same length as sortedData.
    // For simplicity, we'll work with the length of the trend component.
    const detrended: TimeSeriesDataPoint[] = [];
    // This alignment is very naive:
    const offset = Math.floor((sortedData.length - trendComponent.length) / 2);
    for (let i = 0; i < trendComponent.length; i++) {
        if (sortedData[i + offset]) {
             detrended.push({
                timestamp: trendComponent[i].timestamp,
                value: sortedData[i + offset].value - trendComponent[i].value
            });
        }
    }


    // 3. Estimate Seasonal component: Average detrended values for each season
    const seasonalAverages: number[] = new Array(p).fill(0);
    const seasonalCounts: number[] = new Array(p).fill(0);

    detrended.forEach((dp, index) => {
      const seasonIndex = index % p; // Naive season index based on position in detrended data
      seasonalAverages[seasonIndex] += dp.value;
      seasonalCounts[seasonIndex]++;
    });

    for (let i = 0; i < p; i++) {
      if (seasonalCounts[i] > 0) {
        seasonalAverages[i] /= seasonalCounts[i];
      }
    }
    // Adjust seasonal factors to sum to zero (for additive model)
    const meanSeasonalAverage = seasonalAverages.reduce((s, v) => s + v, 0) / p;
    const adjustedSeasonalFactors = seasonalAverages.map(avg => avg - meanSeasonalAverage);

    const seasonalComponent: TimeSeriesDataPoint[] = sortedData.map((dp, index) => ({
      timestamp: dp.timestamp,
      value: adjustedSeasonalFactors[index % p] // Apply repeating seasonal factor
    }));

    // 4. Estimate Residuals: Original - Trend - Seasonal (R = Y - T - S)
    // Again, alignment is key and simplified here.
    const residualComponent: TimeSeriesDataPoint[] = [];
     for (let i = 0; i < trendComponent.length; i++) { // Iterate based on trend length
        if (sortedData[i + offset] && seasonalComponent[i + offset]) {
             residualComponent.push({
                timestamp: trendComponent[i].timestamp,
                value: sortedData[i + offset].value - trendComponent[i].value - seasonalComponent[i+offset].value
            });
        }
    }

    return {
      trend: trendComponent,
      seasonal: seasonalComponent.slice(offset, offset + trendComponent.length), // Attempt to align
      residual: residualComponent
    };
  }

  // TODO: Implement forecasting methods (e.g., Exponential Smoothing, ARIMA - these are complex)
  // public forecast(data: TimeSeriesDataPoint[], steps: number): TimeSeriesDataPoint[] {
  //   // Placeholder for forecasting logic
  //   return [];
  // }
}