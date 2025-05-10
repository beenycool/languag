/**
 * @file Detects patterns and anomalies in datasets.
 * Implements algorithms for sequence analysis, outlier detection, and frequency analysis.
 */

export interface PatternAnalyzerOptions {
  outlierDetectionMethod?: 'iqr' | 'z-score' | 'custom';
  iqrMultiplier?: number; // Typically 1.5 for mild, 3.0 for extreme outliers
  zScoreThreshold?: number; // Typically 2.5, 3.0, or 3.5
  customOutlierDetector?: (data: number[], value: number) => boolean;
  minFrequencyForPattern?: number; // Minimum occurrences to be considered a pattern
}

export class PatternAnalyzer {
  private options: PatternAnalyzerOptions;

  constructor(options: PatternAnalyzerOptions = {}) {
    this.options = {
      outlierDetectionMethod: options.outlierDetectionMethod || 'iqr',
      iqrMultiplier: options.iqrMultiplier || 1.5,
      zScoreThreshold: options.zScoreThreshold || 3,
      minFrequencyForPattern: options.minFrequencyForPattern || 2,
      customOutlierDetector: options.customOutlierDetector,
    };
  }

  /**
   * Detects outliers in a numeric dataset.
   * @param data An array of numbers.
   * @returns An array of values identified as outliers.
   */
  public detectOutliers(data: number[]): number[] {
    if (!data || data.length === 0) return [];

    switch (this.options.outlierDetectionMethod) {
      case 'iqr':
        return this.detectOutliersIQR(data);
      case 'z-score':
        return this.detectOutliersZScore(data);
      case 'custom':
        if (this.options.customOutlierDetector) {
          return data.filter(value => this.options.customOutlierDetector!(data, value));
        }
        console.warn('Custom outlier detector not provided, falling back to IQR.');
        return this.detectOutliersIQR(data);
      default:
        return this.detectOutliersIQR(data);
    }
  }

  private detectOutliersIQR(data: number[]): number[] {
    const sortedData = [...data].sort((a, b) => a - b);
    const q1 = this.getPercentile(sortedData, 25);
    const q3 = this.getPercentile(sortedData, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - (this.options.iqrMultiplier! * iqr);
    const upperBound = q3 + (this.options.iqrMultiplier! * iqr);
    return data.filter(value => value < lowerBound || value > upperBound);
  }

  private detectOutliersZScore(data: number[]): number[] {
    const n = data.length;
    if (n === 0) return [];
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const stdDev = Math.sqrt(data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n); // Population std dev

    if (stdDev === 0) return []; // All values are the same, no outliers by z-score

    return data.filter(value => {
      const z = (value - mean) / stdDev;
      return Math.abs(z) > this.options.zScoreThreshold!;
    });
  }

  // Helper, could be moved to a stats utility if StatisticalAnalyzer is also used
  private getPercentile(sortedData: number[], percentile: number): number {
    if (percentile < 0 || percentile > 100 || sortedData.length === 0) return NaN;
    const index = (percentile / 100) * (sortedData.length - 1);
    if (Number.isInteger(index)) return sortedData[index];
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sortedData[lower] + (index - lower) * (sortedData[upper] - sortedData[lower]);
  }

  /**
   * Performs frequency analysis on a dataset (categorical or discrete numerical).
   * @param data An array of numbers or strings.
   * @returns A map where keys are unique items and values are their frequencies.
   */
  public frequencyAnalysis<T extends string | number>(data: T[]): Map<T, number> {
    const frequencies = new Map<T, number>();
    data.forEach(item => {
      frequencies.set(item, (frequencies.get(item) || 0) + 1);
    });
    return frequencies;
  }

  /**
   * Identifies frequent sequences in an array of events or items.
   * (Simplified version - more advanced algorithms like Apriori or FP-Growth exist)
   * @param sequences An array of arrays, where each inner array is a sequence of items.
   * @param minSupport Minimum support count for a sequence to be considered frequent.
   * @returns An array of frequent sequences.
   */
  public findFrequentSequences<T>(sequences: T[][], minSupport?: number): T[][] {
    const supportThreshold = minSupport || this.options.minFrequencyForPattern!;
    const sequenceCounts = new Map<string, { sequence: T[], count: number }>();

    sequences.forEach(sequence => {
      // For simplicity, this example considers the entire sequence as one item.
      // A more robust solution would find sub-sequences.
      // This example will find identical whole sequences.
      const key = JSON.stringify(sequence); // Simple way to keyify a sequence
      const current = sequenceCounts.get(key);
      if (current) {
        current.count++;
      } else {
        sequenceCounts.set(key, { sequence: sequence, count: 1 });
      }
    });

    const frequentSequences: T[][] = [];
    sequenceCounts.forEach(val => {
      if (val.count >= supportThreshold) {
        frequentSequences.push(val.sequence);
      }
    });
    return frequentSequences;
  }

  // TODO: Implement more advanced pattern detection algorithms:
  // - Association rule mining (e.g., Apriori)
  // - Time series pattern detection (e.g., seasonality, cycles)
  // - Anomaly detection in time series (e.g., using moving averages, EWMA)
}